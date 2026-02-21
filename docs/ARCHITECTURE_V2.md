# Parallel Multi-Agent Architecture V2

## Overview

Optimized architecture that separates data organization from brand interpretation, enabling parallel processing and minimizing expensive RAG calls.

---

## Current Architecture (Baseline)
```
User Input → Data Fetch (2s)
    ↓
Analysis Agent (24s)
- Reads all data sequentially
- Calls RAG for brand context
- Generates top 10 insights
    ↓
Evaluator (4s)
- Narrows to top 3
    ↓
Output (Total: ~30s)
```

**Performance:**
- Initial analysis: 24s
- Total: 30s
- LLM calls: 2
- RAG calls: 1

---

## V2 Architecture (Parallel Multi-Agent)
```
User Input → Data Fetch (2s)
    ↓
┌────────────────────────────────────────────────────┐
│         PARALLEL PHASE (7-8s)                      │
│                                                     │
│  Agent 1: Chunk Summarizer (7s)                    │
│  - Organize transcript by themes/topics            │
│  - Extract timestamps for key mentions             │
│  - No brand context needed                         │
│                                                     │
│  Agent 2: Comment Categorizer (5s)                 │
│  - Group comments by sentiment/topic               │
│  - Count positive/negative/neutral                 │
│  - No brand context needed                         │
│                                                     │
│  Process 3: Stats Calculator (instant, hard-coded) │
│  - likeRatio = (likes / views) * 100               │
│  - commentRatio = (comments / views) * 100         │
│  - No LLM needed for basic math                    │
│                                                     │
│  Process 4: Brand Context Fetcher (3s)             │
│  - RAG call for brand values/keywords              │
│  - Runs in parallel (non-blocking)                 │
│                                                     │
└────────────────────────────────────────────────────┘
    ↓ (All complete at ~7-8s)
    ↓
Middle Manager Synthesis (4s)
- Apply brand lens to specialist outputs
- Rank insights by brand relevance
- Generate top 10 with evidence
    ↓
Evaluator (4s)
- Quality check
- Narrow to top 3
    ↓
Output (Total: ~15s)
```

**Performance:**
- Parallel phase: 7-8s (vs 24s sequential)
- Synthesis: 4s
- Evaluation: 4s
- Total: ~15s (vs 30s baseline)
- **Improvement: 50% faster**

**Cost:**
- LLM calls: 4 (vs 2) — 2 specialists + synthesizer + evaluator
- RAG calls: 1 (same)
- Specialist calls are cheaper (smaller prompts)
- **Net increase: ~50-80% more expensive per video**

---

## Agent Specifications

### Agent 1: Chunk Summarizer

**Purpose:** Organize transcript content by themes without brand interpretation

**System Prompt:**
```
You organize video transcript content by themes and topics.

Respond with JSON:
{
  "themes": [
    {
      "topic": "Product Quality",
      "mentions": [
        { "timestamp": "3:42", "summary": "Leggings pilling after first wash" },
        { "timestamp": "5:30", "summary": "Comparison with competitor quality" }
      ]
    }
  ],
  "keyTerms": ["leggings", "quality", "durability", "pricing"],
  "overallFocus": "Product review focusing on quality vs price"
}

Rules:
- Extract themes objectively (don't interpret brand relevance)
- Include all timestamps where themes appear
- Identify key product names, features, concerns
- Don't assess sentiment - just organize facts
```

**Output Schema:**
```typescript
{
  themes: [{
    topic: string,
    mentions: [{ timestamp: string, summary: string }]
  }],
  keyTerms: string[],
  overallFocus: string
}
```

**Model Config:**
```typescript
{
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 800
}
```

---

### Agent 2: Comment Categorizer

**Purpose:** Group and summarize comments by sentiment and topic

**System Prompt:**
```
You categorize comments by sentiment and topic.

Respond with JSON:
{
  "sentimentBreakdown": {
    "positive": 12,
    "neutral": 10,
    "negative": 28
  },
  "positiveThemes": [
    { "theme": "Style/Aesthetics", "count": 8, "examples": ["love the look", "so cute"] },
    { "theme": "Comfort", "count": 4, "examples": ["feels great", "soft material"] }
  ],
  "negativeThemes": [
    { "theme": "Durability", "count": 15, "examples": ["pilling after one wash", "fell apart"] },
    { "theme": "Pricing", "count": 10, "examples": ["too expensive", "not worth it"] }
  ],
  "questions": [
    { "topic": "Sizing", "count": 5, "examples": ["do they run small?", "what size?"] }
  ]
}

Rules:
- Count accurately
- Group similar concerns together
- Provide representative examples
- Don't interpret brand relevance - just organize
```

