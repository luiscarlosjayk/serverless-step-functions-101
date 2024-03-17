# DEMO: Receipt calculator

Given certain receipts of banks transactions.

Once transaction receipt files are uploaded to a S3 bucket trigger a StepFunctions
that invokes a lambda function that uses AWS Textract to extract the amount and date of each receipt
using a Map state, then, uses a Pass state to transform the response into a json object with format:

[
  {
    "amount": string,
    "date": string
  },
  ...
]

and then invoke AWS Bedrock to request a summarized response of total amounts paid
by month, and by year.