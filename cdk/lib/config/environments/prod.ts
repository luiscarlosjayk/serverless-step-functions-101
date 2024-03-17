import { AWSRegion, Environment, EnvironmentName } from '../../../types';
import { environmentDefaults } from '.';

const environment: Environment = {
  envName: EnvironmentName.PROD,
  region: AWSRegion.NORTH_VIRGINIA,
  bucketName: 'step-functions-101-receipts-prod',
  ...environmentDefaults
};

export default environment;
