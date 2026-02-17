import { getSubtitles } from 'youtube-caption-extractor';                 
import { chunk } from './chunking.js';

export const fetchTranscriptChunks = async (videoId: string): Promise<string[] | null> => {
    try{
        const response = await fetch(                                                                                                                  
            `https://api.supadata.ai/v1/transcript?url=https://youtu.be/${videoId}`,                                                                   
            { headers: { 'x-api-key': process.env.SUPADATA_API_KEY! } }                                                                                  
          );                                                                                                                                             
          const data = await response.json();                                                                                                            
          const text = data.content.map((t: { text: string }) => t.text).join(' ');

    if (!text){
        throw new Error('there was an error retrieving transcript from video link');
    }
    
    const chunked = await chunk(text, 1000);
    return chunked;

    }catch(error){
        console.error('there was an error retrieving transcript from video link', error)
        return null;
    }
}