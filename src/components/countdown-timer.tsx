'use client';

import { useEffect, useRef, useState } from 'react';
import {
  computeClockOffset,
  estimateServerNow,
  isExpired,
  remainingMs,
  secondsLeft,
} from '../lib/sessions/countdown';
import { createKnockLoop } from '../lib/sessions/knock-loop';

type KnockActionState = { error: string | null };

export function CountdownTimer({
  endsAtMs,
  serverNowMs,
  active,
  sessionId,
  knockAction,
}: Readonly<{
  endsAtMs: number | null;
  serverNowMs: number;
  active: boolean;
  sessionId: string;
  knockAction: (
    prev: KnockActionState,
    formData: FormData,
  ) => Promise<KnockActionState>;
}>) {
  const offsetRef = useRef(0);
  const loopRef = useRef<ReturnType<typeof createKnockLoop> | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    offsetRef.current = computeClockOffset(serverNowMs, Date.now());
  }, [serverNowMs]);

  useEffect(() => {
    if (!active || endsAtMs === null) {
      loopRef.current?.stop();
      loopRef.current = null;
      return;
    }

    const update = () => {
      const estimatedNow = estimateServerNow(Date.now(), offsetRef.current);
      const remaining = remainingMs(endsAtMs, estimatedNow);
      const nextSeconds = secondsLeft(remaining);
      setSeconds(nextSeconds);
      if (isExpired(endsAtMs, estimatedNow)) setLiveMessage('Time is up');
      else if (nextSeconds === 10) setLiveMessage('10 seconds remaining');
      else if (nextSeconds === 5) setLiveMessage('5 seconds remaining');
      else setLiveMessage('');

      if (isExpired(endsAtMs, estimatedNow)) {
        globalThis.dispatchEvent(new CustomEvent('humanities-countdown-expired', {
          detail: { sessionId },
        }));
        if (loopRef.current === null) {
          const loop = createKnockLoop({
            knock: () => {
              const formData = new FormData();
              formData.set('sessionId', sessionId);
              return knockAction({ error: null }, formData);
            },
            timers: {
              setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
              clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
            },
            random: () => Math.random(),
          });
          loopRef.current = loop;
          loop.start();
        }
      }
    };

    update();
    const interval = globalThis.setInterval(update, 250);
    return () => {
      globalThis.clearInterval(interval);
      loopRef.current?.stop();
      loopRef.current = null;
    };
  }, [active, endsAtMs, sessionId, knockAction, serverNowMs]);

  if (!active || endsAtMs === null) return null;

  return (
    <>
      <p
        role="timer"
        className={seconds <= 5 ? 'font-bold text-red-700' : 'font-semibold'}
      >
        {seconds}
      </p>
      {liveMessage ? (
        <span className="sr-only" aria-live="polite">
          {liveMessage}
        </span>
      ) : null}
    </>
  );
}
