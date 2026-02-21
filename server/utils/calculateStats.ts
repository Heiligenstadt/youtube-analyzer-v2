interface VideoStats {
  viewCount?: string | null | undefined;
  likeCount?: string | null | undefined;
  commentCount?: string | null | undefined;
}

export function calculateStats(stats: VideoStats) {
  const views = parseInt(stats.viewCount || '0');
  const likes = parseInt(stats.likeCount || '0');
  const comments = parseInt(stats.commentCount || '0');

  const likePercentage = views > 0 ? (likes / views) * 100 : 0;
  const commentPercentage = views > 0 ? (comments / views) * 100 : 0;

  return {
    views,
    likes,
    comments,
    likePercentage: likePercentage.toFixed(2),
    likePercentageBenchmark: likePercentage > 5
      ? "above average (typical: 3-5%)"
      : "average or below",
    commentPercentage: commentPercentage.toFixed(2),
    commentPercentageBenchmark: commentPercentage > 0.2
      ? "high engagement (typical: 0.1-0.2%)"
      : "average engagement",
    reach: views < 10000 ? "small"
      : views < 100000 ? "mid-tier"
      : "large"
  };
}
