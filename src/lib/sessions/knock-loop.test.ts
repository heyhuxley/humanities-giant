import { describe, expect, it, vi } from 'vitest';
import { createKnockLoop } from './knock-loop';

type TimerCallback = () => void;

function fakeTimers() {
  let nextId = 1;
  const callbacks = new Map<number, { callback: TimerCallback; delay: number }>();
  return {
    callbacks,
    timers: {
      setTimeout(callback: TimerCallback, delay: number): number {
        const id = nextId++;
        callbacks.set(id, { callback, delay });
        return id;
      },
      clearTimeout(handle: unknown): void {
        callbacks.delete(handle as number);
      },
    },
    tick(id: number): void {
      const timer = callbacks.get(id);
      if (!timer) return;
      callbacks.delete(id);
      timer.callback();
    },
  };
}

describe('createKnockLoop', () => {
  it('schedules the first knock after the jitter delay', () => {
    const fake = fakeTimers();
    const knock = vi.fn(async () => undefined);
    createKnockLoop({ knock, timers: fake.timers, random: () => 0 }).start();
    expect(fake.callbacks.size).toBe(1);
    expect([...fake.callbacks.values()][0]?.delay).toBe(0);

    createKnockLoop({ knock, timers: fake.timers, random: () => 0.999 }).start();
    expect([...fake.callbacks.values()][1]?.delay).toBe(799.2);
  });

  it('repeats every repeatMs for three ticks', async () => {
    const fake = fakeTimers();
    const knock = vi.fn(async () => undefined);
    const loop = createKnockLoop({
      knock,
      timers: fake.timers,
      random: () => 0,
      options: { repeatMs: 2000, jitterMaxMs: 0 },
    });
    loop.start();
    fake.tick(1);
    await Promise.resolve();
    fake.tick(2);
    await Promise.resolve();
    fake.tick(3);
    await Promise.resolve();
    expect(knock).toHaveBeenCalledTimes(3);
  });

  it('does not overlap a pending knock', async () => {
    const fake = fakeTimers();
    let resolveKnock: () => void = () => {};
    const knock = vi.fn(() => new Promise<unknown>((resolve) => {
      resolveKnock = () => resolve(undefined);
    }));
    const loop = createKnockLoop({
      knock,
      timers: fake.timers,
      random: () => 0,
      options: { repeatMs: 2000, jitterMaxMs: 0 },
    });
    loop.start();
    fake.tick(1);
    expect(fake.callbacks.size).toBe(0);
    resolveKnock();
    await Promise.resolve();
    expect(fake.callbacks.size).toBe(1);
  });

  it('continues after a rejected knock', async () => {
    const fake = fakeTimers();
    const knock = vi.fn(async () => {
      throw new Error('private');
    });
    createKnockLoop({
      knock,
      timers: fake.timers,
      random: () => 0,
      options: { repeatMs: 2000, jitterMaxMs: 0 },
    }).start();
    fake.tick(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.callbacks.size).toBe(1);
  });

  it('stop cancels the pending timer', () => {
    const fake = fakeTimers();
    const loop = createKnockLoop({
      knock: async () => undefined,
      timers: fake.timers,
      random: () => 0.5,
      options: { jitterMaxMs: 800 },
    });
    loop.start();
    expect(fake.callbacks.size).toBe(1);
    loop.stop();
    expect(fake.callbacks.size).toBe(0);
  });

  it('stop while in flight prevents scheduling another', async () => {
    const fake = fakeTimers();
    let resolveKnock: () => void = () => {};
    const knock = vi.fn(() => new Promise<unknown>((resolve) => {
      resolveKnock = () => resolve(undefined);
    }));
    const loop = createKnockLoop({
      knock,
      timers: fake.timers,
      random: () => 0,
      options: { jitterMaxMs: 0 },
    });
    loop.start();
    fake.tick(1);
    loop.stop();
    resolveKnock();
    await Promise.resolve();
    expect(fake.callbacks.size).toBe(0);
  });

  it('start twice schedules once', () => {
    const fake = fakeTimers();
    const loop = createKnockLoop({
      knock: async () => undefined,
      timers: fake.timers,
      random: () => 0,
    });
    loop.start();
    loop.start();
    expect(fake.callbacks.size).toBe(1);
  });

  it('restart works after stop', () => {
    const fake = fakeTimers();
    const loop = createKnockLoop({
      knock: async () => undefined,
      timers: fake.timers,
      random: () => 0,
      options: { jitterMaxMs: 0 },
    });
    loop.start();
    loop.stop();
    loop.start();
    expect(fake.callbacks.size).toBe(1);
  });

  it('jitterMaxMs zero knocks immediately', () => {
    const fake = fakeTimers();
    createKnockLoop({
      knock: async () => undefined,
      timers: fake.timers,
      random: () => 0.999,
      options: { jitterMaxMs: 0 },
    }).start();
    expect([...fake.callbacks.values()][0]?.delay).toBe(0);
  });
});
