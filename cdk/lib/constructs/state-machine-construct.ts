import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Environment } from '../../types';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export interface StateMachineConstructProps {
  environment: Environment;
  queue: Queue;
}

export class StateMachineConstruct extends Construct {
  environment: Environment;
  stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: StateMachineConstructProps) {
    super(scope, id);

    this.environment = props.environment;

    const success = new sfn.Pass(this, 'Success');
    const timeout = new sfn.Pass(this, 'Timeout');
    const failure = new sfn.Pass(this, 'Failure');

    const sendSQSMessageAndWaitForToken = new sfn.CustomState(this, 'SendSQSMessageAndWaitForToken', {
      stateJson: {
        Type: 'Task',
        Resource: 'arn:aws:states:::sqs:sendMessage.waitForTaskToken',
        HeartbeatSeconds: Duration.minutes(5).toSeconds(),
        Parameters: {
          QueueUrl: props.queue.queueUrl,
          MessageBody: {
            messageTitle: 'Task started by Step Functions',
            'taskToken.$': sfn.JsonPath.stringAt('$$.Task.Token'),
          }
        },
        ResultPath: sfn.JsonPath.stringAt('$.SQS')
      }
    })
      .addCatch(timeout, {
        errors: ['States.Timeout']
      })
      .addCatch(failure, {
        errors: ['States.TaskFailed']
      });

    const stateMachineDefinition = sfn.Chain
      .start(sendSQSMessageAndWaitForToken)
      .next(success);

    this.stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(stateMachineDefinition),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.stateMachine.grantTaskResponse

    // Don't forget permissions, you need to allow the state machine to send messages to the queue
    props.queue.grantSendMessages(this.stateMachine);

    /**
     * Schedule periodically execution of the state machine
     */
    if (this.environment.scheduleOptions) {
      this.addScheduler();
    }
  }

  private addScheduler() {
    if (!this.environment.scheduleOptions) {
      throw 'Cannot add scheduler due to missing environment.scheduleOptions';
    }

    const rule = new events.Rule(this, 'Scheduler', {
      schedule: events.Schedule.cron(this.environment.scheduleOptions),
    });

    const role = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
    });

    rule.addTarget(new targets.SfnStateMachine(this.stateMachine, {
      role: role,
    }));
  }
}
