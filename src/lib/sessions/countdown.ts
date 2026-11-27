export function computeClockOffset(serverNowMs: number, clientNowMs: number): number {
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(clientNowMs)) return 0;
  return serverNowMs - clientNowMs;
}

export function estimateServerNow(clientNowMs: number, offset: number): number {
  if (!Number.isFinite(clientNowMs) || !Number.isFinite(offset)) return 0;
  return clientNowMs + offset;
}

export function remainingMs(endsAtMs: number, estimatedServerNowMs: number): number {
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(estimatedServerNowMs)) return 0;
  return Math.max(0, endsAtMs - estimatedServerNowMs);
}

export function secondsLeft(remainingMsValue: number): number {
  if (!Number.isFinite(remainingMsValue) || remainingMsValue <= 0) return 0;
  return Math.ceil(remainingMsValue / 1000);
}

export function isExpired(endsAtMs: number, estimatedServerNowMs: number): boolean {
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(estimatedServerNowMs)) return false;
  return estimatedServerNowMs >= endsAtMs;
}
