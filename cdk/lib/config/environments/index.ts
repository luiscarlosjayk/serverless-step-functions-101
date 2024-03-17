import { Environment, EnvironmentName } from '../../../types';
import dev from './dev';
import qa from './qa';
import stage from './stage';
import prod from './prod';

/**
 * If you want to use a different environment,
 * you can specify it by passing an environment variable ENV_NAME.
 * i.e.: ENV_NAME=qa pnpm run cdk:deploy
 */
const ENV_NAME = process.env?.ENV_NAME ?? EnvironmentName.DEV;

export const environmentDefaults = {
  project: 'step-functions-101',
  appName: 'state-machine-demo',
  team: 'wizeline',
};

const environmentsMap = new Map<EnvironmentName, Environment>([
  [EnvironmentName.DEV, dev],
  [EnvironmentName.QA, qa],
  [EnvironmentName.STAGE, stage],
  [EnvironmentName.PROD, prod],
]);

function isValidEnvironmentName(envName: string): envName is EnvironmentName {
  if (typeof ENV_NAME !== 'string') {
    return false;
  }

  return Object.keys(EnvironmentName).includes(envName.toUpperCase());
}

export function getEnvironment(): Environment {
  if (!isValidEnvironmentName(ENV_NAME)) {
    throw `Expected a valid environment name among: ${Object.values(EnvironmentName).join(' , ')}, but received ENV_NAME(${typeof ENV_NAME})=${ENV_NAME}`;
  }

  const environment = environmentsMap.get(ENV_NAME);
  
  if (!environment) {
    throw `Environment settings not found: ${ENV_NAME}`;
  }

  return environment;
}