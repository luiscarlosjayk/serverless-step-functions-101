import { RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { LambdaDefinition, Environment } from '../../types';

export interface LambdaConstructProps {
  definition: LambdaDefinition;
  environment: Environment;
}

export class LambdaConstruct extends Construct {
  lambda: lambda.Function;
  role: iam.Role;
  definition: LambdaDefinition;
  
  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);
    
    const { environment, definition } = props;
    this.definition = definition;
    
    this.role = new iam.Role(this, 'role', {
      description: `Lambda role for ${this.definition.name}`,
      assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('lambda.amazonaws.com')),
    });
      
    this.lambda = new nodejsLambda.NodejsFunction(this, definition.name, {
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        NODE_ENV: environment.envName,
        ...definition.environment
      },
      architecture: lambda.Architecture.ARM_64,
      handler: definition.handler,
      timeout: definition.timeoutInSeconds,
      memorySize: definition.memoryInMb,
      description: definition.description,
      role: this.role,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
      },
      bundling: {
        format: nodejsLambda.OutputFormat.ESM,
      },
      entry: path.join(__dirname, definition.entry)
    });

    // User defined permissions
    if (Array.isArray(this.definition.permissions) && this.definition.permissions.length) {
      this.definition.permissions.forEach(({ name, policyStatements }) => {
        this.role.attachInlinePolicy(
          new iam.Policy(this, name, {
            statements: policyStatements.map((statement) => new iam.PolicyStatement(statement))
          })
        )
      });
    }

    this.addLogs();
  }

  private addLogs() {
    const logGroup = new logs.LogGroup(this, 'loggroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
      logGroupName: `/aws/lambda/${this.lambda.functionName}`,
    });

    this.role.attachInlinePolicy(
      new iam.Policy(this, 'cloudwatch-policy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            resources: [
              logGroup.logGroupArn,
            ]
          }),
        ],
      })
    );
  }
  
  addSQSEventSource(queue: IQueue, options?: lambdaEventSources.SqsEventSourceProps): LambdaConstruct {
    const eventSource = new lambdaEventSources.SqsEventSource(queue, options);
    this.lambda.addEventSource(eventSource);

    return this;
  }

  addS3EventSource(bucket: s3.IBucket): LambdaConstruct {
    const eventSource = new lambdaEventSources.S3EventSourceV2(bucket, {
      events: [ s3.EventType.OBJECT_CREATED ],
    });
    this.lambda.addEventSource(eventSource);

    return this;
  }

}