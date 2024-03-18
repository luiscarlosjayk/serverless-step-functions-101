import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Aliases, Environment } from '../../types';
import { QueueConstruct } from '../constructs/queue-construct';
import { StateMachineConstruct } from '../constructs/state-machine-construct';
import { LambdaConstruct } from '../constructs/lambda-function-construct';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { createS3ReadPolicy, createSFNStartExecutionPolicy, createSQSSendMessagePolicy, createTextractAnalyzeDocumentPolicy } from '../utils/permissions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { HUMAN_PROMPT, AI_PROMPT } from '@anthropic-ai/sdk';

export interface ReceiptProcesorStateMachineStackProps extends cdk.StackProps {
  environment: Environment;
}

export class ReceiptProcessorStateMachineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ReceiptProcesorStateMachineStackProps) {
    super(scope, id, props);

    const { environment } = props;

    /**
     * S3 Bucket
     * 
     * Imports S3 Bucket given in environment configuration.
     * Notice the S3 Bucket is not created in this stack,
     * but must previously exist.
     */
    const receiptsBucket = s3.Bucket.fromBucketName(this, 'receipts-bucket', environment.bucketName);

    /**
     * SQS Queue: Receipt Processor
     * 
     * This Qeueue will hold the messages for each image uploaded to the S3 Bucket.
     * The SFN Triggerer Lambda function is subscribed to this queue,
     * and will conform the initial input for the state machine and start it.
     */
    const receiptsToProcessQueue = new QueueConstruct(this, 'receipt-processor-queue', {
      environment,
    });

    /**
     * Lambda Function: S3 Listener
     * 
     * The S3 Listener Lambda Function will receive the messages from S3 Bucket
     * each time a new receipt is uploaded and push them to the SQS Queue.
     */
    const s3ListenerLambda = new LambdaConstruct(this, 's3-listener-lambda', {
      environment,
      definition: {
        name: 's3-listener-lambda',
        handler: 'index.handler',
        entry: '../../../src/handlers/s3-listener.ts',
        description: 'Lambda function that listens for S3 events when files are uploaded',
        environment: {
          NODE_ENV: environment.envName,
          SQS_QUEUE_URL: receiptsToProcessQueue.queue.queueUrl,
        },
        permissions: [
          createSQSSendMessagePolicy(receiptsToProcessQueue.queue.queueArn),
        ]
      }
    });

    s3ListenerLambda.addS3EventSource(receiptsBucket);

    /**
     * Lambda Function: Receipt Processor
     * 
     * Invokes Amazon Textract API to analyze the uploaded images
     * and extract the text from the images using queries.
     */
    const receiptProcessorLambda = new LambdaConstruct(this, 'receipt-processor-lambda', {
      environment,
      definition: {
        name: 'receipt-processor-lambda',
        handler: 'index.handler',
        entry: '../../../src/handlers/process-receipt.ts',
        description: 'Lambda function that processes a receipt',
        environment: {
          NODE_ENV: environment.envName,
        },
        timeoutInSeconds: cdk.Duration.seconds(20),
        permissions: [
          createTextractAnalyzeDocumentPolicy(receiptsBucket.bucketName),
          createS3ReadPolicy(receiptsBucket.bucketName)
        ]
      },
    });

    /**
     * Lambda Function: Get Query Answer
     * 
     * This Lambda Functions extracts the desired query response 
     * from Amazon Textract, given by a parameter named "alias".
     */
    const getQueryAnswerLambda = new LambdaConstruct(this, 'get-query-answer-lambda', {
      environment,
      definition: {
        name: 'get-query-answer-lambda',
        handler: 'index.handler',
        entry: '../../../src/handlers/extract-query-response.ts',
        description: 'Lambda function that extracts a query answer',
        environment: {
          NODE_ENV: environment.envName,
        },
      },
    });

