import dotenv from 'dotenv'
dotenv.config();

import { validateUrlExistence } from '../utils/validation.js'
import { fetchTranscriptChunks } from '../utils/fetchTranscript.js'
import { runChunkSummarizer } from '../agents/specialists/chunkSummarizer.js'

const url = 'https://www.youtube.com/watch?v=jKpEY4cmss8'

const validation = await validateUrlExistence(url);
console.log('Validation:', validation);

if (validation.videoId) {
  const chunks = await fetchTranscriptChunks(validation.videoId);
  console.log(`Fetched ${chunks.length} chunks\n`);

  console.time('Chunk Summarizer');
  const summaries = await runChunkSummarizer(chunks);
  console.timeEnd('Chunk Summarizer');

  console.log(`\nGot ${summaries.length} summaries\n`);

  chunks.forEach((chunk, i) => {
    console.log(`--- Chunk ${i} ---`);
    console.log(`Original (${chunk.length} chars): ${chunk.slice(0, 100)}...`);
    console.log(`Summary: ${summaries[i]}\n`);
  });
}
