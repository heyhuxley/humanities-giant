import { describe, expect, it } from 'vitest';
import { applyEvent } from './apply-event';
import { createInitialState } from './initial-state';
import type { Actor, GameEvent, GameStatus, SessionState } from './types';

const roles = ['host', 'contestant', 'system'] as const;
const statuses: GameStatus[] = ['waiting', 'question_active', 'locked', 'revealed', 'finished'];
const actor = (role: Actor['role']): Actor => ({ id: role === 'contestant' ? 'player' : role, role });

interface EventRule {
  type: Exclude<GameEvent['type'], 'use_lifeline'>;
  allowedStatuses: GameStatus[] | 'any_open';
  allowedRole: Actor['role'];
  contestantIdRequired: boolean;
  makeEvent: (role: Actor['role'], id?: string) => GameEvent;
}

const rules: EventRule[] = [
  { type: 'set_contestant', allowedStatuses: ['waiting'], allowedRole: 'host', contestantIdRequired: false, makeEvent: (role) => ({ type: 'set_contestant', actor: actor(role), participantId: 'new-player' }) },
  { type: 'start', allowedStatuses: ['waiting'], allowedRole: 'host', contestantIdRequired: false, makeEvent: (role) => ({ type: 'start', actor: actor(role) }) },
  { type: 'select_answer', allowedStatuses: ['question_active'], allowedRole: 'contestant', contestantIdRequired: true, makeEvent: (role, id) => ({ type: 'select_answer', actor: { ...actor(role), id: id ?? 'player' }, option: 1 }) },
  { type: 'lock_in', allowedStatuses: ['question_active'], allowedRole: 'contestant', contestantIdRequired: true, makeEvent: (role, id) => ({ type: 'lock_in', actor: { ...actor(role), id: id ?? 'player' } }) },
  { type: 'timer_expired', allowedStatuses: ['question_active'], allowedRole: 'system', contestantIdRequired: false, makeEvent: (role) => ({ type: 'timer_expired', actor: actor(role) }) },
  { type: 'reveal', allowedStatuses: ['locked'], allowedRole: 'host', contestantIdRequired: false, makeEvent: (role) => ({ type: 'reveal', actor: actor(role), correctIndex: 1 }) },
  { type: 'next', allowedStatuses: ['revealed'], allowedRole: 'host', contestantIdRequired: false, makeEvent: (role) => ({ type: 'next', actor: actor(role) }) },
  { type: 'walk_away', allowedStatuses: ['revealed'], allowedRole: 'contestant', contestantIdRequired: true, makeEvent: (role, id) => ({ type: 'walk_away', actor: { ...actor(role), id: id ?? 'player' } }) },
  { type: 'end_session', allowedStatuses: 'any_open', allowedRole: 'host', contestantIdRequired: false, makeEvent: (role) => ({ type: 'end_session', actor: actor(role) }) },
];

function validState(status: GameStatus): SessionState {
  const state = createInitialState();
  state.status = status;
  state.contestantId = 'player';
  if (status !== 'waiting') state.position = 1;
  if (status === 'question_active') state.questionEndsAt = 100;
  if (status === 'locked' || status === 'revealed') state.lockedAnswer = 1;
  if (status === 'revealed') {
    state.correctIndex = 1;
    state.lastResult = 'correct';
  }
  return state;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

function nowFor(type: EventRule['type']): number {
  return type === 'timer_expired' ? 100 : 99;
}

function rejectWithoutMutation(state: SessionState, event: GameEvent, expected: string, now: number): void {
  const snapshot = JSON.stringify(state);
  freezeDeep(state);
  expect(applyEvent(state, event, now)).toEqual({ ok: false, error: expected });
  expect(JSON.stringify(state)).toBe(snapshot);
}

const allowed = (rule: EventRule, status: GameStatus): boolean =>
  rule.allowedStatuses === 'any_open' ? status !== 'finished' : rule.allowedStatuses.includes(status);

describe('applyEvent rejection coverage', () => {
  it.each(rules.flatMap((rule) => statuses.filter((status) => !allowed(rule, status)).map((status) => ({ rule, status }))))(
    '$rule.type rejects status $status', ({ rule, status }) => {
      rejectWithoutMutation(validState(status), rule.makeEvent(rule.allowedRole), 'wrong_state', nowFor(rule.type));
    },
  );

  it.each(rules)('$type rejects every wrong role', (rule) => {
    for (const role of roles.filter((candidate) => candidate !== rule.allowedRole)) {
      const status = rule.allowedStatuses === 'any_open' ? 'waiting' : rule.allowedStatuses[0];
      rejectWithoutMutation(validState(status), rule.makeEvent(role), 'not_allowed', nowFor(rule.type));
    }
  });

  it.each(rules.filter((rule) => rule.contestantIdRequired))('$type rejects a mismatched contestant id', (rule) => {
    const status = rule.allowedStatuses === 'any_open' ? 'waiting' : rule.allowedStatuses[0];
    rejectWithoutMutation(validState(status), rule.makeEvent('contestant', 'other-player'), 'not_allowed', nowFor(rule.type));
  });

  it('rejects start without a contestant and lock in without a selected answer', () => {
    const noContestant = validState('waiting');
    noContestant.contestantId = null;
    rejectWithoutMutation(noContestant, { type: 'start', actor: actor('host') }, 'no_contestant', 99);
    const noSelection = validState('question_active');
    rejectWithoutMutation(noSelection, { type: 'lock_in', actor: actor('contestant') }, 'nothing_selected', 99);
  });
});