    /**
     * SFN Pass Task: Count Receipts
     * 
     * Counts the number of elements in the $.receipts array for later branching
     * in the .
     */
    const countReceiptsTask = new sfn.Pass(this, 'Count Receipts', {
      parameters: {
        receiptsCount: sfn.JsonPath.arrayLength(sfn.JsonPath.listAt('$.receipts'))
      },
      resultPath: sfn.JsonPath.stringAt('$.info'),
    });

    /**
     * SFN Lambda Task: Process Receipt
     * 
     * Invokes the Process Receipt Lambda function to process a given receipt
     * and invoke Amazon Textract.
     */
    const processReceipt = new tasks.LambdaInvoke(this, 'Process Receipt', {
      lambdaFunction: receiptProcessorLambda.lambda,
      payloadResponseOnly: true,
    });

    /**
     * SFN Lambda Task: Get Receipt Amount
     * 
     * Invokes the Get Query Answer Lambda function to extract the amount.
     */
    const getAmountTask = new tasks.LambdaInvoke(this, 'Get receipt amount', {
      lambdaFunction: getQueryAnswerLambda.lambda,
      payload: sfn.TaskInput.fromObject({
        textractResponse: sfn.JsonPath.stringAt('$'),
        alias: Aliases.AMOUNT,
      }),
      resultSelector: {
        [Aliases.AMOUNT]: sfn.JsonPath.stringAt('$'),
      },
      payloadResponseOnly: true
    });

    /**
     * SFN Lambda Task: Get Receipt Date
     * 
     * Invokes the Get Query Answer Lambda function to extract the date.
     */
    const getDateTask = new tasks.LambdaInvoke(this, 'Get receipt date', {
      lambdaFunction: getQueryAnswerLambda.lambda,
      payload: sfn.TaskInput.fromObject({
        textractResponse: sfn.JsonPath.stringAt('$'),
        alias: Aliases.DATE,
      }),
      resultSelector: {
        [Aliases.DATE]: sfn.JsonPath.stringAt('$'),
      },
      payloadResponseOnly: true
    });

    /**
     * SFN Lambda Task: Get Receipt Concept
     * 
     * Invokes the Get Query Answer Lambda function to extract the concept.
     */
    const getConceptTask = new tasks.LambdaInvoke(this, 'Get receipt concept', {
      lambdaFunction: getQueryAnswerLambda.lambda,
      payload: sfn.TaskInput.fromObject({
        textractResponse: sfn.JsonPath.stringAt('$'),
        alias: Aliases.CONCEPT,
      }),
      resultSelector: {
        [Aliases.CONCEPT]: sfn.JsonPath.stringAt('$'),
      },
      payloadResponseOnly: true
    });

    /**
     * SFN Parallel Task: Get Query Answers
     * 
     * Calls the Get Receipt Amount, Get Receipt Date, and Get Receipt Concept tasks
     * in parallel to extract the answers for each receipt.
     */
    const parallelGetQueryAnswers = new sfn.Parallel(this, 'Parallel Get Query Answers', {
      resultSelector: {
        [Aliases.AMOUNT]: sfn.JsonPath.stringAt(`$[0].${Aliases.AMOUNT}`),
        [Aliases.DATE]: sfn.JsonPath.stringAt(`$[1].${Aliases.DATE}`),
        [Aliases.CONCEPT]: sfn.JsonPath.stringAt(`$[2].${Aliases.CONCEPT}`)
      }
    });
    
    par
allelGetQueryAnswers.branch(getAmountTask, getDateTask, getConceptTask);
    processReceipt.next(parallelGetQueryAnswers);

    /**
     * SFN Map Task: Process Receipts
     * 
     * Processes all the receipts in the $.receipts array and outputs
     * the results as $.processedReceipts in the context.
     */
    const processReceiptsMap = new sfn.Map(this, 'Process Receipts', {
      maxConcurrency: 5,
      itemsPath: sfn.JsonPath.stringAt('$.receipts'),
      resultPath: sfn.JsonPath.stringAt('$.processedReceipts'),
    });

    processReceiptsMap.itemProcessor(processReceipt);

