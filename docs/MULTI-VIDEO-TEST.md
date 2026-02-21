# Batch Video Analysis Test

## Goal

Test V1 vs V2 performance with 5 videos analyzed simultaneously to demonstrate V2's scalability advantage.

---

## Test Setup

**Test with 5 YouTube video URLs analyzing the same brand (e.g., "Alo Yoga")**

Create a test file: `server/test-batch.ts`

---

## Test Code Structure
```typescript
// Test URLs (5 videos about same brand)
const testUrls = [
  'https://youtu.be/7zeQWRyz_y4?si=HTMVLd1YRHKUz8_6',
  'https://youtu.be/ToLTGJLJwK4?si=ASNrD720Ab9CdCoS',
  'https://youtu.be/wDBSTHZFbVA?si=S1xs8aN6sWlxgQCJ',
  'https://youtu.be/N7VM_oDXG5A?si=0I799bDwzuiAxeqw',
  'https://youtu.be/12MC-yhSZso?si=B4MQkHTYZDlgWBxc'
];

const brandUrl = 'https://www.aloyoga.com/pages/we-are-alo';

// Test V1 Sequential Processing
console.time('V1 Sequential');
for (const url of testUrls) {
  await analyzeWithV1(url, brandName);
}
console.timeEnd('V1 Sequential');
// Expected: ~90s (5 videos × 17.9s each)

// Test V2 Parallel Processing  
console.time('V2 Parallel');
await Promise.all(
  testUrls.map(url => analyzeWithV2(url, brandName))
);
console.timeEnd('V2 Parallel');
// Expected: ~20s (all 5 videos run simultaneously)
```

---

## What to Implement

1. Import both V1 and V2 analysis functions
2. Run V1 test (sequential loop - one video at a time)
3. Run V2 test (Promise.all - all videos simultaneously)
4. Log timing results
5. Compare performance

---

## Expected Results

**V1:** ~90s total (processes sequentially)  
**V2:** ~20s total (processes in parallel)  
**Speedup:** ~4.5x faster

**This demonstrates V2's architectural advantage for batch processing, which is critical for Plot's use case of monitoring hundreds of videos daily.**

---

## File Location

Create: `server/test-batch.ts`

Run with: `npx tsx server/test-batch.ts`