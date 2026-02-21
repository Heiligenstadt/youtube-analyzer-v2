import dotenv from 'dotenv'
dotenv.config();

import { validateUrlExistence } from '../utils/validation.js'
import { fetchComments } from '../utils/fetchAudience.js'
import { runCommentCategorizer } from '../agents/specialists/commentCategorizer.js'

const url = 'https://www.youtube.com/watch?v=jKpEY4cmss8'

const validation = await validateUrlExistence(url);
console.log('Validation:', validation);

if (validation.videoId) {
  const comments = await fetchComments(validation.videoId);
  console.log(`Fetched ${comments?.length} comments\n`);

  if (comments) {
    console.time('Comment Categorizer');
    const result = await runCommentCategorizer(comments);
    console.timeEnd('Comment Categorizer');

    console.log('\nSentiment Breakdown:', result.sentimentBreakdown);
    const total = result.sentimentBreakdown.positive + result.sentimentBreakdown.neutral + result.sentimentBreakdown.negative;
    console.log(`Total counted: ${total}/${comments.length}\n`);

    console.log('Positive Themes:');
    result.positiveThemes.forEach(t => console.log(`  ${t.theme} (${t.count}): ${t.examples.join(', ')}`));

    console.log('\nNegative Themes:');
    result.negativeThemes.forEach(t => console.log(`  ${t.theme} (${t.count}): ${t.examples.join(', ')}`));

    console.log('\nQuestions:');
    result.questions.forEach(t => console.log(`  ${t.topic} (${t.count}): ${t.examples.join(', ')}`));
  }
}