    /**
     * SFN Condition Task: 
     */
    const conditionRecipesLengthGT0 = sfn.Condition.numberGreaterThan(sfn.JsonPath.stringAt('$.info.receiptsCount'), 0);
    const noReceipts = new sfn.Fail(this, 'No Receipts');
    const hasReceiptsChoice = new sfn.Choice(this, 'Has Receipts?')
      .when(conditionRecipesLengthGT0, processReceiptsMap)
      .
otherwise(noReceipts);
    countReceiptsTask.next(hasReceiptsChoice);

    /**
     * This is just the prompt text we will pass to the Bedrock model
     * to summarize the final response of expenses grouped by date.
     */
    const prompt = `\`${HUMAN_PROMPT} I want the raw json resulting output after summarizing expenses by month.
    No explanation is needed.
    INPUT:
    \${JSON.stringify($.processedReceipts)}
    ${AI_PROMPT}\``;
    
    /**
     * SFN Evaluate Expression Task: This replaces the variables in the prompt text
     * with $.processedReceipts json  object existing in the context.
     */
    const generatePrompt = new tasks.EvaluateExpression(this, 'Generate Prompt', {
      expression: prompt,
      resultPath: '$.prompt',
      runtime: Runtime.NODEJS_LATEST,
    });

    processReceiptsMap.next(generatePrompt);

    /**
     * Bedrock Model
     * 
     * This is the model that will be used to summarize the final response.
     * For this demo we will use Claude Instant from Anthropic.
     */
    const model = bedrock.FoundationModel.fromFoundationModelId(this, 'BedrockModel',
      bedrock.FoundationModelIdentifier.ANTHROPIC_CLAUDE_INSTANT_V1
    );

    /**
     * SFN Bedrock Invoke Model Task: Calculate Totals
     * 
     * This invokes the Bedrock model to summarizes the total of expenses grouped by date.
     */
    const calculateTotals = new tasks.BedrockInvokeModel(this, 'Summarize Totals', {
      model,
      body: sfn.TaskInput.fromObject({
        prompt: sfn.JsonPath.stringAt('$.prompt'),
        temperature: 1,
        max_tokens_to_sample: 300,
        top_p: 1,
        top_k: 250,
        stop_sequences: ['Human']
      }),
      resultSelector: {
        completion: sfn.JsonPath.stringToJson(sfn.JsonPath.stringAt('$.Body.completion')),
      },
      outputPath: sfn.JsonPath.stringAt('$.completion'),
    });

    /**
     * After generating the prompt text based on query answers perform the calculation.
     * Using AI for this is overkill but the point of this example is to illustrate
     * how to connect other services to the SFN state machine using the optimized integrations.
     * Ref: https://docs.aws.amazon.com/step-functions/latest/dg/connect-supported-services.html
     */
    generatePrompt.next(calculateTotals);
    
    /**
     * SFN State Machine: Receipts Processor StateMachine
     */
    const stateMachineConstruct = new StateMachineConstruct(this, 'receipt-processor-statemachine', {
      environment,
      start: countReceiptsTask
    });

    /**
     * Lambda Function
     * 
     * The SFN Triggerer Lambda, is subscribed to the SQS Queue,
     * conforming the initial input for the state machine and starting its execution.
     */
    const sfnTriggererLambda = new LambdaConstruct(this, 'statemachine-triggerer-lambda', {
      environment,
      definition: {
        name: 'sfn-triggerer-lambda',
        handler: 'index.handler',
        entry: '../../../src/handlers/process-sqs-events-trigger-sfn.ts',
        description: 'Lambda function that listens for SQS events and triggers the state machine',
        environment: {
          NODE_ENV: environment.envName,
          STEP_FUNCTION_ARN: stateMachineConstruct.stateMachine.stateMachineArn,
        },
        permissions: [
          createSFNStartExecutionPolicy(stateMachineConstruct.stateMachine.stateMachineArn),
        ]
      }
    });

    // Registers the Triggerer Lambda with the SQS Queue.
    sfnTriggererLambda.addSQSEventSource(receiptsToProcessQueue.queue, {
      maxBatchingWindow: cdk.Duration.minutes(5),
      batchSize: 20,
    });
  }
}
