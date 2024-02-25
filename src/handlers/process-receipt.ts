import { AnalyzeDocumentCommand, AnalyzeDocumentCommandInput, TextractClient } from '@aws-sdk/client-textract';

export async function handler() {
  const textractClient = new TextractClient();
  const input: AnalyzeDocumentCommandInput = {
    Document: {
      S3Object: {
        Bucket: process.env.BUCKET_NAME,
        Name: process.env.RECEIPT_FILE_NAME,
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
        }
      ],
    },
  };
  const command = new AnalyzeDocumentCommand(input);
  const response = await textractClient.send(command);
  console.log(JSON.stringify(response, null, 2));
}
