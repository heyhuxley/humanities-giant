'use client';

import {useActionState, useState} from 'react';
import {
	endSessionAction,
	nextAction,
	revealAction,
	setContestantAction,
	startSessionAction,
	type HostEventActionState,
} from './actions';
import {Button} from '../../../../components/stage/button';
import {InlineAlert} from '../../../../components/stage/inline-alert';

const INITIAL_STATE: HostEventActionState = {error: null};

export function SetContestantForm({
	                                  sessionId,
	                                  participantId,
                                  }: Readonly<{
	sessionId: string;
	participantId: string;
}>) {
	const [state, formAction, pending] = useActionState(setContestantAction, INITIAL_STATE);
	
	return (
		<form action={formAction} className="space-y-1">
			<input type="hidden" name="sessionId" value={sessionId}/>
			<input type="hidden" name="participantId" value={participantId}/>
			<Button
				type="submit"
				disabled={pending}
				variant="secondary"
				className="px-3"
			>
				{pending ? 'Updating…' : 'Make contestant'}
			</Button>
			{state.error ? <InlineAlert className="text-sm">{state.error}</InlineAlert> : null}
		</form>
	);
}

export function StartSessionForm({
	                                 sessionId,
	                                 hasContestant,
                                 }: {
	sessionId: string;
	hasContestant: boolean;
}) {
	const [state, formAction, pending] = useActionState(startSessionAction, INITIAL_STATE);
	
	return (
		<form action={formAction} className="space-y-1">
			<input type="hidden" name="sessionId" value={sessionId}/>
			<Button
				type="submit"
				disabled={!hasContestant || pending}
				size="large"
			>
				{pending ? 'Starting…' : 'Start'}
			</Button>
			{state.error ? <InlineAlert className="text-sm">{state.error}</InlineAlert> : null}
		</form>
	);
}

export function EndSessionControl({sessionId}: Readonly<{ sessionId: string }>) {
	const [state, formAction, pending] = useActionState(endSessionAction, INITIAL_STATE);
	const [isConfirming, setIsConfirming] = useState(false);
	
	if (!isConfirming) {
		return (
			<Button
				type="button"
				disabled={pending}
				onClick={() => setIsConfirming(true)}
				variant="danger"
			>
				End session
			</Button>
		);
	}
	
	return (
		<div className="space-y-2">
			<InlineAlert>End the session for everyone? This can&apos;t be undone.</InlineAlert>
			<form action={formAction} className="flex flex-wrap items-center gap-2">
				<input type="hidden" name="sessionId" value={sessionId}/>
				<Button
					type="submit"
					disabled={pending}
					variant="danger"
				>
					{pending ? 'Ending…' : 'Yes, end it'}
				</Button>
				<Button
					type="button"
					disabled={pending}
					onClick={() => setIsConfirming(false)}
					variant="secondary"
				>
					Cancel
				</Button>
				{state.error ? <InlineAlert className="text-sm">{state.error}</InlineAlert> : null}
			</form>
		</div>
	);
}

export function RevealControl({sessionId}: Readonly<{ sessionId: string }>) {
	const [state, formAction, pending] = useActionState(revealAction, INITIAL_STATE);
	
	return (
		<form action={formAction} className="space-y-1">
			<input type="hidden" name="sessionId" value={sessionId}/>
			<Button
				type="submit"
				disabled={pending}
				size="large"
			>
				{pending ? 'Revealing…' : 'Reveal answer'}
			</Button>
			{state.error ? <InlineAlert className="text-sm">{state.error}</InlineAlert> : null}
		</form>
	);
}

export function NextControl({sessionId}: Readonly<{ sessionId: string }>) {
	const [state, formAction, pending] = useActionState(nextAction, INITIAL_STATE);
	
	return (
		<form action={formAction} className="space-y-1">
			<input type="hidden" name="sessionId" value={sessionId}/>
			<Button
				type="submit"
				disabled={pending}
				size="large"
			>
				{pending ? 'Moving on…' : 'Next question'}
			</Button>
			{state.error ? <InlineAlert className="text-sm">{state.error}</InlineAlert> : null}
		</form>
	);
}
