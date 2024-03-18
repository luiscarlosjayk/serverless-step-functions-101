import { Effect } from 'aws-cdk-lib/aws-iam';

export function createSFNStartExecutionPolicy(stateMachineArn: string) {
  return {
    name: 'sfn-start-execution-policy',
    policyStatements: [
      {
        effect: Effect.ALLOW,
        actions: [
          'states:StartExecution',
        ],
        resources: [
          stateMachineArn
        ],
      },
    ],
  };
}

export function createSQSSendMessagePolicy(queueArn: string) {
  return {
    name: 'sqs-send-message-policy',
    policyStatements: [
      {
        effect: Effect.ALLOW,
        actions: [
          'sqs:sendmessage',
        ],
        resources: [
          queueArn
        ],
      },
    ],
  };
}

export function createTextractAnalyzeDocumentPolicy(bucketName: string) {
  return {
    name: 'textract-analyze-document-task-policy',
    policyStatements: [
      {
        effect: Effect.ALLOW,
        actions: [
          'textract:AnalyzeDocument', // sync
          'textract:StartDocumentAnalysis', // async
          'textract:GetDocumentAnalysis', // async
        ],
        resources: [`arn:aws:textract:*:*:document/${bucketName}/*`]
      }
    ]
  };
}

export function createS3ReadPolicy(bucketName: string) {
  return {
    name: 's3-read-policy',
    policyStatements: [
      {
        effect: Effect.ALLOW,
        actions: [
          's3:GetObject',
        ],
        resources: [`arn:aws:s3:::${bucketName}/*`]
      }
    ]
  };
}
