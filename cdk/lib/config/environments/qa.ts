import { AWSRegion, Environment, EnvironmentName } from '../../../types';

const environment: Environment = {
  envName: EnvironmentName.DEV,
  project: 'step-functions-101',
  appName: 'state-machine-demo',
  region: AWSRegion.NORTH_VIRGINIA,
  team: 'wizeline',
  scheduleOptions: { weekDay: '1', hour: '20', minute: '0' } // 0-6 starting Sunday
};

export default environment;