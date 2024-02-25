import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Environment } from '../../types';
import { QueueConstruct } from '../constructs/queue-construct';
import { StateMachineConstruct } from '../constructs/state-machine-construct';
import { LambdaConstruct } from '../constructs/lambda-function-construct';
import { Effect } from 'aws-cdk-lib/aws-iam';

export interface StateMachineDemoStackProps extends cdk.StackProps {
  environment: Environment;
}

export class StateMachineDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StateMachineDemoStackProps) {
    super(scope, id, props);

    const { environment } = props;

    const SQSQueue = new QueueConstruct(this, 'Queue', { environment });

    new StateMachineConstruct(this, 'StateMachineDemo', {
      environment,
      queue: SQSQueue.queue,
    });

    const processSQSLambda = new LambdaConstruct(this, 'ProcessSQSLambda', {
      definition: {
        name: 'process-sqs',
        handler: 'index.handler',
        entry: '../../../src/handlers/process-sqs-and-send-message.ts',
        description: 'Lambda function that processes the SQS messages and sends message back to StepFunctions',
        environment: {
          NODE_ENV: environment.envName,
        },
        permissions: [
          {
            name: 'step-functions-send-task-policy',
            policyStatements: [
              {
                effect: Effect.ALLOW,
                actions: [
                  'states:SendTaskFailure',
                  'states:SendTaskSuccess',
                  'states:SendTaskHeartbeat',
                ],
                resources: ['*']
              }
            ]
          }
        ]
      },
      environment,
    });

    processSQSLambda.addSQSEventSource(SQSQueue.queue);

    new LambdaConstruct(this, 'ProcessReceiptLambda', {
      definition: {
        name: 'process-receipt',
        handler: 'index.handler',
        entry: '../../../src/handlers/process-receipt.ts',
        description: 'Lambda function that processes the receipts',
        environment: {
          NODE_ENV: environment.envName,
        },
        timeoutInSeconds: cdk.Duration.seconds(15),
        permissions: [
          {
            name: 'textract-analyze-document-task-policy',
            policyStatements: [
              {
                effect: Effect.ALLOW,
                actions: [
                  'textract:AnalyzeDocument',
                ],
                resources: ['*']
              }
            ]
          },
          {
            name: 's3-read-policy',
            policyStatements: [
              {
                effect: Effect.ALLOW,
                actions: [
                  's3:GetObject',
                ],
                resources: ['arn:aws:s3:::step-functions-101-receipts/*']
              }
            ]
          }
        ]
      },
      environment,
    });

  }
}
