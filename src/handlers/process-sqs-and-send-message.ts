import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand, SendTaskSuccessCommandInput, SendTaskFailureCommandInput } from '@aws-sdk/client-sfn';
import { SQSEvent } from 'aws-lambda';

interface MessageBody {
  taskToken: string;
  [key: string]: string;
}

export async function handler(event: SQSEvent) {
  const stepFunctionsClient = new SFNClient();
  
  await Promise.all(
    event.Records.map(async (record) => {
      const messageBody: MessageBody = JSON.parse(record.body);
      const taskToken = messageBody.taskToken;

        return new Promise((resolve) => {
          setTimeout(async () => {
            await sendSuccessCommand(stepFunctionsClient, taskToken);
            resolve(true);
          }, 1000 * 2);
        });
    })
  );
}

async function sendSuccessCommand(client: SFNClient, taskToken: string) {
  const input: SendTaskSuccessCommandInput = {
    taskToken,
    output: JSON.stringify({
      message: 'Success response'
    }),
  };
  const command = new SendTaskSuccessCommand(input);
  const response = await client.send(command);
}

async function sendFailureCommand(client: SFNClient, taskToken: string) {
  const input: SendTaskFailureCommandInput = {
    taskToken,
    error: '500 My Internal Error',
    cause: 'Something failed'
  };
  const command = new SendTaskFailureCommand(input);
  const response = await client.send(command);
}