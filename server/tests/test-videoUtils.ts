import dotenv from 'dotenv'
dotenv.config();

import {validateUrlExistence} from './utils/validation.js'
import {fetchTranscriptChunks} from './utils/fetchTranscript.js'
import {fetchComments, fetchStats} from './utils/fetchAudience.js'
import { YoutubeTranscript } from 'youtube-transcript';

const raw = await YoutubeTranscript.fetchTranscript('jKpEY4cmss8', { lang: 'en' });  
  console.log('raw transcript:', raw.slice(0, 3));

const url = 'https://www.youtube.com/watch?v=jKpEY4cmss8'

const testValidateUrlExistence = await validateUrlExistence(url);
console.log('🔵validation', testValidateUrlExistence);

if (testValidateUrlExistence.videoId){
const testFetchTranscript = await fetchTranscriptChunks(testValidateUrlExistence.videoId);
console.log('🟠transcript chunks', testFetchTranscript)
const testFetchComments = await fetchComments(testValidateUrlExistence.videoId)
const testFetchStats = await fetchStats(testValidateUrlExistence.videoId)
console.log('💬comments', testFetchComments, '✅stats', testFetchStats)
}

