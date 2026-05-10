// 4 chars ≈ 1 token (GPT-4 ballpark). Accurate enough for chunking without native deps.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
