import { RemovalPolicy } from 'aws-cdk-lib';
import { Environment } from '../../types';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface QueueConstructProps {
  environment: Environment;
}

export class QueueConstruct extends Construct {
  environment: Environment;
  queue: sqs.Queue;

  constructor(scope: Construct, id: string, props: QueueConstructProps) {
    super(scope, id);

    this.environment = props.environment;

    this.queue = new sqs.Queue(this, 'SQSQueue', {
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
