# YouTube Brand Analyzer - Architecture Specification

## Project Overview
A multi-agent system that analyzes YouTube videos for brand mentions and sentiment, then generates strategic engagement recommendations. Built for interview demonstration at Plot Technologies.

## Core Functionality
**Input:** YouTube video URL(s) + brand name  
**Output:** 
- Brand relevance analysis
- Sentiment assessment
- Engagement recommendations (draft comments/tweets)

**Key Feature:** User can ask follow-up questions about the analysis in a chat interface.

---

## Architecture

### System Components
```
User Input (video URL + brand)
    ↓
URL Validation (hard-coded function)
    ↓
Data Fetching (parallel - hard-coded functions)
├─ fetchVideoTranscript() → chunks
└─ fetchAudienceData() → comments + stats
    ↓
Agent 1: Analyst
├─ Tool: brand_knowledge (Pinecone RAG)
├─ Analyzes: video chunks, comments, stats with brand context
└─ Outputs: relevance assessment + insights
    ↓
Agent 2: Evaluator
├─ Reviews Agent 1's output
├─ Checks: accuracy, brand alignment, completeness
└─ Approves OR requests revision
    ↓
Cache in Redis (session-based)
    ↓
Return to User
    ↓
Chat Interface Enabled (follow-up questions)
```

---

## Agent Details

### Agent 1: Analyst (Worker Agent)
**Role:** Analyze video content for brand relevance

**Tools:**
- `brand_knowledge(query)` - RAG search in Pinecone for brand docs

**Input:**
- Video transcript chunks
- Comments data
- Video stats
- Brand name

**Output:**
- Relevance: high/medium/low/none
- Key insights (3-5 bullet points)
- Sentiment: positive/neutral/negative
- (Optional) Draft comment/tweet if user requests

**System Prompt:**
```
You analyze YouTube videos for brand relevance and sentiment.

Given video content, comments, and brand context:
1. Determine if the brand is mentioned or relevant
2. Assess the tone and sentiment
3. Provide actionable insights
4. If requested, draft an engaging comment or tweet

Use the brand_knowledge tool to understand brand values and voice.
```

### Agent 2: Evaluator (Quality Control Agent)
**Role:** Review Agent 1's output before showing to user

**Tools:** None (reviews only)

**Input:** Agent 1's analysis

**Output:** 
- Approve → send to user
- Reject → request revision with feedback

**System Prompt:**
```
You evaluate analysis quality before it reaches the user.

Check:
- Accuracy: Does the analysis match the data?
- Brand alignment: Does it reflect brand values?
- Completeness: Are all key points covered?
- Tone: Is it professional and helpful?

Either approve the output or request specific improvements.
```

---

## Tech Stack

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **LLM:** LangChain + OpenAI (gpt-4o-mini)
- **Vector DB:** Pinecone (text-embedding-3-small, 512 dimensions)
- **Cache:** Upstash Redis (session management)
- **APIs:** YouTube Data API v3, youtube-transcript library

### Frontend (Later)
- React (simple chat UI)
- Or just use Postman/curl for testing

---

## Folder Structure
```
youtube-analyzer/
├── server/
│   ├── agents/
│   │   ├── analyst.ts          # Agent 1
│   │   └── evaluator.ts        # Agent 2
│   ├── tools/
│   │   ├── brandKnowledge.ts   # Pinecone RAG tool
│   │   ├── fetchVideo.ts       # YouTube transcript fetcher
│   │   └── fetchAudience.ts    # Comments + stats fetcher
│   ├── utils/
│   │   ├── validation.ts       # URL validation
│   │   ├── chunking.ts         # Text chunking
│   │   └── redis.ts            # Redis connection
│   └── server.ts               # Express app
├── .env                         # API keys
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Data Flow

### 1. Initial Analysis Request
```typescript
POST /api/analyze
Body: { videoUrl: string, brandName: string }

Flow:
1. Validate URL format
2. Fetch data in parallel:
   - fetchVideoTranscript(url) → chunks
   - fetchAudienceData(url) → { comments, stats }
3. Invoke Agent 1 with:
   - Video chunks
   - Comments
   - Stats
   - Brand name (triggers RAG lookup)
4. Agent 2 evaluates Agent 1's output
5. Cache in Redis:
   - session:{sessionId}:insights → Agent 1 output
   - session:{sessionId}:videoData → raw chunks/comments
