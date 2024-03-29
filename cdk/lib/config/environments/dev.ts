import { AWSRegion, Environment, EnvironmentName } from '../../../types';
import { environmentDefaults } from '.';

const environment: Environment = {
  envName: EnvironmentName.DEV,
  region: AWSRegion.NORTH_VIRGINIA,
  bucketName: 'step-functions-101-receipts',
  ...environmentDefaults
};

export default environment;
