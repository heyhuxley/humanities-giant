export type VoteCounts = [number, number, number, number];
export type AudiencePercentagesResult =
  | { notEnoughVotes: true; percentages: null }
  | { notEnoughVotes: false; percentages: [number, number, number, number] };

export function audiencePercentages(voteCounts: VoteCounts): AudiencePercentagesResult {
  const total = voteCounts.reduce((sum, count) => sum + count, 0);
  if (total < 3) return { notEnoughVotes: true, percentages: null };

  const percentages = voteCounts.map((count) => Math.floor((count * 100) / total));
  const remainders = voteCounts.map((count, index) => ({ index, remainder: (count * 100) % total }));
  const pointsLeft = 100 - percentages.reduce((sum, value) => sum + value, 0);
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; index < pointsLeft; index += 1) percentages[remainders[index].index] += 1;

  return { notEnoughVotes: false, percentages: percentages as [number, number, number, number] };
}
