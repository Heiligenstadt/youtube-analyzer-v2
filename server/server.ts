import dotenv from 'dotenv'
dotenv.config();
import express from 'express';
import type { Request, Response } from 'express';
import { redis, youtube } from './utils/clients.js';
import { validateUrlExistence } from './utils/validation.js';
import { fetchTranscriptChunks } from './utils/fetchTranscript.js';
import { fetchComments, fetchStats } from './utils/fetchAudience.js';
import { embedAndStore } from './tools/brand-knowledge.js';
import { runChunkSummarizer } from './agents/specialists/chunkSummarizer.js';
import { runCommentCategorizer } from './agents/specialists/commentCategorizer.js';
import { calculateStats } from './utils/calculateStats.js';
import { fetchBrandContext } from './utils/fetchBrandContext.js';
import { runSynthesizer } from './agents/synthesizer.js';
import {runChat } from './agents/chat.js'
import { runEvaluator } from './agents/evaluator.js';
import { createSession, getSession, updateChatHistory} from './utils/redis.js';

const app = express()
app.use(express.json())
const port = 3000

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!')
})

app.post('/api/analyze', async (req: Request, res: Response) => {

    const {videoUrl} = req.body;
    const {brandUrl} = req.body;
    await embedAndStore(brandUrl)
    //validate video Url
    const videoObj = await validateUrlExistence(videoUrl)

    if (!videoObj.videoId){
        return res.status(400).send('Please enter a valid video url.')
    }
    const {videoId} = videoObj

    const start = performance.now(); 
    //fetch video data in parallel
    const [chunkedText, comments, stats ] = await Promise.all([
        fetchTranscriptChunks(videoId!).then(r => { console.log(`🍎transcript: ${(performance.now() - start).toFixed(0)}ms`); return r; }), 
        fetchComments(videoId!).then(r => { console.log(`🍊comments: ${(performance.now() - start).toFixed(0)}ms`); return r; }),
        fetchStats(videoId!).then(r => { console.log(`🍐stats: ${(performance.now() - start).toFixed(0)}ms`); return r; })
    ])

    if (!chunkedText || !comments ||!stats ){
        return res.status(400).send('Could not extract information from this video. Please submit another one.')
    }

    // Stats are instant — no LLM needed
    const statsAnalysis = calculateStats(stats!);

    // PARALLEL PHASE — specialists + brand profiler
    const p1 = performance.now();
    const [videoSummary, commentAnalysis, brandProfile] = await Promise.all([
        runChunkSummarizer(chunkedText).then(r => { console.log(`📝 chunk summarizer: ${(performance.now() - p1).toFixed(0)}ms`); return r; }),
        runCommentCategorizer(comments).then(r => { console.log(`💬 comment categorizer: ${(performance.now() - p1).toFixed(0)}ms`); return r; }),
        fetchBrandContext(brandUrl).then(r => { console.log(`🏷️ brand profiler: ${(performance.now() - p1).toFixed(0)}ms`); return r; })
    ]);
    console.log(`⚡ parallel phase: ${(performance.now() - p1).toFixed(0)}ms`);

    // SYNTHESIS PHASE — no tools, just reasoning
    const s1 = performance.now();
    const synthesis = await runSynthesizer(videoSummary, statsAnalysis, commentAnalysis, brandProfile);
    console.log(`🧠 synthesizer: ${(performance.now() - s1).toFixed(0)}ms`);

    if (!synthesis) {
        return res.status(500).send('internal error')
    }

    // EVALUATION PHASE
    const e1 = performance.now();
    const evaluation = await runEvaluator(brandUrl, synthesis.response);
    console.log(`👩‍💻 evaluator: ${(performance.now() - e1).toFixed(0)}ms`);

    if (!evaluation) {
        return res.status(500).send('internal error')
    }

    console.log(`🏁 total: ${(performance.now() - start).toFixed(0)}ms`);

    const finalAnalysis = evaluation.output
     
     const dataToCache = {brandUrl, videoUrl, videoId, finalAnalysis, chunkedText, comments, stats }
     const id = await createSession(dataToCache)

     return res.status(200).send({id, finalAnalysis})

})

app.post('/api/chat', async (req: Request, res: Response) => {
    const {sessionId} = req.body
    const {message} = req.body

    const cachedData = await getSession(sessionId);
    if (!cachedData){
        return res.status(404).send('No video data available. Please start over.')
    }

    const chatHistory = cachedData.parsedChat;
    const {brandUrl} = cachedData.meta;
    const data = cachedData.data
    const {insights} = cachedData
    
    const c1 = performance.now(); 
    const analystResponse = await runChat(data, chatHistory, insights, message, brandUrl)
    console.log(`💬 chat analyst: ${(performance.now() - c1).toFixed(0)}ms`);      
    console.log('🐸 analyst reponse', analystResponse)

    const responseText = analystResponse.response
    if (analystResponse.usedTool ||
        analystResponse.responseType === 'draft'){
            const c2 = performance.now();
            const finalEvaluation = await runEvaluator(brandUrl, responseText, message)
            console.log(`💬 chat evaluator: ${(performance.now() - c2).toFixed(0)}ms`);
            console.log('🐽 Evaluator used')
                await updateChatHistory(sessionId, message, finalEvaluation.output)
                return res.status(200).send(finalEvaluation.output)
        }else{
            await updateChatHistory(sessionId, message, responseText);
            return res.status(200).send(responseText);
        }
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})