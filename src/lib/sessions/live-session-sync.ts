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
  options?: { debounceMs?: number; pollMs?: number };
};

export function createLiveSync(deps: LiveSessionSyncDeps): {
  start(): void;
  stop(): void;
  wake(): void;
} {
  const debounceMs = deps.options?.debounceMs ?? 300;
  const pollMs = deps.options?.pollMs ?? 5000;
  let started = false;
  let generation = 0;
  let unsubscribe: (() => void) | null = null;
  let debounceTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let pollTimer: ReturnType<typeof globalThis.setInterval> | null = null;

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
          deps.setConnection('live');
          clearPoll();
          clearDebounce();
          refreshSafely();
          return;
        }

        deps.setConnection('reconnecting');
        startPoll();
      },
    });
  }

  function stop(): void {
    if (!started) return;
    started = false;
    generation += 1;
    const stopSubscription = unsubscribe;
    unsubscribe = null;
    clearDebounce();
    clearPoll();
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