**Output Schema:**
```typescript
{
  sentimentBreakdown: {
    positive: number,
    neutral: number,
    negative: number
  },
  positiveThemes: [{ theme: string, count: number, examples: string[] }],
  negativeThemes: [{ theme: string, count: number, examples: string[] }],
  questions: [{ topic: string, count: number, examples: string[] }]
}
```

**Model Config:**
```typescript
{
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 600
}
```

---

### Process 3: Stats Calculator (Hard-coded)

**Purpose:** Calculate engagement metrics instantly — no LLM needed for basic math

**Implementation:**
```typescript
interface VideoStats {
  viewCount: string;
  likeCount: string;
  commentCount: string;
}

export function calculateStats(stats: VideoStats) {
  const views = parseInt(stats.viewCount);
  const likes = parseInt(stats.likeCount);
  const comments = parseInt(stats.commentCount);

  const likeRatio = (likes / views) * 100;
  const commentRatio = (comments / views) * 100;

  return {
    views,
    likes,
    comments,
    likeRatio: likeRatio.toFixed(2),
    likeRatioBenchmark: likeRatio > 5
      ? "above average (typical: 3-5%)"
      : "average or below",
    commentRatio: commentRatio.toFixed(2),
    commentRatioBenchmark: commentRatio > 0.2
      ? "high engagement (typical: 0.1-0.2%)"
      : "average engagement",
    reach: views < 10000 ? "small"
      : views < 100000 ? "mid-tier"
      : "large"
  };
}
```

**Why hard-coded instead of an agent:**
- Stats are deterministic — same input always produces same output
- Zero latency vs 3-5s for an LLM call
- Zero cost vs ~$0.01 per call
- No hallucination risk on simple math

---

### Process 4: Brand Context Fetcher

**Purpose:** Retrieve brand values and keywords while specialists work

**Implementation:**
```typescript
async function fetchBrandContext(brandName: string) {
  const context = await brandKnowledge.invoke({
    query: `What are ${brandName}'s core brand values, unique differentiators, and key product features?`
  });

  return {
    brandName,
    values: context,
    fetchedAt: Date.now()
  };
}
```

This runs in parallel — not an LLM agent, just a RAG tool call.

---

### Agent 3: Middle Manager (Synthesizer)

**Purpose:** Apply brand lens to specialist outputs and rank insights

**System Prompt:**
```
You synthesize specialist analysis through a brand relevance lens.

You receive:
1. Organized transcript themes (from Chunk Summarizer)
2. Engagement metrics (from Stats Calculator)
3. Categorized comments (from Comment Categorizer)
4. Brand context and values

Your job: Apply brand context to rank the most relevant insights.

Respond with JSON:
{
  "response": "Top 10 ranked insights...",
  "usedTool": true,
  "responseType": "analysis"
}

Format your top 10 insights as:
1. Insight: [Title]
   - Relevance Level: [High/Medium/Low]
   - Sentiment: [Positive/Neutral/Negative/Mixed]
   - Key Points: [Evidence from specialist analyses with timestamps/data]
   - Brand Alignment: [How this relates to brand values]

Rules:
- Rank by strategic importance to the brand
- Cross-reference all three specialist outputs
- Use specific data points (timestamps, comment counts, metrics)
- Explain why each insight matters for THIS brand specifically
```

**Model Config:**
```typescript
{
  model: 'gpt-4o-mini',
  temperature: 0.7,
  tools: [brandKnowledge],
  maxTokens: 1500
}
```

---

## Implementation

### File Structure
```
server/
├── agents/
│   ├── specialists/
│   │   ├── chunkSummarizer.ts
│   │   └── commentCategorizer.ts
│   ├── synthesizer.ts
│   ├── evaluator.ts
│   └── chat.ts
├── utils/
│   └── calculateStats.ts
├── workflows/
│   └── parallelAnalysis.ts
└── server.ts
```

---

### Core Workflow

**File: `server/workflows/parallelAnalysis.ts`**
```typescript
import { chunkSummarizer } from '../agents/specialists/chunkSummarizer';
import { commentCategorizer } from '../agents/specialists/commentCategorizer';
import { calculateStats } from '../utils/calculateStats';
import { synthesizer } from '../agents/synthesizer';
import { evaluatorAgent } from '../agents/evaluator';
import { brandKnowledge } from '../tools/brandKnowledge';