6. Return: { insights, relevance, sessionId }
```

### 2. Follow-up Chat
```typescript
POST /api/chat
Body: { message: string, sessionId: string }

Flow:
1. Load from Redis:
   - Cached insights
   - Chat history
   - Raw video data (if needed)
2. Invoke Agent 1 with:
   - User's question
   - Cached context
   - Chat history
3. Agent 2 evaluates response
4. Update Redis:
   - Append to chat history
5. Return: { reply }
```

---

## Database Strategy

### Redis (MVP - Session Cache)
**Keys:**
```
session:{sessionId}:meta → { brandName, videoUrl, analyzedAt }
session:{sessionId}:insights → Agent 1's initial analysis
session:{sessionId}:chat → Chat history array
video:{videoId}:data → { chunks, comments, stats } (optional cache)
```

**TTL:** 24 hours

### MongoDB (Production - Not MVP)
**Mention in interview:**
> "Currently using Redis for session caching. In production, I'd add MongoDB to:
> - Persist video metadata and analyses
> - Enable queries like 'show me all Nike videos from last week'
> - Prevent re-analyzing the same video
> - Track sentiment trends over time"

**Collections (future):**
- `videos` - Video metadata + analysis results
- `sessions` - User session history
- `users` - User accounts (if multi-user)

---

## API Endpoints

### `POST /api/analyze`
**Request:**
```json
{
  "videoUrl": "https://youtube.com/watch?v=...",
  "brandName": "Nike"
}
```

**Response:**
```json
{
  "sessionId": "sess_xyz123",
  "relevance": "high",
  "insights": {
    "summary": "Positive product review...",
    "sentiment": "positive",
    "keyPoints": [
      "Mentions Nike shoes at 3:42",
      "Compares favorably to competitors",
      "Shows product prominently"
    ]
  }
}
```

**Error Cases:**
- Invalid URL → 400
- Video not found → 404
- No brand relevance → 200 with relevance: "none"

### `POST /api/chat`
**Request:**
```json
{
  "sessionId": "sess_xyz123",
  "message": "Tell me more about the negative comments"
}
```

**Response:**
```json
{
  "reply": "The negative comments primarily focus on..."
}
```

---

## Environment Variables
```bash
# .env
OPENAI_API_KEY=sk-...
YOUTUBE_API_KEY=AIza...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=youtube-analyzer
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
PORT=3000
```

---

## Key Implementation Details

### 1. URL Validation (Simple Function)
```typescript
function validateYouTubeUrl(url: string): { valid: boolean; videoId?: string } {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? { valid: true, videoId: match[1] } : { valid: false };
}
```

### 2. Data Fetching (Hard-coded Functions)
```typescript
async function fetchVideoTranscript(url: string): Promise<string[]> {
  // Uses youtube-transcript library
  const transcript = await YoutubeTranscript.fetchTranscript(url);
  const fullText = transcript.map(t => t.text).join(' ');
  return chunkText(fullText, 500); // 500 words per chunk
}

async function fetchAudienceData(url: string) {
  // Uses YouTube Data API v3
  const { videoId } = validateYouTubeUrl(url);
  
  const stats = await youtube.videos.list({
    part: ['statistics'],
    id: [videoId]
  });
  
  const comments = await youtube.commentThreads.list({
    part: ['snippet'],
    videoId: videoId,
    maxResults: 100
  });
  
  return { stats, comments };
}
```

### 3. Brand Knowledge Tool (Pinecone RAG)
```typescript
import { tool } from 'langchain';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { z } from 'zod';

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.Index(process.env.PINECONE_INDEX_NAME);
const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

export const brandKnowledge = tool(
  async ({ query }) => {
    // Generate embedding
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // Search Pinecone
    const results = await index.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true
    });
    
    // Return relevant text
    return results.matches
      .map(match => match.metadata?.text || '')
      .join('\n\n');
  },
  {
    name: 'brand_knowledge',
    description: 'Search brand guidelines, values, and focus areas',
    schema: z.object({
      query: z.string().describe('What to search for in brand docs')
    })
  }
);
```

### 4. Agent Setup
```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';

const model = new ChatOpenAI({ 
  model: 'gpt-4o-mini',
  temperature: 0.7 
});

export const analystAgent = createAgent({
  model,
  tools: [brandKnowledge],
  systemPrompt: `You analyze YouTube videos for brand relevance...`
});

