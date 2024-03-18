/**
 * This lambda function processes a Receipt image in a S3 bucket
 * using Amazon Textract to extract the amount, date and concept from it
 * and returns the result to the output.
 */
import { AnalyzeDocumentCommand, AnalyzeDocumentCommandInput, TextractClient } from '@aws-sdk/client-textract';

export interface Event {
  bucketName: string;
  key: string;
}

export async function handler(event: Event) {
  console.log(JSON.stringify(event, null, 2));

  const textractClient = new TextractClient();
  const input: AnalyzeDocumentCommandInput = {
    Document: {
      S3Object: {
        Bucket: event.bucketName,
        Name: event.key,
      },
    },
    FeatureTypes: ['QUERIES'],
    QueriesConfig: {
      Queries: [
        {
          Alias: 'amount',
          Text: 'What is the amount of money?',
        },
        {
          Alias: 'date',
          Text: 'What is the date?',
        },
        {
          Alias: 'concept',
          Text: 'What is the "concepto"?',
        }
      ],
    },
  };

  const command = new AnalyzeDocumentCommand(input);
  try {
    const response = await textractClient.send(command);
    console.log(JSON.stringify(response, null, 2));
    
    return response;
  } catch (error: any) {
    const message = `Error processing receipt: ${error?.message}`;
    console.error(error);

    throw new Error(message);
  }
}
