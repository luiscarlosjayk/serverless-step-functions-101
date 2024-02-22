#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StateMachineDemoStack } from '../lib/stacks/state-machine-demo-stack';
import { getEnvironment } from '../lib/config/environments';

const environment = getEnvironment();

const app = new cdk.App();
new StateMachineDemoStack(app, 'StateMachineDemoStack', {
  environment,
  tags: {
    OwnerTeam: environment.team,
    AppName: environment.appName,
    ProjectName: environment.project,
  },
});