export const evaluatorAgent = createAgent({
  model,
  tools: [],
  systemPrompt: `You evaluate analysis quality...`
});
```

### 5. Redis Session Management
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export async function saveSession(sessionId: string, data: any) {
  await redis.set(`session:${sessionId}:insights`, JSON.stringify(data), {
    ex: 86400 // 24 hours
  });
}

export async function getSession(sessionId: string) {
  const data = await redis.get(`session:${sessionId}:insights`);
  return data ? JSON.parse(data as string) : null;
}
```

---

## Edge Cases & Error Handling

### Invalid URL
```typescript
if (!validateYouTubeUrl(videoUrl).valid) {
  return res.status(400).json({ 
    error: 'Invalid YouTube URL format' 
  });
}
```

### No Brand Relevance
```typescript
// Agent 1 determines no relevance
if (analysis.relevance === 'none') {
  return res.json({
    sessionId,
    relevance: 'none',
    insights: {
      summary: 'This video does not mention or relate to [brand].'
    }
  });
}
```

### Multiple Videos
```typescript
// For MVP: Accept one video at a time
// In production: Loop through array of URLs
```

---

## Build Order (Recommended)

### Day 1 (Feb 15): Foundation
1. ✅ Environment setup (DONE)
2. ✅ API connection tests (DONE)
3. Create data fetching functions
   - `tools/fetchVideo.ts`
   - `tools/fetchAudience.ts`
4. Test with real YouTube video

### Day 2 (Feb 16): Agents
1. Create brand knowledge tool
   - `tools/brandKnowledge.ts`
   - Upload sample brand doc to Pinecone
2. Build Agent 1 (Analyst)
   - `agents/analyst.ts`
3. Build Agent 2 (Evaluator)
   - `agents/evaluator.ts`
4. Test agent flow end-to-end

### Day 3 (Feb 17): API & Caching
1. Build Express endpoints
   - `POST /api/analyze`
   - `POST /api/chat`
2. Implement Redis caching
   - `utils/redis.ts`
3. Test full workflow

### Days 4-5 (Feb 20-23): Polish & Practice
1. Error handling
2. Logging
3. Code cleanup
4. Practice 1-hour rebuilds with Cursor

---

## Interview Talking Points

### Architecture Decisions
> "I separated data fetching from analysis. Simple functions handle API calls, while agents focus on intelligent decision-making with brand context via RAG."

### Cost Optimization
> "Agent 1 and 2 run sequentially to minimize LLM calls. I cache intermediate results in Redis so follow-up questions don't re-analyze the video."

### Production Thinking
> "For MVP, Redis handles session caching. In production, I'd add MongoDB for persistent storage, enabling features like 'show sentiment trends' and preventing duplicate analysis."

### RAG Design
> "I use Pinecone with text-embedding-3-small (512 dimensions) for brand knowledge. This lets Agent 1 understand brand values without hardcoding them."

### Multi-Agent Orchestration
> "Agent 2 acts as quality control, preventing bad outputs from reaching users. This 'chamber music' model ensures both agents contribute to the final result."

### Edge Cases
> "The system handles irrelevant videos gracefully - Agent 1 assesses relevance before deep analysis, saving tokens on off-topic content."

---

## Sample Brand Document (For Pinecone)
```text
Nike Brand Guidelines

Brand Values:
- Performance and innovation
- Athlete empowerment
- Sustainability and responsibility
- Inclusivity in sports

Product Focus:
- Running and training footwear
- Athletic apparel
- Performance technology (Air, React, Flyknit)

Brand Voice:
- Motivational and inspiring
- Direct and confident
- Athlete-focused

Key Messaging:
- "Just Do It" - overcoming challenges
- Innovation in performance
- Supporting athletes at all levels

Sustainability Initiatives:
- Move to Zero carbon emissions
- Sustainable materials (recycled polyester)
- Circular design principles

Engagement Guidelines:
- Respond to positive product reviews
- Address sustainability questions
- Engage with athletic achievement stories
- Avoid engaging with off-brand content
```

---

## Next Steps

1. **Save this document** as `ARCHITECTURE.md`
2. **Create brand doc** as `brand-guidelines.txt`
3. **Tomorrow morning:**
   - Start with `tools/fetchVideo.ts`
   - Test with a real YouTube URL
   - Build incrementally

**Good luck building! 🚀**