export async function runParallelAnalysis(
  chunks: string[],
  comments: string[],
  stats: VideoStats,
  brandName: string
) {
  console.log('Starting parallel analysis...');

  // Stats are instant — calculate before Promise.all
  const statsAnalysis = calculateStats(stats);

  // PARALLEL PHASE — Launch all 3 async processes simultaneously
  const [chunkAnalysis, commentAnalysis, brandContext] =
    await Promise.all([
      // Agent 1: Organize chunks
      chunkSummarizer.invoke({
        messages: [{
          role: 'user',
          content: JSON.stringify({ chunks })
        }]
      }),
      // Agent 2: Categorize comments
      commentCategorizer.invoke({
        messages: [{
          role: 'user',
          content: JSON.stringify({ comments })
        }]
      }),
      // Process 4: Fetch brand context (RAG call)
      brandKnowledge.invoke({
        query: `What are ${brandName}'s core brand values, unique differentiators, and key product features?`
      })
    ]);

  console.log('Parallel phase complete');

  // SYNTHESIS PHASE — Apply brand lens to all outputs
  const synthesis = await synthesizer.invoke({
    messages: [{
      role: 'user',
      content: `Brand: ${brandName}

Brand Context:
${brandContext}

Transcript Themes:
${JSON.stringify(chunkAnalysis.structuredResponse)}

Engagement Metrics:
${JSON.stringify(statsAnalysis)}

Comment Analysis:
${JSON.stringify(commentAnalysis.structuredResponse)}

Synthesize top 10 ranked insights with brand relevance.`
    }]
  });

  console.log('Synthesis complete');

  // EVALUATION PHASE — Narrow to top 3
  const finalAnalysis = await evaluatorAgent.invoke({
    messages: [{
      role: 'user',
      content: synthesis.structuredResponse.response
    }]
  });

  console.log('Evaluation complete');

  return finalAnalysis;
}
```

---

### Specialist Agent Definitions

**File: `server/agents/specialists/chunkSummarizer.ts`**
```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import * as z from 'zod';

const ChunkSchema = z.object({
  themes: z.array(z.object({
    topic: z.string(),
    mentions: z.array(z.object({
      timestamp: z.string(),
      summary: z.string()
    }))
  })),
  keyTerms: z.array(z.string()),
  overallFocus: z.string()
});

const systemPrompt = `You organize video transcript content by themes and topics.

Respond with JSON:
{
  "themes": [
    {
      "topic": "Product Quality",
      "mentions": [
        { "timestamp": "3:42", "summary": "Leggings pilling after first wash" },
        { "timestamp": "5:30", "summary": "Comparison with competitor quality" }
      ]
    }
  ],
  "keyTerms": ["leggings", "quality", "durability", "pricing"],
  "overallFocus": "Product review focusing on quality vs price"
}

Rules:
- Extract themes objectively (don't interpret brand relevance)
- Include all timestamps where themes appear
- Identify key product names, features, concerns
- Don't assess sentiment - just organize facts`;

export const chunkSummarizer = createAgent({
  model: new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 800
  }),
  systemPrompt,
  responseFormat: ChunkSchema
});
```

**File: `server/agents/specialists/commentCategorizer.ts`**
```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import * as z from 'zod';

const CommentSchema = z.object({
  sentimentBreakdown: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number()
  }),
  positiveThemes: z.array(z.object({
    theme: z.string(),
    count: z.number(),
    examples: z.array(z.string())
  })),
  negativeThemes: z.array(z.object({
    theme: z.string(),
    count: z.number(),
    examples: z.array(z.string())
  })),
  questions: z.array(z.object({
    topic: z.string(),
    count: z.number(),
    examples: z.array(z.string())
  }))
});

const systemPrompt = `You categorize comments by sentiment and topic.

Respond with JSON:
{
  "sentimentBreakdown": {
    "positive": 12,
    "neutral": 10,
    "negative": 28
  },
  "positiveThemes": [
    { "theme": "Style/Aesthetics", "count": 8, "examples": ["love the look", "so cute"] },
    { "theme": "Comfort", "count": 4, "examples": ["feels great", "soft material"] }
  ],
  "negativeThemes": [
    { "theme": "Durability", "count": 15, "examples": ["pilling after one wash", "fell apart"] },
    { "theme": "Pricing", "count": 10, "examples": ["too expensive", "not worth it"] }
  ],
  "questions": [
    { "topic": "Sizing", "count": 5, "examples": ["do they run small?", "what size?"] }
  ]
}

Rules:
- Count accurately
- Group similar concerns together
- Provide representative examples
- Don't interpret brand relevance - just organize`;

export const commentCategorizer = createAgent({
  model: new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 600
  }),
  systemPrompt,
  responseFormat: CommentSchema
});
```

---

### Synthesizer Agent

**File: `server/agents/synthesizer.ts`**
```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { brandKnowledge } from '../tools/brandKnowledge';
import { ResponseSchema } from '../types';

