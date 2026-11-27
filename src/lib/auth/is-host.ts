type AuthClaims = {
  sub?: unknown;
  is_anonymous?: unknown;
  app_metadata?: unknown;
};

function getAuthClaims(claims: unknown): AuthClaims | null {
  if (typeof claims !== 'object' || claims === null) return null;
  return claims as AuthClaims;
}

export function isAnonymousClaims(claims: unknown): boolean {
  return getAuthClaims(claims)?.is_anonymous === true;
}

export function isHostClaims(claims: unknown): boolean {
  const values = getAuthClaims(claims);
  if (
    values === null ||
    typeof values.sub !== 'string' ||
    values.sub.length === 0 ||
    isAnonymousClaims(values)
  ) {
    return false;
  }

  const metadata = values.app_metadata;
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'role' in metadata &&
    metadata.role === 'host'
  );
}
