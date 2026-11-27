type TimerHandle = unknown;

export type KnockLoopDeps = {
  knock: () => Promise<unknown>;
  timers: {
    setTimeout: (callback: () => void, delay: number) => TimerHandle;
    clearTimeout: (handle: TimerHandle) => void;
  };
  random: () => number;
  options?: {
    jitterMaxMs?: number;
    repeatMs?: number;
  };
};

export function createKnockLoop(deps: KnockLoopDeps): { start(): void; stop(): void } {
  const jitterMaxMs = Math.max(0, deps.options?.jitterMaxMs ?? 800);
  const repeatMs = Math.max(0, deps.options?.repeatMs ?? 2000);
  let pendingTimer: TimerHandle | null = null;
  let started = false;
  let stopped = false;
  let inFlight = false;
  let generation = 0;

  function schedule(delay: number, loopGeneration: number): void {
    if (stopped) return;
    pendingTimer = deps.timers.setTimeout(() => {
      pendingTimer = null;
      if (stopped || inFlight || loopGeneration !== generation) return;
      inFlight = true;
      let knockResult: Promise<unknown>;
      try {
        knockResult = deps.knock();
      } catch {
        inFlight = false;
        if (!stopped && loopGeneration === generation) schedule(repeatMs, loopGeneration);
        return;
      }
      void Promise.resolve(knockResult).then(
        () => {
          inFlight = false;
          if (!stopped && loopGeneration === generation) schedule(repeatMs, loopGeneration);
        },
        () => {
          inFlight = false;
          if (!stopped && loopGeneration === generation) schedule(repeatMs, loopGeneration);
        },
      );
    }, delay);
  }

  return {
    start() {
      if (started) return;
      started = true;
      stopped = false;
      const currentGeneration = ++generation;
      const randomValue = deps.random();
      const jitter = Number.isFinite(randomValue)
        ? Math.max(0, randomValue) * jitterMaxMs
        : 0;
      schedule(jitter, currentGeneration);
    },
    stop() {
      generation += 1;
      stopped = true;
      if (pendingTimer !== null) {
        deps.timers.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      started = false;
      inFlight = false;
    },
  };
}
