import dotenv from 'dotenv'
dotenv.config();
import express from 'express';
import type { Request, Response } from 'express';
import { redis, youtube } from './utils/clients.js';
import { validateUrlExistence } from './utils/validation.js';
import { fetchTranscriptChunks } from './utils/fetchTranscript.js';
import { fetchComments, fetchStats } from './utils/fetchAudience.js';
import { embedAndStore } from './tools/brand-knowledge.js';
import { runAnalyst } from './agents/analyst.js';
import { runEvaluator } from './agents/evaluator.js';
import { createSession } from './utils/redis.js';

const app = express()
app.use(express.json())
const port = 3000

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!')
})

app.post('/api/analyze', async (req: Request, res: Response) => {

    const videoUrl = req.body.videoUrl;
    const brandUrl = req.body.brandUrl;
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

    const formattedAnalysis = analysis                                                                                                     
      .map(msg => `[${msg.type}]: ${msg.content}`)
      .join('\n\n');


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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})