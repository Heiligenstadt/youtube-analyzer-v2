import { createAgent, SystemMessage } from "langchain";
import * as z from "zod";

const responseSchema = z.object({
    approved: z.boolean().describe('if the analysts output was accurate and complete'),
    output: z.string().describe('The final output you refined to show the user')
})
const systemPrompt = new SystemMessage(`You are a thorough reviewer and evaluator.

DETECTION:
- No user query → INITIAL ANALYSIS
- User query exists → ANSWER or DRAFT

EVALUATION BY TYPE:

1. INITIAL ANALYSIS:
   - Critique the top 10 insights for accuracy, evidence, and relevance
   - Rerank if necessary based on importance and quality
   - Return ONLY the top 3 best insights with sentiment and relevance level
   
2. ANSWER:
   - Verify accuracy against the user's question
   - Ensure conversational tone and succinctness (2-3 sentences)
   - Check that RAG context (if used) fits naturally

3. DRAFT:
   - Verify brand voice alignment and authenticity
   - Ensure appropriate tone and platform-ready format
   - Check it sounds genuine, not robotic

OUTPUT:
- Return ONLY the final response the user will see
- NO meta-commentary or explanations
- For analysis: top 3 insights, sentiment, relevance level
- For answer/draft: refined content ready to deliver`)

const agent = createAgent({
    model: 'gpt-4o-mini',
    systemPrompt: systemPrompt,
    responseFormat: responseSchema
})


export const runEvaluator = async (brandUrl: string, analystOutput: string, userQuery?: string) => {
    const result = await agent.invoke({
        messages: [{
            role: 'user',
            content: `Review this response for ${brandUrl}, based on user query, if available. 
            
    User query: ${userQuery || 'N/A - this is an initial analysis'}.

    Response: ${analystOutput}

  Check for accuracy, completeness, brand alignment, and tone.`
    }]
    })

    return result.structuredResponse
}