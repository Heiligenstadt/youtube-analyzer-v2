import { createAgent } from "langchain";
import z from 'zod';

const SynthesisResponseSchema = z.object({
  response: z.string(),
  responseType: z.enum(['analysis'])
});

const systemPrompt = `You analyze YouTube videos for brand relevance.

You receive a video summary, comment summary, engagement metrics, and a brand profile. Write 3 different versions of a short analysis for a brand team member.

Each version should cover the same key findings but with a different angle:
- Version 1: Focus on what the creator said about the brand
- Version 2: Focus on how the audience reacted
- Version 3: Focus on opportunities and risks for the brand

Respond with JSON:
{
  "response": "Version 1: ... \n\nVersion 2: ... \n\nVersion 3: ...",
  "responseType": "analysis"
}

Rules:
- Write in a natural, conversational tone
- Ground each version in specific evidence (quotes, counts, metrics)
- Keep each version to 2-3 sentences
- Set responseType: "analysis"`;

const agent = createAgent({
  model: 'gpt-4o-mini',
  systemPrompt,
  responseFormat: SynthesisResponseSchema
});

export const runSynthesizer = async (
  videoSummary: string,
  stats: object,
  commentSummary: string,
  brandProfile: object
) => {
  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `Brand Profile:
${JSON.stringify(brandProfile)}

Video Summary:
${videoSummary}

Engagement Metrics:
${JSON.stringify(stats)}

Comment Summary:
${commentSummary}

Synthesize top 10 ranked insights with brand relevance.`
      }
    ]
  });

  return result.structuredResponse;
};
