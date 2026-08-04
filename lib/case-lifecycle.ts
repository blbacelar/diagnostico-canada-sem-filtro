const immutableReviewStatuses = new Set(["approved", "sending", "sent", "archived"]);

export function isReviewImmutable(status: string) {
  return immutableReviewStatuses.has(status);
}
