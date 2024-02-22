import { CronOptions } from 'aws-cdk-lib/aws-events';
import type { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { PolicyStatementProps } from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';

export enum AWSRegion {
  NORTH_VIRGINIA = 'us-east-1',
  OHIO = 'us-east-2',
};

export enum EnvironmentName {
  DEV = 'dev',
  QA = 'qa',
  STAGE = 'stage',
  PROD = 'prod',
};

export interface Environment {
  envName: EnvironmentName;
  project: string;
  appName: string;
  region: AWSRegion;
  team: string;
  scheduleOptions?: CronOptions
};

export interface LambdaDefinition {
  name: string;
  handler: NodejsFunctionProps['handler'];
  entry: string;
  description: NodejsFunctionProps['description'];
  environment: NodejsFunctionProps['environment'];
  permissions?: {
    name: string;
    policyStatements: PolicyStatementProps[];
  }[];
  provisionedConcurrency?: number;
  timeoutInSeconds?: Duration;
  memoryInMb?: number;
}
