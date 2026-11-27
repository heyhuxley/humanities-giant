'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {createLiveSync, type LiveConnectionState} from '../lib/sessions/live-session-sync';
import {createClient} from '../lib/supabase/client';

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const CONNECTION_LABELS: Record<LiveConnectionState, string> = {
	connecting: 'Connecting…',
	live: 'Live',
	reconnecting: 'Reconnecting…',
};

export function LiveSessionRefresh({sessionId}: Readonly<{ sessionId: string }>) {
	const router = useRouter();
	const [connection, setConnection] = useState<LiveConnectionState>('connecting');
	
	useEffect(() => {
		if (!UUID_PATTERN.test(sessionId)) return;
		
		const supabase = createClient();
		const channel = supabase.channel(`session-${sessionId}`);
		const sync = createLiveSync({
			subscribe(handlers) {
				channel
					.on(
						'postgres_changes',
						{event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}`},
						() => handlers.onChange(),
					)
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'participants',
							filter: `session_id=eq.${sessionId}`,
						},
						() => handlers.onChange(),
					);
				channel.subscribe((status) => {
					if (status === 'SUBSCRIBED') handlers.onStatus('subscribed');
					else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
						handlers.onStatus('error');
					} else if (status === 'CLOSED') {
						handlers.onStatus('closed');
					}
				});
				return () => {
					void supabase.removeChannel(channel);
				};
			},
			refresh: () => router.refresh(),
			setConnection,
			timers: {
				setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
				clearTimeout: (handle) => globalThis.clearTimeout(handle),
				setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
				clearInterval: (handle) => globalThis.clearInterval(handle),
			},
		});
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') sync.wake();
		};
		const onOnline = () => sync.wake();
		
		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('online', onOnline);
		sync.start();
		
		return () => {
			sync.stop();
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('online', onOnline);
		};
	}, [router, sessionId]);
	
	return (
		<p
			role="status"
			aria-live="polite"
			className={`inline-flex min-h-11 items-center gap-2 rounded-sm border border-rule bg-ink px-3 text-sm font-semibold ${connection === 'live' ? 'text-bone' : 'text-bone-muted'} before:inline-block before:size-2 before:shrink-0 before:rounded-full before:border before:border-current before:content-['']`}
		>
			{CONNECTION_LABELS[connection]}
		</p>
	);
}
