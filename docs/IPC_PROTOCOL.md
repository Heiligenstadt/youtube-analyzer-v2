# IPC Protocol Documentation - YouTube Analyzer

## Overview

Communication between client and server via REST API.

**Protocol:** HTTP/HTTPS  
**Format:** JSON  
**Base URL:** `http://localhost:3000/api`

---

## Data Flow Diagram
```
Client                           Server
  │                                │
  │  POST /api/analyze             │
  │  { videoUrl, brandUrl }  ────►│
  │                                │─── Validate URL
  │                                │─── Fetch video data
  │                                │─── Run Agent 1 (Analyst)
  │                                │─── Run Agent 2 (Evaluator)
  │                                │─── Cache in Redis
  │                                │
  │◄──── { sessionId, insights }   │
  │                                │
  │  POST /api/chat                │
  │  { sessionId, message }   ────►│
  │                                │─── Load cached context
  │                                │─── Run Agent 1 with history
  │                                │─── Run Agent 2 (Evaluator)
  │                                │─── Update Redis
  │                                │
  │◄──── { reply }                 │
```

---

## API Endpoints

### 1. POST /api/analyze

**Purpose:** Analyze a YouTube video for brand relevance

**Request Schema:**

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `videoUrl` | `string` | ✅ Yes | Valid YouTube URL | `"https://youtube.com/watch?v=dQw4w9WgXcQ"` |
| `brandUrl` | `string` | ✅ Yes | Brand's about page | `"https://www.aloyoga.com/pages/we-are-alo"` |

**Request Example:**
```json
{
  "videoUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "brandUrl": "https://www.aloyoga.com/pages/we-are-alo"
}
```

**Response Schema (Success - 200):**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `sessionId` | `string` | ✅ Yes | Unique session identifier |
| `relevance` | `"high" \| "medium" \| "low" \| "none"` | ✅ Yes | Brand relevance level |
| `insights` | `AnalysisInsights` | ✅ Yes | Analysis details (see below) |

**AnalysisInsights Object:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `summary` | `string` | ✅ Yes | Brief summary of findings |
| `sentiment` | `"positive" \| "neutral" \| "negative"` | ✅ Yes | Overall sentiment |
| `keyPoints` | `string[]` | ✅ Yes | Array of key insights (3-5 items) |
| `videoStats` | `VideoStats` | ⚠️ Optional | Video statistics |
| `draftComment` | `string` | ⚠️ Optional | Suggested comment (if requested) |

**VideoStats Object:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `views` | `number` | ✅ Yes | View count |
| `likes` | `number` | ✅ Yes | Like count |
| `comments` | `number` | ✅ Yes | Comment count |

**Success Response Example:**
```json
{
  "sessionId": "sess_abc123xyz",
  "relevance": "high",
  "insights": {
    "summary": "Positive product review featuring Nike running shoes with detailed performance analysis.",
    "sentiment": "positive",
    "keyPoints": [
      "Mentions Nike Air Zoom Pegasus at 3:42",
      "Compares favorably to Adidas and Brooks competitors",
      "Highlights breathability and comfort for long runs",
      "Shows product prominently in running footage"
    ],
    "videoStats": {
      "views": 125000,
      "likes": 8500,
      "comments": 342
    }
  }
}
```

**Error Responses:**

| Status Code | Error Type | Response Schema |
|-------------|------------|-----------------|
| 400 | Invalid URL | `{ "error": string }` |
| 404 | Video Not Found | `{ "error": string }` |
| 500 | Server Error | `{ "error": string }` |

**Error Response Examples:**
```json
// 400 Bad Request
{
  "error": "Invalid YouTube URL format"
}

// 404 Not Found
{
  "error": "Video not found or unavailable"
}

// 500 Internal Server Error
{
  "error": "Failed to analyze video: OpenAI API rate limit exceeded"
}
```

---

### 2. POST /api/chat

**Purpose:** Ask follow-up questions about a previously analyzed video

**Request Schema:**

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `sessionId` | `string` | ✅ Yes | Session ID from /api/analyze | `"sess_abc123xyz"` |
| `message` | `string` | ✅ Yes | User's follow-up question | `"Tell me more about the negative comments"` |

**Request Example:**
```json
{
  "sessionId": "sess_abc123xyz",
  "message": "What specific features did they praise?"
}
```

**Response Schema (Success - 200):**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `reply` | `string` | ✅ Yes | Agent's response to the question |
| `draftComment` | `string` | ⚠️ Optional | If user requested a draft comment |

**Success Response Example:**
```json
{
  "reply": "The reviewer specifically praised three features: 1) The React foam cushioning for responsiveness, 2) The breathable mesh upper for temperature control, and 3) The wider toe box compared to previous models. They mentioned these features made it their 'go-to shoe for marathon training.'"
}
```

**Error Responses:**

| Status Code | Error Type | Response Schema |
|-------------|------------|-----------------|
| 400 | Missing Session ID | `{ "error": string }` |
| 404 | Session Not Found | `{ "error": string }` |
| 410 | Session Expired | `{ "error": string }` |
| 500 | Server Error | `{ "error": string }` |

**Error Response Examples:**
```json
// 400 Bad Request
{
  "error": "sessionId is required"
}

// 404 Not Found
{
  "error": "Session not found. Please analyze a video first."
}

// 410 Gone
{
  "error": "Session expired. Please analyze the video again."
}
```

---

## TypeScript Type Definitions

