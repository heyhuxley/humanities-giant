export type LiveConnectionState = 'connecting' | 'live' | 'reconnecting';

export type LiveSessionSyncDeps = {
  subscribe(handlers: {
    onChange(): void;
    onStatus(status: 'subscribed' | 'error' | 'closed'): void;
  }): () => void;
  refresh(): void;
  setConnection(state: LiveConnectionState): void;
  timers: {
    setTimeout(
      callback: () => void,
      delay: number,
    ): ReturnType<typeof globalThis.setTimeout>;
    clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>): void;
    setInterval(
      callback: () => void,
      delay: number,
    ): ReturnType<typeof globalThis.setInterval>;
    clearInterval(handle: ReturnType<typeof globalThis.setInterval>): void;
  };
  options?: { debounceMs?: number; pollMs?: number; heartbeatMs?: number };
};

export function createLiveSync(deps: LiveSessionSyncDeps): {
  start(): void;
  stop(): void;
  wake(): void;
} {
  const debounceMs = deps.options?.debounceMs ?? 300;
  const pollMs = deps.options?.pollMs ?? 5000;
  const heartbeatMs = deps.options?.heartbeatMs ?? 30000;
  let started = false;
  let live = false;
  let generation = 0;
  let unsubscribe: (() => void) | null = null;
  let debounceTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let pollTimer: ReturnType<typeof globalThis.setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof globalThis.setInterval> | null = null;

  function clearDebounce(): void {
    if (debounceTimer === null) return;
    deps.timers.clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  function clearPoll(): void {
    if (pollTimer === null) return;
    deps.timers.clearInterval(pollTimer);
    pollTimer = null;
  }

  function clearHeartbeat(): void {
    if (heartbeatTimer === null) return;
    deps.timers.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function refreshSafely(): void {
    try {
      deps.refresh();
    } catch {
      // Refresh failures are retried by later signals or polling.
    }
  }

  function startPoll(): void {
    if (pollTimer !== null) return;
    pollTimer = deps.timers.setInterval(() => {
      if (started) refreshSafely();
    }, pollMs);
  }

  function startHeartbeat(): void {
    if (heartbeatMs <= 0 || heartbeatTimer !== null) return;
    heartbeatTimer = deps.timers.setInterval(() => {
      if (!started || !live) return;
      clearDebounce();
      refreshSafely();
    }, heartbeatMs);
  }

  function scheduleRefresh(activeGeneration: number): void {
    if (!started || generation !== activeGeneration) return;
    clearDebounce();
    debounceTimer = deps.timers.setTimeout(() => {
      debounceTimer = null;
      if (started && generation === activeGeneration) refreshSafely();
    }, debounceMs);
  }

  function start(): void {
    if (started) return;
    started = true;
    generation += 1;
    const activeGeneration = generation;
    deps.setConnection('connecting');
    unsubscribe = deps.subscribe({
      onChange() {
        scheduleRefresh(activeGeneration);
      },
      onStatus(status) {
        if (!started || generation !== activeGeneration) return;
        if (status === 'subscribed') {
          live = true;
          deps.setConnection('live');
          clearPoll();
          startHeartbeat();
          clearDebounce();
          refreshSafely();
          return;
        }

        live = false;
        clearHeartbeat();
        deps.setConnection('reconnecting');
        startPoll();
      },
    });
  }

  function stop(): void {
    if (!started) return;
    started = false;
    live = false;
    generation += 1;
    const stopSubscription = unsubscribe;
    unsubscribe = null;
    clearDebounce();
    clearPoll();
    clearHeartbeat();
    stopSubscription?.();
  }

  return {
    start,
    stop,
    wake() {
      scheduleRefresh(generation);
    },
  };
}
