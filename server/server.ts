import dotenv from 'dotenv'
dotenv.config();
import express from 'express';
import type { Request, Response } from 'express';
import { redis, youtube } from './utils/clients.js';
import { validateUrlExistence } from './utils/validation.js';
import { fetchTranscriptChunks } from './utils/fetchTranscript.js';
import { fetchComments, fetchStats } from './utils/fetchAudience.js';
import { embedAndStore } from './tools/brand-knowledge.js';
import { runAnalyst} from './agents/analyst.js';
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

    const a1 = performance.now();  
    const analysis = await runAnalyst(chunkedText, comments, stats, brandUrl);
    console.log(`👨‍💼analyst: ${(performance.now() - a1).toFixed(0)}ms`);
    if (!analysis){
       return res.status(500).send('internal error')
    }

    const formattedAnalysis = analysis.response                                                                                                     


    const a2 = performance.now();
    const evaluation = await runEvaluator(brandUrl, formattedAnalysis)
    console.log(`👩‍💻evaluator: ${(performance.now() - a2).toFixed(0)}ms`);

    if (!evaluation){
        return res.status(500).send('internal error')
     }

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