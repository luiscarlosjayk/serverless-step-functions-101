#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ReceiptProcessorStateMachineStack } from '../lib/stacks/receipt-processor-sfn-stack';
import { getEnvironment } from '../lib/config/environments';

const environment = getEnvironment();

const app = new cdk.App();
new ReceiptProcessorStateMachineStack(app, `${environment.envName}-expenses-processor-demo-stack`, {
  environment,
  tags: {
    OwnerTeam: environment.team,
    AppName: environment.appName,
    ProjectName: environment.project,
  },
});
