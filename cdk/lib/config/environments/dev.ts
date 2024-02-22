import { AWSRegion, Environment, EnvironmentName } from '../../../types';

const environment: Environment = {
  envName: EnvironmentName.DEV,
  project: 'step-functions-101',
  appName: 'state-machine-demo',
  region: AWSRegion.NORTH_VIRGINIA,
  team: 'wizeline',
};

export default environment;
