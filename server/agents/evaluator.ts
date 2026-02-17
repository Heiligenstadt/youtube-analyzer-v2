import { createAgent, SystemMessage } from "langchain";
import * as z from "zod";

const responseSchema = z.object({
    approved: z.boolean().describe('if the analysts output was accurate and complete'),
    output: z.string().describe('The final output you refined to show the user')
})
const systemPrompt = new SystemMessage(`You are a thorough reviewer and evaluator. 
You are going to evaluate the analyst agent's output and make sure that the answer is accurate and correctly answers the user input. 
If it is not accurate and the reasoning is suspicious, you are going to refine the response. 
If it is accurate, make sure the output response is polite and concise, yet informative.
Do not write a meta-evaluation or commentary about the analysis. The output field should contain the final response the user will see — just the analysis 
itself, refined for clarity and tone.`)

const agent = createAgent({
    model: 'gpt-4o-mini',
    systemPrompt: systemPrompt,
    responseFormat: responseSchema
})


export const runEvaluator = async (brandUrl: string, analystOutput: string) => {
    const result = await agent.invoke({
        messages: [{
            role: 'user',
            content: `Review this analysis for ${brandUrl}.

  Analysis: ${analystOutput}

  Check for accuracy, completeness, brand alignment, and tone.`
    }]
    })

    return result.structuredResponse
}