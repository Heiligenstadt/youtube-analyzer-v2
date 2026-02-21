import { createAgent } from "langchain";
import { retrieve } from "../tools/brand-knowledge.js";
import z from 'zod';

const BrandProfileSchema = z.object({
  brandName: z.string(),
  topValues: z.array(z.string()).max(3),
  brandTone: z.string()
});

const systemPrompt = `You extract a concise brand profile from brand information.

You have access to brand_knowledge tool. Use it to look up the brand.

Respond with JSON:
{
  "brandName": "Exact brand name with correct spelling",
  "topValues": ["value1", "value2", "value3"],
  "brandTone": "One sentence describing the brand's overall tone and positioning"
}

Rules:
- brandName must be the exact, correctly spelled brand name
- topValues: the 3 most important brand values or differentiators
- brandTone: a brief description of how the brand presents itself`;

const agent = createAgent({
  model: 'gpt-4o-mini',
  systemPrompt,
  responseFormat: BrandProfileSchema,
  tools: [retrieve]
});

export const fetchBrandContext = async (brandUrl: string) => {
  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `Extract brand profile for: ${brandUrl}`
      }
    ]
  });

  return result.structuredResponse;
};
