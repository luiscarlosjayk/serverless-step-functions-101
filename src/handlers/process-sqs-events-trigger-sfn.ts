/**
 * This lambda function receivs the SQS messages in batch,
 * and sends them grouped to the step function to be processed.
 * The amount of receipts to process will depend on SQS batch.
 */
import { SFNClient, StartExecutionCommand, StartExecutionCommandInput } from '@aws-sdk/client-sfn';
import { SQSEvent, Context } from 'aws-lambda';

interface MessageBody {
  bucketName: string;
  key: string;
}

const STEP_FUNCTION_ARN = process.env.STEP_FUNCTION_ARN ?? null;

export async function handler(event: SQSEvent, context: Context) {
  console.log(JSON.stringify(event, null, 2));
  
  if (typeof STEP_FUNCTION_ARN !== 'string') {
    throw new Error('STEP_FUNCTION_ARN is not defined');
  }

  try {
    const now = new Date();
    const sfnClient = new SFNClient();
    const payload = event.Records.map((record) => {
        const messageBody = JSON.parse(record.body) as MessageBody;
        
        return {
          bucketName: messageBody.bucketName,
          key: messageBody.key
        };
    });
    const input: StartExecutionCommandInput = {
      stateMachineArn: STEP_FUNCTION_ARN,
      input: JSON.stringify({ receipts: payload }),
    };
    console.log(JSON.stringify(input, null, 2));
    const command = new StartExecutionCommand(input);
    const response = await sfnClient.send(command);
    console.log(JSON.stringify(response, null, 2));
    
    return response;
  } catch (error: any) {
    const message = `Error processing SQS event: ${error?.message}`;
    console.error(error);

    throw new Error(message);
  }
}
