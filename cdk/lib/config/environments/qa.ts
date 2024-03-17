import { AWSRegion, Environment, EnvironmentName } from '../../../types';
import { environmentDefaults } from '.';

const environment: Environment = {
  envName: EnvironmentName.QA,
  region: AWSRegion.NORTH_VIRGINIA,
  bucketName: 'step-functions-101-receipts-qa',
  ...environmentDefaults
};

export default environment;
