const immutableReviewStatuses = new Set(["sending", "cancelled", "archived"]);

export function isReviewImmutable(status: string) {
  return immutableReviewStatuses.has(status);
}
