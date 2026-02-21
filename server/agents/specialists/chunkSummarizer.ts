import { createAgent } from "langchain";
import z from 'zod';

const VideoSummarySchema = z.object({
  summary: z.string()
});

const systemPrompt = `You summarize video transcripts into a clear, cohesive overview.

You receive transcript chunks from a video. Write a single summary of the entire video that captures:
- What the video is about overall
- Key topics, products, and brands mentioned
- What the creator's opinions and experiences were
- Any notable moments or claims

Respond with JSON:
{
  "summary": "your summary here"
}

Rules:
- Write a cohesive narrative, not a list of bullet points
- Preserve specific names, products, and details
- Don't interpret sentiment or brand relevance - just summarize what was said
- Keep it thorough but concise`;

const agent = createAgent({
  model: 'gpt-4o-mini',
  systemPrompt,
  responseFormat: VideoSummarySchema
});

export const runChunkSummarizer = async (chunks: string[]): Promise<string> => {
  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `Summarize this video transcript:\n\n${chunks.join('\n')}`
      }
    ]
  });

  return result.structuredResponse.summary;
};
