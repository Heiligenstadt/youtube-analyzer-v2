import dotenv from 'dotenv'
dotenv.config();

import { validateUrlExistence } from '../utils/validation.js';
import { fetchTranscriptChunks } from '../utils/fetchTranscript.js';
import { fetchComments, fetchStats } from '../utils/fetchAudience.js';
import { embedAndStore } from '../tools/brand-knowledge.js';
import { runAnalyst } from '../agents/analyst.js';
import { runChunkSummarizer } from '../agents/specialists/chunkSummarizer.js';
import { runCommentCategorizer } from '../agents/specialists/commentCategorizer.js';
import { calculateStats } from '../utils/calculateStats.js';
import { fetchBrandContext } from '../utils/fetchBrandContext.js';
import { runSynthesizer } from '../agents/synthesizer.js';
import { runEvaluator } from '../agents/evaluator.js';

const testUrls = [
  'https://youtu.be/7zeQWRyz_y4?si=HTMVLd1YRHKUz8_6',
  'https://youtu.be/ToLTGJLJwK4?si=ASNrD720Ab9CdCoS',
  'https://youtu.be/wDBSTHZFbVA?si=S1xs8aN6sWlxgQCJ'
];

const brandUrl = 'https://www.aloyoga.com/pages/we-are-alo';

// Shared data fetch for both V1 and V2
async function fetchVideoData(videoUrl: string) {
  const validation = await validateUrlExistence(videoUrl);
  if (!validation.videoId) throw new Error(`Invalid URL: ${videoUrl}`);

  const [chunks, comments, stats] = await Promise.all([
    fetchTranscriptChunks(validation.videoId),
    fetchComments(validation.videoId),
    fetchStats(validation.videoId)
  ]);

  if (!chunks || !comments || !stats) throw new Error(`Failed to fetch data for: ${videoUrl}`);
  return { chunks, comments, stats };
}

// V1: Sequential analyst + evaluator
async function analyzeV1(videoUrl: string, data: { chunks: string[], comments: string[], stats: object }) {
  const start = performance.now();
  const analysis = await runAnalyst(data.chunks, data.comments, data.stats, brandUrl);
  const evaluation = await runEvaluator(brandUrl, analysis.response);
  const time = performance.now() - start;
  console.log(`  V1 ${videoUrl.slice(-11)}: ${(time / 1000).toFixed(1)}s`);
  return { result: evaluation.output, time };
}

// V2: Parallel specialists + synthesizer + evaluator
async function analyzeV2(videoUrl: string, data: { chunks: string[], comments: string[], stats: object }) {
  const start = performance.now();
  const statsAnalysis = calculateStats(data.stats as any);

  const [videoSummary, commentSummary, brandProfile] = await Promise.all([
    runChunkSummarizer(data.chunks),
    runCommentCategorizer(data.comments),
    fetchBrandContext(brandUrl)
  ]);

  const synthesis = await runSynthesizer(videoSummary, statsAnalysis, commentSummary, brandProfile);
  const evaluation = await runEvaluator(brandUrl, synthesis.response);
  const time = performance.now() - start;
  console.log(`  V2 ${videoUrl.slice(-11)}: ${(time / 1000).toFixed(1)}s`);
  return { result: evaluation.output, time };
}

// Main test
async function runBatchTest() {
  console.log('Embedding brand knowledge...');
  await embedAndStore(brandUrl);
  console.log('Brand embedded.\n');

  // Pre-fetch video data sequentially (Supadata free tier rate limit)
  console.log('Fetching video data sequentially...');
  const fetchStart = performance.now();
  const fetchResults = [];
  for (let i = 0; i < testUrls.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 3000)); // 3s delay between fetches
    try {
      const data = await fetchVideoData(testUrls[i]!);
      fetchResults.push(data);
      console.log(`  Fetched ${testUrls[i]!.slice(-11)}`);
    } catch (err: any) {
      console.log(`  Skipping ${testUrls[i]!.slice(-11)}: ${err.message}`);
      fetchResults.push(null);
    }
  }

  // Filter out failed videos
  const validVideos: { url: string, data: { chunks: string[], comments: string[], stats: object } }[] = [];
  fetchResults.forEach((data, i) => {
    if (data) validVideos.push({ url: testUrls[i]!, data });
  });
  console.log(`Data fetched: ${validVideos.length}/${testUrls.length} videos in ${((performance.now() - fetchStart) / 1000).toFixed(1)}s\n`);

  // V1: Sequential
  console.log('=== V1 SEQUENTIAL ===');
  const v1Start = performance.now();
  const v1Results: { result: string, time: number }[] = [];
  for (const video of validVideos) {
    const result = await analyzeV1(video.url, video.data);
    v1Results.push(result);
  }
  const v1Total = (performance.now() - v1Start) / 1000;
  console.log(`V1 Total: ${v1Total.toFixed(1)}s\n`);

  // V2: Parallel
  console.log('=== V2 PARALLEL ===');
  const v2Start = performance.now();
  const v2Results = await Promise.all(
    validVideos.map(video => analyzeV2(video.url, video.data))
  );
  const v2Total = (performance.now() - v2Start) / 1000;
  console.log(`V2 Total: ${v2Total.toFixed(1)}s\n`);

  // Summary
  console.log('=== RESULTS ===');
  console.log(`V1 Sequential: ${v1Total.toFixed(1)}s`);
  console.log(`V2 Parallel:   ${v2Total.toFixed(1)}s`);
  console.log(`Speedup:       ${(v1Total / v2Total).toFixed(1)}x faster\n`);

  validVideos.forEach((video, i) => {
    console.log(`\n--- ${video.url.slice(-11)} ---`);
    console.log(`V1: ${v1Results[i]!.result}\n`);
    console.log(`V2: ${v2Results[i]!.result}`);
  });
}

runBatchTest().catch(console.error);
