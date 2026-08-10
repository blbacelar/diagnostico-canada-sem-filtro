const immutableReviewStatuses = new Set(["sending", "archived"]);

export function isReviewImmutable(status: string) {
  return immutableReviewStatuses.has(status);
}