const systemPrompt = `You synthesize specialist analysis through a brand relevance lens.

You receive:
1. Organized transcript themes (from Chunk Summarizer)
2. Engagement metrics (from Stats Calculator)
3. Categorized comments (from Comment Categorizer)
4. Brand context and values

Your job: Apply brand context to rank the most relevant insights.

Respond with JSON:
{
  "response": "Top 10 ranked insights...",
  "usedTool": true,
  "responseType": "analysis"
}

Format your top 10 insights as:
1. Insight: [Title]
   - Relevance Level: [High/Medium/Low]
   - Sentiment: [Positive/Neutral/Negative/Mixed]
   - Key Points: [Evidence from specialist analyses with timestamps/data]
   - Brand Alignment: [How this relates to brand values]

Rules:
- Rank by strategic importance to the brand
- Cross-reference all three specialist outputs
- Use specific data points (timestamps, comment counts, metrics)
- Explain why each insight matters for THIS brand specifically`;

export const synthesizer = createAgent({
  model: new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1500
  }),
  tools: [brandKnowledge],
  systemPrompt,
  responseFormat: ResponseSchema
});
```

---

### Endpoint Integration

**File: `server/server.ts`**
```typescript
import { runParallelAnalysis } from './workflows/parallelAnalysis';

app.post('/api/analyze', async (req, res) => {
  const { videoUrl, brandName } = req.body;

  try {
    // Validate URL
    const validation = validateYouTubeUrl(videoUrl);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Fetch data in parallel
    const [transcript, comments, stats] = await Promise.all([
      fetchVideoTranscript(videoUrl),
      fetchComments(videoUrl),
      fetchAnalytics(videoUrl)
    ]);

    const chunks = chunkText(transcript, 500);
    const topComments = comments.slice(0, 50);

    // Use parallel multi-agent workflow
    const finalAnalysis = await runParallelAnalysis(
      chunks,
      topComments,
      stats,
      brandName
    );

    // Cache results
    const sessionId = generateSessionId();
    await redis.set(`session:${sessionId}:insights`,
      JSON.stringify(finalAnalysis), { ex: 86400 });
    await redis.set(`session:${sessionId}:videoData`,
      JSON.stringify({ chunks, comments: topComments, stats, brandName }),
      { ex: 86400 });

    res.json({
      id: sessionId,
      finalAnalysis: finalAnalysis.structuredResponse.response
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});
```

---

## Feature Flag for Rollback

**Add to `.env`:**
```
USE_PARALLEL_ANALYSIS=true
```

**In endpoint:**
```typescript
const USE_PARALLEL = process.env.USE_PARALLEL_ANALYSIS === 'true';

const result = USE_PARALLEL
  ? await runParallelAnalysis(chunks, comments, stats, brandName)
  : await analysisAgent.invoke({ messages: [...] });
```

---

## Expected Performance

| Metric | Current (V1) | Parallel (V2) | Change |
|--------|-------------|---------------|--------|
| **Initial Analysis** | 24s | 15s | **38% faster** |
| **LLM Calls** | 2 | 4 | 2x more |
| **RAG Calls** | 1 | 1 | Same |
| **Cost per Video** | ~$0.10 | ~$0.15 | ~50% increase |
| **Quality** | Good | Better (structured) | Improved |

---

## Interview Talking Points

### Efficiency
> "Specialists don't need brand context — only the synthesizer does. This lets us parallelize data organization while fetching brand values, reducing RAG calls and total latency by 38%."

### Hard-coded vs LLM
> "Stats calculation is deterministic — same input, same output. Using an LLM for basic math adds 3-5s latency, costs money, and risks hallucination. We only use LLMs where we need reasoning."

### Scalability
> "Each specialist is independent and can be optimized separately. For TikTok videos, we can skip the chunk summarizer. For multi-video analysis, specialists can process different videos in parallel."

### Cost Awareness
> "The architecture is ~50% more expensive per video due to additional LLM calls, but each specialist call is cheaper. For batch jobs, prompt caching would reduce this significantly."

### Production Ready
> "Built with feature flags so we can A/B test performance vs cost, and roll back instantly if needed."

---

## Implementation Timeline

**Post-Conference (Feb 21-23):**
- Day 1: Implement specialists + calculateStats (3-4 hours with Cursor)
- Day 2: Implement synthesizer + workflow (3-4 hours)
- Day 3: Test, optimize, compare (2-3 hours)

**Total: ~10 hours with Cursor assistance**
