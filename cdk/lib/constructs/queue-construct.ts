import { Duration, RemovalPolicy, Size } from 'aws-cdk-lib';
import { Environment } from '../../types';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { LambdaConstruct } from './lambda-function-construct';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export interface QueueConstructProps {
  environment: Environment;
}

export class QueueConstruct extends Construct {
  environment: Environment;
  queue: sqs.Queue;
  lambdaEventSource: SqsEventSource;

  constructor(scope: Construct, id: string, props: QueueConstructProps) {
    super(scope, id);

    this.environment = props.environment;

    this.queue = new sqs.Queue(this, 'queue', {
      receiveMessageWaitTime: Duration.seconds(20),
      visibilityTimeout: Duration.minutes(1),
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
