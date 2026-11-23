export function isHostClaims(claims: unknown): boolean {
  if (claims === null || typeof claims !== 'object') return false;
  const values = claims as { sub?: unknown; is_anonymous?: unknown };
  return typeof values.sub === 'string' && values.sub.length > 0 && values.is_anonymous !== true;
}
