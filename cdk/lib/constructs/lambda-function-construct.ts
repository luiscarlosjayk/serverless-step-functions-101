import { RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { getResourcePrefix } from '../utils/resource-names';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { LambdaDefinition, Environment } from '../../types';

export interface LambdaConstructProps {
  definition: LambdaDefinition;
  environment: Environment;
}

export class LambdaConstruct extends Construct {
  lambda: lambda.Function;
  liveAlias: lambda.Alias;
  role: iam.Role;
  definition: LambdaDefinition;
  
  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);
    
    const { environment, definition } = props;
    this.definition = definition;
    
    const functionName = `${getResourcePrefix(environment)}-${definition.name}-lambda`;
    
    const logGroup = new logs.LogGroup(this, `${definition.name}-loggroup`, {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
      logGroupName: `/aws/lambda/${functionName}`,
    });
    
    this.role = new iam.Role(this, 'role', {
      description: `Lambda role for ${this.definition.name}`,
      assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('lambda.amazonaws.com')),
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
      
      // Add permissions to send logs
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
      functionName,
      role: this.role,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
      },
      bundling: {
        format: nodejsLambda.OutputFormat.ESM,
      },
      entry: path.join(__dirname, definition.entry)
    });

    this.liveAlias = new lambda.Alias(this, 'LambdaAlias', {
      aliasName: 'live',
      version: this.lambda.currentVersion,
      description: `Live version of ${functionName}`,
      ...(definition.provisionedConcurrency
        ? {
          provisionedConcurrentExecutions: definition.provisionedConcurrency
        }
        : {})
    })
  }
  
  addSQSEventSource(queue: IQueue): void {
    const eventSource = new lambdaEventSources.SqsEventSource(queue);
    this.lambda.addEventSource(eventSource);
  }

}