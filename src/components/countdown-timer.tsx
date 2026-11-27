'use client';

import {useEffect, useRef, useState} from 'react';
import {
	computeClockOffset,
	estimateServerNow,
	isExpired,
	remainingMs,
	secondsLeft,
} from '../lib/sessions/countdown';
import {createKnockLoop} from '../lib/sessions/knock-loop';

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
	const [remainingFraction, setRemainingFraction] = useState(1);
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
			setRemainingFraction(Math.min(1, remaining / 30_000));
			if (isExpired(endsAtMs, estimatedNow)) setLiveMessage('Time is up');
			else if (nextSeconds === 10) setLiveMessage('10 seconds remaining');
			else if (nextSeconds === 5) setLiveMessage('5 seconds remaining');
			else setLiveMessage('');
			
			if (isExpired(endsAtMs, estimatedNow)) {
				globalThis.dispatchEvent(new CustomEvent('humanities-countdown-expired', {
					detail: {sessionId},
				}));
				if (loopRef.current === null) {
					const loop = createKnockLoop({
						knock: () => {
							const formData = new FormData();
							formData.set('sessionId', sessionId);
							return knockAction({error: null}, formData);
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
			<div
				role="timer"
				className={`flex min-w-0 items-center gap-3 rounded-sm border border-rule bg-ink px-3 py-2 ${seconds <= 5 ? 'font-bold text-rose' : 'font-semibold text-bone'}`}
			>
				<div aria-hidden="true" className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-slab-raised">
					<div
						className={`h-full origin-left ${seconds <= 5 ? 'bg-rose' : 'bg-ember'}`}
						style={{transform: `scaleX(${remainingFraction})`}}
					/>
				</div>
				<span className="w-10 shrink-0 text-right font-display text-lg tabular-nums">{seconds}</span>
			</div>
			{liveMessage ? (
				<span className="sr-only" aria-live="polite">
          {liveMessage}
        </span>
			) : null}
		</>
	);
}
