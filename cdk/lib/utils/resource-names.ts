import { Environment } from '../../types';

export function getResourcePrefix(environment: Environment): string {
  return `${environment.project}-${environment.envName}-${environment.appName}`.toLowerCase();
}

export function getStackName(environment: Environment): string {
  return `${getResourcePrefix(environment)}-cdk-${environment.region}`.toLowerCase();
}
