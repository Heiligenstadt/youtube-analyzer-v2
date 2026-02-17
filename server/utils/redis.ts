import { redis } from "./clients.js"

interface sessionInput {
        brandUrl: string,
        videoUrl: string,
        videoId: string,
        finalAnalysis: string,        // evaluation.output
        chunkedText: string[],        // for follow-up context
        comments: string[],
        stats: object
}

export const createSession = async (analystOutput: sessionInput ) => {
    const id = crypto.randomUUID();
    const {brandUrl, videoUrl, videoId, finalAnalysis, chunkedText, comments, stats} = analystOutput
    try {
        const pipe = redis.pipeline();
    pipe.set(`session:${id}:meta`, JSON.stringify({                                                                                                                                                
        brandUrl,                                                                                                                                                                                  
        videoUrl,
        videoId,
        analyzedAt: new Date().toISOString()
    }), { ex: 86400 });
    
    pipe.set(`session:${id}:insights`, finalAnalysis, { ex: 86400 });
    pipe.set(`session:${id}:data`, JSON.stringify({                                                                                                                                                
        chunkedText,                                                                                                                                                                                  
        comments,
        stats,
        analyzedAt: new Date().toISOString()
    }), { ex: 3600 });
    await pipe.exec()
}catch(error){
    console.error('there was a problem caching data to Redis', error);
}
    return id;
}

export const getSession = async (id: string) => {
   try{ const pipe = redis.pipeline();
    pipe.get(`session:${id}:meta`);
    pipe.get(`session:${id}:insights`);
    pipe.get(`session:${id}:data`);
    const [meta, insights, data] = await pipe.exec();

    if (!meta || !insights || !data){
        return null;
    }

    const parsedMeta = JSON.parse(meta as string);
    const parsedData = JSON.parse(data as string);
    return {parsedMeta, parsedData, insights}

   }catch(error){
    console.error('there was an error retrieving cached data', error)
    return null;
   }
}



