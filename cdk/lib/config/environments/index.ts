import { Environment, EnvironmentName } from '../../../types';
import dev from './dev';

const ENV_NAME = process.env?.ENV_NAME as EnvironmentName | undefined;

const environmentsMap = new Map<EnvironmentName, Environment>([
  [EnvironmentName.DEV, dev],
]);

export function getEnvironment(): Environment {
  if (typeof ENV_NAME !== 'string') {
    throw 'Missing ENV_NAME';
  }

  const environment = environmentsMap.get(ENV_NAME);
  
  if (!environment) {
    throw `Expected a valid environment name among: ${Object.values(EnvironmentName).join(' , ')}, but received ${ENV_NAME}`;
  }

  return environment;
}