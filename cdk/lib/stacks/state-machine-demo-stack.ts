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

    processSQSLambda.addSQSEventSource(SQSQueue.queue)

  }
}
