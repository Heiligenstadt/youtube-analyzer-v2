import {ChatOpenAI, OpenAIClient} from '@langchain/openai'
import { OpenAIEmbeddings } from '@langchain/openai'
import {Pinecone} from '@pinecone-database/pinecone'
import {Redis} from '@upstash/redis'
import {google} from 'googleapis'
import dotenv from 'dotenv';
dotenv.config();

async function testConnections() {
    console.log('🧪 Testing API connections...\n');

try {
    const model = new ChatOpenAI({model: 'gpt-4o-mini'})
    await model.invoke('Say hi')
    console.log('✅ OpenAI: Connected')
}catch(error:any){
    console.error('❌ OpenAI: Failed -', error.message)
}

try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY!});
    const index = pc.Index(process.env.PINECONE_INDEX_NAME!)
    await index.describeIndexStats()
    console.log('✅ Pinecone: Connected')
}catch(error: any){
    console.error('❌ Pinecone: Failed -', error.message)
}

try{
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    await redis.set('test', 'hello');
    const result = await redis.get('test')
    console.log('✅ Upstash Redis: Connected')
}catch(error: any){
    console.log('❌ Upstash Redis: Failed -', error.message);
}

try{
    const youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY!
    })
    await youtube.videos.list({
        part: ['snippet'],
        id: ['dQw4w9WgXcQ'], 

    })
    console.log('✅ YouTube API: Connected');
} catch (error: any) {
  console.log('❌ YouTube API: Failed -', error.message);
}

console.log('\n✨ Connection test complete!');
}

testConnections();