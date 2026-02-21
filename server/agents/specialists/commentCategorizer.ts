import { createAgent } from "langchain";
import z from 'zod';

const CommentSummarySchema = z.object({
  summary: z.string()
});

const systemPrompt = `You summarize YouTube comments into a concise overview.

Write a short summary of what the audience is saying, organized by sentiment. Include:
- How many comments are positive, negative, and neutral
- What the main themes are for each sentiment
- 2 direct quote examples per sentiment (positive, negative, and questions)

Respond with JSON:
{
  "summary": "your summary here"
}

Rules:
- Write a cohesive summary, not a structured list
- Include the sentiment counts
- Pick the 2 most representative quotes per sentiment
- Don't interpret brand relevance - just summarize what people are saying`;

const agent = createAgent({
  model: 'gpt-4o-mini',
  systemPrompt,
  responseFormat: CommentSummarySchema
});

export const runCommentCategorizer = async (comments: string[]): Promise<string> => {
  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `Summarize these ${comments.length} comments:\n\n${JSON.stringify({ comments })}`
      }
    ]
  });

  return result.structuredResponse.summary;
};
