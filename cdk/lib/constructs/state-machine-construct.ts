import { RemovalPolicy } from 'aws-cdk-lib';
import { Environment } from '../../types';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';

export interface StateMachineConstructProps {
  environment: Environment;
  start: sfn.IChainable;
}

export class StateMachineConstruct extends Construct {
  environment: Environment;
  stateMachine: sfn.StateMachine;
  private chain: sfn.Chain;

  constructor(scope: Construct, id: string, props: StateMachineConstructProps) {
    super(scope, id);

    this.environment = props.environment;

    this.chain = sfn.Chain.start(props.start);
    this.stateMachine = new sfn.StateMachine(this, 'statemachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(this.chain),
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  next(state: sfn.IChainable): sfn.Chain {
    return this.chain.next(state);
  }

  addEventBridgeScheduler(scheduleOptions: events.CronOptions) {
    if (!scheduleOptions) {
      throw 'Missing scheduleOptions';
    }

    const rule = new events.Rule(this, 'scheduler', {
      schedule: events.Schedule.cron(scheduleOptions),
    });

    const role = new iam.Role(this, 'scheduler-role', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
    });

    rule.addTarget(new targets.SfnStateMachine(this.stateMachine, {
      role: role,
    }));
  }
}
