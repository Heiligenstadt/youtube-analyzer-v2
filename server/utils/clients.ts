import dotenv from 'dotenv'
dotenv.config();

import {google} from 'googleapis'
import { ChatOpenAI } from '@langchain/openai'
import {Pinecone} from '@pinecone-database/pinecone'
import {Redis} from '@upstash/redis'

//youtube
export const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY!
})

//openai
export const openai = new ChatOpenAI({model: 'gpt-4o-mini'})

//pinecone
export const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY!});
export const index = pc.index(process.env.PINECONE_INDEX_NAME!)

//redis
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})