**For your codebase:**
```typescript
// Request Types
export interface AnalyzeRequest {
  videoUrl: string;
  brandName: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

// Response Types
export type RelevanceLevel = 'high' | 'medium' | 'low' | 'none';
export type SentimentType = 'positive' | 'neutral' | 'negative';

export interface VideoStats {
  views: number;
  likes: number;
  comments: number;
}

export interface AnalysisInsights {
  summary: string;
  sentiment: SentimentType;
  keyPoints: string[];
  videoStats?: VideoStats;
  draftComment?: string;
}

export interface AnalyzeResponse {
  sessionId: string;
  relevance: RelevanceLevel;
  insights: AnalysisInsights;
}

export interface ChatResponse {
  reply: string;
  draftComment?: string;
}

export interface ErrorResponse {
  error: string;
}
```

---

## Internal Data Flow (Server-Side)

### Session Storage Schema (Redis)

**Key Pattern:** `session:{sessionId}:{type}`

| Redis Key | Type | TTL | Description |
|-----------|------|-----|-------------|
| `session:{id}:meta` | `SessionMeta` | 24h | Session metadata |
| `session:{id}:insights` | `AnalysisInsights` | 24h | Initial analysis results |
| `session:{id}:chat` | `ChatMessage[]` | 24h | Chat history array |
| `video:{videoId}:data` | `VideoData` | 1h | Raw video data cache (optional) |

**SessionMeta Object:**

| Property | Type | Description |
|----------|------|-------------|
| `brandName` | `string` | Brand being analyzed |
| `videoUrl` | `string` | Original video URL |
| `videoId` | `string` | Extracted YouTube video ID |
| `analyzedAt` | `string` | ISO timestamp |

**ChatMessage Object:**

| Property | Type | Description |
|----------|------|-------------|
| `role` | `"user" \| "assistant"` | Message sender |
| `content` | `string` | Message text |
| `timestamp` | `string` | ISO timestamp |

**VideoData Object (cached):**

| Property | Type | Description |
|----------|------|-------------|
| `chunks` | `string[]` | Transcript chunks |
| `comments` | `Comment[]` | Top comments |
| `stats` | `VideoStats` | Video statistics |

**Comment Object:**

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Comment text |
| `author` | `string` | Commenter name |
| `likes` | `number` | Comment likes |
| `publishedAt` | `string` | ISO timestamp |

---

## Request Validation Rules

### /api/analyze

| Field | Validation | Error Message |
|-------|------------|---------------|
| `videoUrl` | Must match YouTube URL regex | "Invalid YouTube URL format" |
| `videoUrl` | Cannot be empty | "videoUrl is required" |
| `brandName` | Cannot be empty | "brandName is required" |
| `brandName` | Max 100 characters | "brandName too long (max 100 chars)" |

### /api/chat

| Field | Validation | Error Message |
|-------|------------|---------------|
| `sessionId` | Cannot be empty | "sessionId is required" |
| `sessionId` | Must exist in Redis | "Session not found" |
| `message` | Cannot be empty | "message is required" |
| `message` | Max 1000 characters | "message too long (max 1000 chars)" |

---

## HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid input (URL, missing fields) |
| 404 | Not Found | Video not found, session not found |
| 410 | Gone | Session expired (past TTL) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server/API failures |
| 503 | Service Unavailable | External API down (YouTube, OpenAI) |

---

## Example Client Usage (TypeScript)
```typescript
// Analyze a video
async function analyzeVideo(videoUrl: string, brandName: string) {
  const response = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoUrl, brandName })
  });
  
  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error);
  }
  
  const data: AnalyzeResponse = await response.json();
  return data;
}

// Chat follow-up
async function chatFollowUp(sessionId: string, message: string) {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  });
  
  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error);
  }
  
  const data: ChatResponse = await response.json();
  return data;
}

// Usage
try {
  const analysis = await analyzeVideo(
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
    'Nike'
  );
  
  console.log('Session:', analysis.sessionId);
  console.log('Relevance:', analysis.relevance);
  console.log('Summary:', analysis.insights.summary);
  
  const followUp = await chatFollowUp(
    analysis.sessionId,
    'What did commenters say about durability?'
  );
  
  console.log('Reply:', followUp.reply);
  
} catch (error) {
  console.error('Error:', error.message);
}
```

---

## Rate Limiting (Future)

**Not implemented in MVP, but document for interview:**

| Endpoint | Limit | Window | Response |
|----------|-------|--------|----------|
| /api/analyze | 10 requests | per hour | 429 with `Retry-After` header |
| /api/chat | 100 requests | per hour | 429 with `Retry-After` header |

---

## WebSocket Support (Future Enhancement)

**For interview discussion only:**

> "Currently using REST for simplicity. For production, I'd add WebSocket support for real-time streaming of agent reasoning steps, letting users see the analysis progress live."

**Potential Schema:**
```typescript
interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  step: 'fetching' | 'analyzing' | 'evaluating';
  message: string;
  progress?: number; // 0-100
}
```

---

## Summary Table: Complete API Reference

| Endpoint | Method | Request Properties | Response Properties | Errors |
|----------|--------|-------------------|---------------------|--------|
| `/api/analyze` | POST | `videoUrl`, `brandName` | `sessionId`, `relevance`, `insights` | 400, 404, 500 |
| `/api/chat` | POST | `sessionId`, `message` | `reply`, `draftComment?` | 400, 404, 410, 500 |

---
