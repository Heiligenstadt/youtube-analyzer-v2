import { createAgent, SystemMessage } from "langchain";
import { retrieve } from "../tools/brand-knowledge.js";

const tools =[retrieve];
const systemPrompt = new SystemMessage(
    `You analyze YouTube videos for brand relevance. 
    You have access to a tool that retrieves relevant brand knowledge based on brand's internal documents.
    Use the tool to help answer the user's query.`
)

const agent = createAgent({model: 'gpt-4o-mini', tools, systemPrompt })

export const runAnalyst = async (chunks: string[], comments: string[], stats: object, brandUrl: string) => {

const result = await agent.invoke({
    messages: [{
        role: 'user',
        content: `Analyze this video for ${brandUrl} relevance.
                                                                                                                                                 
  Transcript: ${chunks.join('\n')}                                                                                                               
                                                                                                                                                 
  Comments: ${comments.join('\n')}

  Stats: ${JSON.stringify(stats)}

  Determine brand relevance, sentiment, and key insights.`
    }
    ]
})

return result.messages
}