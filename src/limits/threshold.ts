export const FREE_TIER_LOC_LIMIT = 5000; // starting number, adjust once you see real repos

export interface ThresholdCheckResult {
  allowed: boolean;
  totalLines: number;
  limit: number;
  message?: string;
}

export function checkThreshold(
  totalLines: number,
  isPaidUser: boolean
): ThresholdCheckResult {
  if (isPaidUser) {
    return { allowed: true, totalLines, limit: Infinity };
  }

  if (totalLines > FREE_TIER_LOC_LIMIT) {
    return {
      allowed: false,
      totalLines,
      limit: FREE_TIER_LOC_LIMIT,
      message: `This repo has ${totalLines} lines of code, over the free tier limit of ${FREE_TIER_LOC_LIMIT}. Upgrade to scan larger repos.`,
    };
  }

  return { allowed: true, totalLines, limit: FREE_TIER_LOC_LIMIT };
}