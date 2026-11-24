import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveSync, type LiveConnectionState } from './live-session-sync';

function makeSync() {
  let handlers: {
    onChange(): void;
    onStatus(status: 'subscribed' | 'error' | 'closed'): void;
  } | null = null;
  const refresh = vi.fn();
  const setConnection = vi.fn<(state: LiveConnectionState) => void>();
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((received: NonNullable<typeof handlers>) => {
    handlers = received;
    return unsubscribe;
  });
  const sync = createLiveSync({
    subscribe,
    refresh,
    setConnection,
    timers: {
      setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
      clearTimeout: (handle) => globalThis.clearTimeout(handle),
      setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
      clearInterval: (handle) => globalThis.clearInterval(handle),
    },
    options: { debounceMs: 300, pollMs: 5000 },
  });

  return {
    sync,
    refresh,
    setConnection,
    subscribe,
    unsubscribe,
    handlers: () => handlers,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createLiveSync', () => {
  it('subscribes once on start', () => {
    const setup = makeSync();

    setup.sync.start();

    expect(setup.subscribe).toHaveBeenCalledTimes(1);
    expect(setup.setConnection).toHaveBeenCalledWith('connecting');
  });

  it('does nothing extra when started twice', () => {
    const setup = makeSync();

    setup.sync.start();
    setup.sync.start();

    expect(setup.subscribe).toHaveBeenCalledTimes(1);
    expect(setup.setConnection).toHaveBeenCalledTimes(1);
  });

  it('trailing debounces bursts and refreshes again for a later change', () => {
    const setup = makeSync();
    setup.sync.start();
    const handlers = setup.handlers();
    if (!handlers) throw new Error('Expected subscribed handlers.');

    for (let index = 0; index < 5; index += 1) {
      handlers.onChange();
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(249);
    expect(setup.refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setup.refresh).toHaveBeenCalledTimes(1);

    handlers.onChange();
    vi.advanceTimersByTime(300);
    expect(setup.refresh).toHaveBeenCalledTimes(2);
  });

  it('sets live and refreshes once immediately when subscribed', () => {
    const setup = makeSync();
    setup.sync.start();
    setup.handlers()?.onStatus('subscribed');

    expect(setup.setConnection).toHaveBeenLastCalledWith('live');
    expect(setup.refresh).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending debounce when subscribed', () => {
    const setup = makeSync();
    setup.sync.start();
    const handlers = setup.handlers();
    handlers?.onChange();
    handlers?.onStatus('subscribed');
    vi.advanceTimersByTime(300);

    expect(setup.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows reconnecting and polls every poll interval', () => {
    const setup = makeSync();
    setup.sync.start();
    setup.handlers()?.onStatus('error');

    expect(setup.setConnection).toHaveBeenLastCalledWith('reconnecting');
    vi.advanceTimersByTime(15000);
    expect(setup.refresh).toHaveBeenCalledTimes(3);
  });

  it('starts only one poll after repeated errors', () => {
    const setup = makeSync();
    setup.sync.start();
    const handlers = setup.handlers();
    handlers?.onStatus('error');
    handlers?.onStatus('error');
    vi.advanceTimersByTime(15000);

    expect(setup.refresh).toHaveBeenCalledTimes(3);
  });

  it('stops polling and refreshes immediately after reconnecting', () => {
    const setup = makeSync();
    setup.sync.start();
    const handlers = setup.handlers();
    handlers?.onStatus('error');
    vi.advanceTimersByTime(10000);
    handlers?.onStatus('subscribed');
    vi.advanceTimersByTime(15000);

    expect(setup.refresh).toHaveBeenCalledTimes(3);
    expect(setup.setConnection).toHaveBeenLastCalledWith('live');
  });

  it('treats closed like an error', () => {
    const setup = makeSync();
    setup.sync.start();
    setup.handlers()?.onStatus('closed');
    vi.advanceTimersByTime(5000);

    expect(setup.setConnection).toHaveBeenLastCalledWith('reconnecting');
    expect(setup.refresh).toHaveBeenCalledTimes(1);
  });

  it('debounces wake refreshes', () => {
    const setup = makeSync();
    setup.sync.start();

    setup.sync.wake();
    vi.advanceTimersByTime(100);
    setup.sync.wake();
    vi.advanceTimersByTime(300);

    expect(setup.refresh).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and cancels debounce and polling on stop', () => {
    const setup = makeSync();
    setup.sync.start();
    const handlers = setup.handlers();
    handlers?.onChange();
    handlers?.onStatus('error');
    setup.sync.stop();
    vi.advanceTimersByTime(15000);
    handlers?.onChange();
    handlers?.onStatus('subscribed');

    expect(setup.unsubscribe).toHaveBeenCalledTimes(1);
    expect(setup.refresh).not.toHaveBeenCalled();
  });

  it('allows stop to be called twice', () => {
    const setup = makeSync();
    setup.sync.start();

    setup.sync.stop();
    setup.sync.stop();

    expect(setup.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('starts from scratch after stop', () => {
    const setup = makeSync();
    setup.sync.start();
    setup.sync.stop();
    setup.sync.start();

    expect(setup.subscribe).toHaveBeenCalledTimes(2);
    expect(setup.setConnection).toHaveBeenNthCalledWith(2, 'connecting');
  });

  it('keeps running when refresh throws without logging the error', () => {
    const setup = makeSync();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setup.refresh.mockImplementationOnce(() => {
      throw new Error('private refresh failure');
    });
    setup.sync.start();
    const handlers = setup.handlers();
    handlers?.onStatus('subscribed');
    handlers?.onChange();
    vi.advanceTimersByTime(300);

    expect(setup.refresh).toHaveBeenCalledTimes(2);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
