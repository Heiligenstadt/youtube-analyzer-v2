import { createAgent, SystemMessage } from "langchain";
import { retrieve } from "../tools/brand-knowledge.js";
import z from 'zod'
import { chatSystemPrompt } from '../prompts.js';
import { ChatOpenAI } from "@langchain/openai";

interface ChatMessage {                                                                                                                                                                        
    role: 'user' | 'assistant',                                                                                                                                                                
    content: string                                                                                                                                                                            
}       

const ChatResponseSchema = z.object({
    response: z.string(),
    usedTool: z.boolean(),
    responseType: z.enum(['answer', 'draft'])
  });

const tools =[retrieve];

const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    maxTokens: 150,
})

const agent = createAgent({model, systemPrompt: chatSystemPrompt, responseFormat: ChatResponseSchema, tools})

export const runChat = async (cachedData: object, chatHistory: ChatMessage[], analysis: string, userMessage: string, brandUrl: string) => {

    const result = await agent.invoke({
        messages: [ 
            {
            role: 'user',
            content: `Context:
      Video data: ${JSON.stringify(cachedData)}
      Previous analysis:  ${analysis}
      Chat history: ${chatHistory.map(msg => `[${msg.role}]: ${msg.content}`).join('\n')}
      Brand: ${brandUrl}
   
      Question: ${userMessage}`
        }]
    })

    return result.structuredResponse
}