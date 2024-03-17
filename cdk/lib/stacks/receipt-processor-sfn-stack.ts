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

    const receiptsBucket = s3.Bucket.fromBucketName(this, 'receipts-bucket', environment.bucketName);

    const receiptsToProcessQueue = new QueueConstruct(this, 'receipt-processor-queue', {
      environment,
    });

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
    })
      .addS3EventSource(receiptsBucket);

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
          createTextractAnalyzeDocumentPolicy(),
          createS3ReadPolicy(receiptsBucket.bucketName)
        ]
      },
    });

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

    const start = new sfn.Pass(this, 'Count Receipts', {
      parameters: {
        receiptsCount: sfn.JsonPath.arrayLength(sfn.JsonPath.listAt('$.receipts'))
      },
      resultPath: sfn.JsonPath.stringAt('$.info'),
    });

    const processReceipt = new tasks.LambdaInvoke(this, 'Process Receipt', {
      lambdaFunction: receiptProcessorLambda.lambda,
      payloadResponseOnly: true,
    });

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

    const parallelGetQueryAnswers = new sfn.Parallel(this, 'Parallel Get Query Answers', {
      resultSelector: {
        [Aliases.AMOUNT]: sfn.JsonPath.stringAt(`$[0].${Aliases.AMOUNT}`),
        [Aliases.DATE]: sfn.JsonPath.stringAt(`$[1].${Aliases.DATE}`),
        [Aliases.CONCEPT]: sfn.JsonPath.stringAt(`$[2].${Aliases.CONCEPT}`)
      }
    })
      .branch(getAmountTask, getDateTask, getConceptTask);

    processReceipt.next(parallelGetQueryAnswers);

    const processReceiptsMap = new sfn.Map(this, 'Process Receipts', {
      maxConcurrency: 5,
      itemsPath: sfn.JsonPath.stringAt('$.receipts'),
      resultPath: sfn.JsonPath.stringAt('$.processedReceipts'),
    });
    processReceiptsMap.itemProcessor(processReceipt);

    const conditionRecipesLengthGT0 = sfn.Condition.numberGreaterThan(sfn.JsonPath.stringAt('$.info.receiptsCount'), 0);
    const noReceipts = new sfn.Pass(this, 'No Receipts');
    const hasReceiptsChoice = new sfn.Choice(this, 'Has Receipts?')
      .when(conditionRecipesLengthGT0, processReceiptsMap)
      .otherwise(noReceipts);
    

    const prompt = `\`${HUMAN_PROMPT} I want the raw json resulting output after summarizing expenses by month.
    No explanation is needed.
    INPUT:
    \${JSON.stringify($.processedReceipts)}
    ${AI_PROMPT}\``;
    
    const generatePrompt = new tasks.EvaluateExpression(this, 'Generate Prompt', {
      expression: prompt,
      resultPath: '$.prompt',
      runtime: Runtime.NODEJS_LATEST,
    });
    processReceiptsMap.next(generatePrompt);

    const model = bedrock.FoundationModel.fromFoundationModelId(
      this,
      'Model',
      bedrock.FoundationModelIdentifier.ANTHROPIC_CLAUDE_INSTANT_V1
    );
    const calculateTotals = new tasks.BedrockInvokeModel(this, 'Calculate Totals', {
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
    generatePrompt.next(calculateTotals);

    start.next(hasReceiptsChoice);
    
    

    const stateMachineConstruct = new StateMachineConstruct(this, 'receipt-processor-statemachine', {
      environment,
      start
    });

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
    })
      .addSQSEventSource(receiptsToProcessQueue.queue, {
        maxBatchingWindow: cdk.Duration.minutes(5),
        batchSize: 20,
      });

  }
}
