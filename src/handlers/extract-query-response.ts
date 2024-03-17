import { AnalyzeDocumentCommandOutput } from '@aws-sdk/client-textract';

export interface Event {
  textractResponse: AnalyzeDocumentCommandOutput;
  alias: string;
}

export async function handler(event: Event) {
  console.log(JSON.stringify(event, null, 2));
  
  if (typeof event.alias !== 'string') {
    throw new Error('Event alias is not defined');
  }

  if (!event.textractResponse.Blocks) {
    throw new Error('MissingBlocks');
  }

  const hasQueryBlocks = event.textractResponse.Blocks.some((block) => block.BlockType === 'QUERY');
  const hasQueryResultBlocks = event.textractResponse.Blocks.some((block) => block.BlockType === 'QUERY_RESULT');

  if (!hasQueryBlocks) {
    throw new Error('MissingQueryBlocks');
  }

  if (!hasQueryResultBlocks) {
    throw new Error('MissingQueryResultBlocks');
  }

  const queryBlock = event.textractResponse.Blocks.find((block) => 
    block.BlockType === 'QUERY'
    && block.Query?.Alias === event.alias);
  
  if (!queryBlock) {
    throw new Error('MissingQueryBlock');
  }

  if (!queryBlock?.Relationships) {
    throw new Error('MissingQueryRelationships');
  }

  const queryBlockAnswer = queryBlock.Relationships.find((relationship) => relationship.Type === 'ANSWER');

  if (!queryBlockAnswer) {
    throw new Error('MissingQueryBlockAnswer');
  }

  if (!queryBlockAnswer.Ids) {
    throw new Error('MissingQueryBlockAnswerIds');
  }

  const queryBlockAnswerId = queryBlockAnswer.Ids[0];
  const queryResultBlock = event.textractResponse.Blocks.find((block) => block.Id === queryBlockAnswerId);

  if (!queryResultBlock) {
    throw new Error('MissingQueryResultBlock');
  }

  if (!queryResultBlock.Text) {
    throw new Error('MissingQueryResultBlockText');
  }

  console.log(JSON.stringify(queryResultBlock, null, 2));
  return queryResultBlock.Text;
}