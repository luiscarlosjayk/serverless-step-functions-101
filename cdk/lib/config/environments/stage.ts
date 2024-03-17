import { AWSRegion, Environment, EnvironmentName } from '../../../types';
import { environmentDefaults } from '.';

const environment: Environment = {
  envName: EnvironmentName.STAGE,
  region: AWSRegion.NORTH_VIRGINIA,
  bucketName: 'step-functions-101-receipts-stage',
  ...environmentDefaults
};

export default environment;
