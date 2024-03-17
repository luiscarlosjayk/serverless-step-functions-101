/**
 * This lambda functions is triggered by a S3 event,
 * which in turns sends these to a SQS queue in batch.
 */
import { S3Event, Context } from 'aws-lambda';
import { SQSClient, SendMessageBatchCommandInput, SendMessageBatchCommand, SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL ?? null;

export async function handler(event: S3Event, context: Context) {
  console.log(JSON.stringify(event, null, 2));
  
  if (typeof SQS_QUEUE_URL !== 'string') {
    throw new Error('SQS_QUEUE_URL is not defined');
  }

  const requestId = context.awsRequestId;
  const eventTime = event.Records[0].eventTime;
  const bucketName = event.Records[0].s3.bucket.name;
  const keys = event.Records.map((record) => {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    return key;
  });
  const sqsClient = new SQSClient();
  const input: SendMessageBatchCommandInput = {
    QueueUrl: SQS_QUEUE_URL,
    Entries: keys.map((key): SendMessageBatchRequestEntry => ({
      Id: removeFileExtension(key),
      MessageBody: JSON.stringify({
        requestId,
        eventTime,
        bucketName,
        key,
      }),
      DelaySeconds: 10
    }))
  };
  console.log(JSON.stringify(input, null, 2));
  const command = new SendMessageBatchCommand(input);

  try {
    const response = await sqsClient.send(command);
    console.log(JSON.stringify(response, null, 2));
    
    return response;
  } catch (error) {
    const message = `Error processing S3 event: ${error.message}`;
    console.error(error);

    throw new Error(message);
  }
}

function removeFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}
