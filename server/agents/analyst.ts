import { createAgent, SystemMessage } from "langchain";
import { retrieve } from "../tools/brand-knowledge.js";
import z from 'zod'
import { analysisSystemPrompt} from '../prompts.js';

const AnalysisResponseSchema = z.object({
    response: z.string(),
    usedTool: z.boolean(),
    responseType: z.enum(['analysis', 'answer', 'draft'])
  });

const tools =[retrieve];

const agent = createAgent({model: 'gpt-4o-mini', systemPrompt: analysisSystemPrompt, responseFormat: AnalysisResponseSchema, tools})

export const runAnalyst = async (chunks: string[], comments: string[], stats: object, brandUrl: string) => {
const topComments = comments.slice(0, 50);
const result = await agent.invoke({
    messages: [
        {
            role: 'user',
            content: `Analyze this video for ${brandUrl} brand relevance:
          
          Transcript:
          ${chunks.join('\n')}
          
          Comments:
          ${topComments.join('\n')}
          
          Stats:
          ${JSON.stringify(stats)}`
          }
    ]
})

return result.structuredResponse
}

