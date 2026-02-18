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

interface SessionMeta {
    brandUrl: string,
    videoUrl: string,
    videoId: string,
    analyzedAt: string
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
    pipe.lrange(`session:${id}:chat`, 0, -1);
    const [meta, insights, data, chat] = await pipe.exec();
    // console.log('📈meta:', meta, 'insights:', insights, 'data:', data, 'chat:', chat);   

    if (!meta || !insights || !data){
        return null;
    }

    const parsedChat = Array.isArray(chat)                                                                                                                                                         
      ? chat.map(msg => typeof msg === 'string' ? JSON.parse(msg) : msg)
      : [];
    return {meta: meta as SessionMeta, data, insights: insights as string, parsedChat}

   }catch(error){
    console.error('there was an error retrieving cached data', error)
    return null;
   }
}

export const updateChatHistory = async (id: string, userMessage?: string, agentResponse?: string) => {

    try{
    if (!id){
        throw new Error('no session ID provided')
    }
    if (!userMessage && !agentResponse){
       return false
    }
    await redis.rpush(
   `session:${id}:chat`,
      JSON.stringify({ role: 'user', content: userMessage }),
      JSON.stringify({ role: 'assistant', content: agentResponse })
    )

    return true;
}catch(error){
    console.error('there was an error updating chat history', error)
    return false;
   }
}


