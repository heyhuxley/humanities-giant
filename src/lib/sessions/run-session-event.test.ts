import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialState,
  QUESTION_DURATION_MS,
  toPublicState,
  type SessionState,
} from '../../game';
import {
  runSessionEvent,
  type LifelineRequest,
  type RunnableEvent,
  type RunSessionEventDeps,
} from './run-session-event';

vi.mock('server-only', () => ({}));

const sessionId = 'session-id-secret';
const hostId = 'host-id-secret';
const participantId = 'participant-id-secret';
const questionText = 'Question private text';
const question = {
  id: 'question-id-secret',
  text: questionText,
  options: ['A', 'B', 'C', 'D'],
};

const cloneState = (state: SessionState): SessionState => structuredClone(state);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function makeEvent<T extends RunnableEvent>(event: T): T {
  return deepFreeze(event);
}

function makeDeps(
  engineState: unknown = createInitialState(),
  overrides: Partial<RunSessionEventDeps> = {},
  currentQuestion: unknown = question,
): RunSessionEventDeps {
  return {
    loadSession: vi.fn(async () => ({
      hostId,
      engineState: cloneState(engineState as SessionState),
      version: 7,
      currentQuestion,
    })),
    loadQuestionAt: vi.fn(async () => question),
    loadCorrectIndex: vi.fn(async () => 0 as const),
    loadVotes: vi.fn(async () => []),
    randomInt: vi.fn(() => 0),
    commit: vi.fn(async () => ({ data: 8, error: null })),
    now: vi.fn(() => 100),
    ...overrides,
  };
}

function activeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...createInitialState(),
    status: 'question_active',
    position: 4,
    contestantId: participantId,
    questionEndsAt: 200,
    ...overrides,
  };
}

function lifelineRequest(
  lifeline: LifelineRequest['lifeline'],
  actor: LifelineRequest['actor'] = { id: participantId, role: 'contestant' },
): LifelineRequest {
  return makeEvent({ type: 'use_lifeline', actor, lifeline });
}

async function expectFinishedQuestionCommit(
  state: SessionState,
  event: RunnableEvent,
  correctIndex: number | null,
): Promise<void> {
  const loadedQuestion = {
    ...question,
    options: [...question.options],
    correct_index: 2,
    answer: 'private-answer-secret',
  };
  const deps = makeDeps(state, {}, loadedQuestion);

  await expect(runSessionEvent(deps, { sessionId, event })).resolves.toMatchObject({
    ok: true,
  });

  const committed = vi.mocked(deps.commit).mock.calls[0][0];
  const committedQuestion = committed.p_current_question;
  expect(committedQuestion).toEqual({
    id: loadedQuestion.id,
    text: loadedQuestion.text,
    options: loadedQuestion.options,
  });
  expect(committedQuestion).not.toBe(loadedQuestion);
  expect(committedQuestion?.options).not.toBe(loadedQuestion.options);
  expect(Object.keys(committedQuestion ?? {}).sort()).toEqual(['id', 'options', 'text']);
  expect(JSON.stringify(committed)).not.toContain('correct_index');
  expect(JSON.stringify(committed)).not.toContain('private-answer-secret');
  expect(committed.p_engine_state.status).toBe('finished');
  expect(committed.p_engine_state.correctIndex).toBe(correctIndex);
  expect(committed.p_public_state.correctIndex).toBe(correctIndex);
  expect(deps.loadQuestionAt).not.toHaveBeenCalled();
}

let loggedOutput: unknown[][];
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  loggedOutput = [];
  consoleError = vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
    loggedOutput.push(values);
  });
});

afterEach(() => {
  const output = JSON.stringify(loggedOutput);
  expect(output).not.toContain(sessionId);
  expect(output).not.toContain(hostId);
  expect(output).not.toContain(participantId);
  expect(output).not.toContain(questionText);
  consoleError.mockRestore();
});

describe('runSessionEvent', () => {
  it.each([
    [2, 'correct', 'revealed'],
    [1, 'wrong', 'finished'],
  ] as const)(
    'loads and commits the server answer for a %s reveal',
    async (correctIndex, lastResult, status) => {
      const state: SessionState = {
        ...createInitialState(),
        status: 'locked',
        position: 4,
        contestantId: participantId,
        lockedAnswer: 2,
      };
      const loadCorrectIndex = vi.fn(async () => correctIndex);
      const deps = makeDeps(state, { loadCorrectIndex });
      const event = makeEvent({ type: 'reveal', actor: { id: hostId, role: 'host' } });

      await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
        ok: true,
        version: 8,
      });

      expect(loadCorrectIndex).toHaveBeenCalledOnce();
      expect(loadCorrectIndex).toHaveBeenCalledWith(sessionId, 4);
      const committed = vi.mocked(deps.commit).mock.calls[0][0];
      expect(committed.p_engine_state).toMatchObject({
        correctIndex,
        lastResult,
        status,
      });
      expect(committed.p_public_state).toMatchObject({ correctIndex });
      expect(committed.p_public_state.lifelines.phone.hintIsCorrect).toBeNull();
    },
  );

  it.each([
    ['waiting', createInitialState()],
    ['question_active', {
      ...createInitialState(),
      status: 'question_active' as const,
      position: 1,
      questionEndsAt: 200,
    }],
    ['revealed', {
      ...createInitialState(),
      status: 'revealed' as const,
      position: 1,
      correctIndex: 2 as const,
      lastResult: 'correct' as const,
    }],
    ['finished', {
      ...createInitialState(),
      status: 'finished' as const,
      position: 1,
      correctIndex: 2 as const,
      lastResult: 'correct' as const,
      winnings: 5000,
      finishReason: 'won' as const,
    }],
  ])('does not load an answer when reveal state is %s', async (_status, state) => {
    const deps = makeDeps(state);
    const event = makeEvent({ type: 'reveal', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'rejected',
      error: 'wrong_state',
    });
    expect(deps.loadCorrectIndex).not.toHaveBeenCalled();
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('does not load an answer before confirming host ownership', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 3,
      lockedAnswer: 1,
    };
    const deps = makeDeps(state);
    const event = makeEvent({
      type: 'reveal',
      actor: { id: 'other-host', role: 'host' },
    });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(deps.loadCorrectIndex).not.toHaveBeenCalled();
  });

  it('returns unknown without committing when the correct answer is missing', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 3,
      lockedAnswer: 1,
    };
    const deps = makeDeps(state, {
      loadCorrectIndex: vi.fn(async () => null),
    });
    const event = makeEvent({ type: 'reveal', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('returns unknown when loading the correct answer throws', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 3,
      lockedAnswer: 1,
    };
    const deps = makeDeps(state, {
      loadCorrectIndex: vi.fn(async () => {
        throw new Error('answer dependency private failure');
      }),
    });
    const event = makeEvent({ type: 'reveal', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(deps.commit).not.toHaveBeenCalled();
    const output = JSON.stringify(loggedOutput);
    expect(output).not.toContain('answer dependency private failure');
    expect(output).not.toContain('3');
  });

  it('ignores a runtime supplied correctIndex on a reveal request', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 3,
      lockedAnswer: 2,
    };
    const deps = makeDeps(state, { loadCorrectIndex: vi.fn(async () => 2 as const) });
    const event = {
      type: 'reveal',
      actor: { id: hostId, role: 'host' },
      correctIndex: 1,
    } as RunnableEvent;

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toMatchObject({
      ok: true,
    });
    expect(vi.mocked(deps.commit).mock.calls[0][0].p_engine_state.correctIndex).toBe(2);
  });

  it('reloads the correct answer after a conflict', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 6,
      lockedAnswer: 2,
    };
    const loadSession = vi.fn<RunSessionEventDeps['loadSession']>()
      .mockResolvedValue({
        hostId,
        engineState: state,
        version: 7,
        currentQuestion: question,
      });
    const loadCorrectIndex = vi.fn(async () => 2 as const);
    const commit = vi.fn<RunSessionEventDeps['commit']>()
      .mockResolvedValueOnce({ data: null, error: { code: 'PJ003' } })
      .mockResolvedValueOnce({ data: 9, error: null });
    const deps = makeDeps(state, { loadSession, loadCorrectIndex, commit });
    const event = makeEvent({ type: 'reveal', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: true,
      version: 9,
    });
    expect(loadCorrectIndex).toHaveBeenNthCalledWith(1, sessionId, 6);
    expect(loadCorrectIndex).toHaveBeenNthCalledWith(2, sessionId, 6);
    expect(loadCorrectIndex).toHaveBeenCalledTimes(2);
  });

  it('keeps answer, session, and question data out of every reveal log path', async () => {
    const privateSessionId = 'distinctive-reveal-session-940';
    const privateQuestionText = 'distinctive reveal question text 271';
    const privateQuestion = { ...question, text: privateQuestionText };
    const lockedState: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 11,
      lockedAnswer: 3,
    };
    const event = makeEvent({ type: 'reveal', actor: { id: hostId, role: 'host' } });
    const privateDeps = (overrides: Partial<RunSessionEventDeps> = {}, state: unknown = lockedState) =>
      makeDeps(state, {
        loadSession: vi.fn(async () => ({
          hostId,
          engineState: structuredClone(state as SessionState),
          version: 7,
          currentQuestion: privateQuestion,
        })),
        loadCorrectIndex: vi.fn(async () => 3 as const),
        ...overrides,
      }, privateQuestion);

    await runSessionEvent(privateDeps(), { sessionId: privateSessionId, event });
    await runSessionEvent(
      privateDeps({}, createInitialState()),
      { sessionId: privateSessionId, event },
    );
    await runSessionEvent(
      privateDeps({
        loadSession: vi.fn(async () => ({
          hostId: 'different-owner',
          engineState: lockedState,
          version: 7,
          currentQuestion: privateQuestion,
        })),
      }),
      { sessionId: privateSessionId, event },
    );
    await runSessionEvent(
      privateDeps({ loadCorrectIndex: vi.fn(async () => null) }),
      { sessionId: privateSessionId, event },
    );
    await runSessionEvent(
      privateDeps({
        loadCorrectIndex: vi.fn(async () => {
          throw new Error('answer dependency private failure');
        }),
      }),
      { sessionId: privateSessionId, event },
    );
    await runSessionEvent(
      privateDeps({
        commit: vi.fn<RunSessionEventDeps['commit']>()
          .mockResolvedValueOnce({ data: null, error: { code: 'PJ003' } })
          .mockResolvedValueOnce({ data: 8, error: null }),
      }),
      { sessionId: privateSessionId, event },
    );

    const output = JSON.stringify(loggedOutput);
    expect(output).not.toContain('3');
    expect(output).not.toContain(privateSessionId);
    expect(output).not.toContain(hostId);
    expect(output).not.toContain(privateQuestionText);
    expect(output).not.toContain('answer dependency private failure');
  });

  it.each([
    ['start', createInitialState(), {
      type: 'start',
      actor: { id: hostId, role: 'host' },
    }],
    ['next', {
      ...createInitialState(),
      status: 'revealed',
      position: 1,
      lastResult: 'correct',
    }, {
      type: 'next',
      actor: { id: hostId, role: 'host' },
    }],
    ['select_answer', {
      ...createInitialState(),
      status: 'question_active',
      position: 1,
      questionEndsAt: 200,
      contestantId: participantId,
    }, {
      type: 'select_answer',
      actor: { id: participantId, role: 'contestant' },
      option: 2,
    }],
    ['lock_in', {
      ...createInitialState(),
      status: 'question_active',
      position: 1,
      questionEndsAt: 200,
      contestantId: participantId,
      selectedAnswer: 2,
    }, {
      type: 'lock_in',
      actor: { id: participantId, role: 'contestant' },
    }],
    ['timer_expired', {
      ...createInitialState(),
      status: 'question_active',
      position: 1,
      questionEndsAt: 100,
    }, {
      type: 'timer_expired',
      actor: { id: 'system-id', role: 'system' },
    }],
    ['set_contestant', createInitialState(), {
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId,
    }],
    ['end_session', createInitialState(), {
      type: 'end_session',
      actor: { id: hostId, role: 'host' },
    }],
    ['walk_away', {
      ...createInitialState(),
      status: 'revealed',
      position: 1,
      correctIndex: 2,
      lastResult: 'correct',
      contestantId: participantId,
    }, {
      type: 'walk_away',
      actor: { id: participantId, role: 'contestant' },
    }],
  ])('%s never loads the correct answer', async (_name, state, event) => {
    const deps = makeDeps(state);

    await runSessionEvent(deps, { sessionId, event: event as RunnableEvent });

    expect(deps.loadCorrectIndex).not.toHaveBeenCalled();
    expect(deps.loadVotes).not.toHaveBeenCalled();
    expect(deps.randomInt).not.toHaveBeenCalled();
    expect(deps.now).toHaveBeenCalledOnce();
  });

  it('builds and commits a 50:50 payload after a passing dry run', async () => {
    const state = activeState();
    const loadCorrectIndex = vi.fn(async () => 2 as const);
    const randomInt = vi.fn(() => 0);
    const loadVotes = vi.fn(async () => [{ option_index: 0 }]);
    const deps = makeDeps(state, { loadCorrectIndex, randomInt, loadVotes });

    await expect(runSessionEvent(deps, {
      sessionId,
      event: lifelineRequest('fifty_fifty'),
    })).resolves.toEqual({ ok: true, version: 8 });

    expect(loadCorrectIndex).toHaveBeenCalledOnce();
    expect(loadCorrectIndex).toHaveBeenCalledWith(sessionId, state.position);
    expect(randomInt).toHaveBeenCalledOnce();
    expect(randomInt).toHaveBeenCalledWith(3);
    expect(loadVotes).not.toHaveBeenCalled();
    const committed = vi.mocked(deps.commit).mock.calls[0][0];
    const fiftyFifty = committed.p_engine_state.lifelines.fiftyFifty;
    expect(fiftyFifty.used).toBe(true);
    expect(fiftyFifty.usedAtPosition).toBe(state.position);
    expect(fiftyFifty.removed).toEqual([1, 3]);
    expect(fiftyFifty.removed).not.toContain(2);
    expect(committed.p_engine_state.correctIndex).toBeNull();
    expect(committed.p_public_state.lifelines.phone.hintIsCorrect).toBeNull();
    expect(committed.p_current_question).toEqual(question);
  });

  it.each([
    [0, true, 2],
    [60, false, 0],
  ] as const)('builds a phone hint at roll %s', async (roll, hintIsCorrect, hint) => {
    const state = activeState({
      lifelines: {
        ...createInitialState().lifelines,
        fiftyFifty: {
          used: true,
          usedAtPosition: 4,
          removed: [1, 3],
        },
      },
    });
    const randomInt = vi.fn((max: number) => max === 100 ? roll : 0);
    const deps = makeDeps(state, {
      loadCorrectIndex: vi.fn(async () => 2 as const),
      randomInt,
    });

    await expect(runSessionEvent(deps, {
      sessionId,
      event: lifelineRequest('phone'),
    })).resolves.toMatchObject({ ok: true });

    const committed = vi.mocked(deps.commit).mock.calls[0][0];
    expect(committed.p_engine_state.lifelines.phone).toMatchObject({
      used: true,
      usedAtPosition: 4,
      hint,
      hintIsCorrect,
    });
    expect(committed.p_public_state.lifelines.phone).toMatchObject({
      hint,
      hintIsCorrect: null,
    });
    expect(committed.p_engine_state.correctIndex).toBeNull();
    expect(deps.loadVotes).not.toHaveBeenCalled();
    expect(vi.mocked(deps.loadCorrectIndex)).toHaveBeenCalledOnce();
    expect(randomInt.mock.calls).toEqual(hintIsCorrect ? [[100]] : [[100], [1]]);
    if (!hintIsCorrect) expect([1, 3]).not.toContain(hint);
  });

  it('does not apply an earlier 50:50 removal to a phone hint', async () => {
    const state = activeState({
      lifelines: {
        ...createInitialState().lifelines,
        fiftyFifty: {
          used: true,
          usedAtPosition: 3,
          removed: [0, 1],
        },
      },
    });
    const randomInt = vi.fn((max: number) => max === 100 ? 60 : 1);
    const deps = makeDeps(state, {
      loadCorrectIndex: vi.fn(async () => 2 as const),
      randomInt,
    });

    await runSessionEvent(deps, { sessionId, event: lifelineRequest('phone') });

    expect(vi.mocked(deps.commit).mock.calls[0][0].p_engine_state.lifelines.phone.hint)
      .toBe(1);
    expect(randomInt.mock.calls).toEqual([[100], [3]]);
  });

  it('counts current votes, ignores same question removals, and stores percentages only', async () => {
    const state = activeState({
      lifelines: {
        ...createInitialState().lifelines,
        fiftyFifty: {
          used: true,
          usedAtPosition: 4,
          removed: [1, 2],
        },
      },
    });
    const votes = [
      { option_index: 0 },
      { option_index: 0 },
      { option_index: 1 },
      { option_index: 1 },
      { option_index: 2 },
      { option_index: 2 },
      { option_index: 3 },
      { option_index: 3 },
      { option_index: 4 },
      { option_index: '2' },
      null,
    ];
    const loadVotes = vi.fn(async () => votes);
    const loadCorrectIndex = vi.fn(async () => 2 as const);
    const randomInt = vi.fn(() => 0);
    const deps = makeDeps(state, { loadVotes, loadCorrectIndex, randomInt });

    await expect(runSessionEvent(deps, {
      sessionId,
      event: lifelineRequest('audience'),
    })).resolves.toMatchObject({ ok: true });

    expect(loadVotes).toHaveBeenCalledOnce();
    expect(loadVotes).toHaveBeenCalledWith(sessionId, 4);
    expect(loadCorrectIndex).not.toHaveBeenCalled();
    expect(randomInt).not.toHaveBeenCalled();
    const committed = vi.mocked(deps.commit).mock.calls[0][0];
    expect(committed.p_engine_state.lifelines.audience).toMatchObject({
      used: true,
      usedAtPosition: 4,
      percentages: [50, 0, 0, 50],
      notEnoughVotes: false,
    });
    expect(committed.p_engine_state.correctIndex).toBeNull();
    expect(committed.p_public_state.lifelines.phone.hintIsCorrect).toBeNull();
  });

  it('spends audience with fewer than three counted votes and no percentages', async () => {
    const state = activeState();
    const deps = makeDeps(state, {
      loadVotes: vi.fn(async () => [
        { option_index: 0 },
        { option_index: 3 },
        { option_index: 4 },
      ]),
    });

    await runSessionEvent(deps, { sessionId, event: lifelineRequest('audience') });

    expect(vi.mocked(deps.commit).mock.calls[0][0].p_engine_state.lifelines.audience)
      .toMatchObject({
        used: true,
        notEnoughVotes: true,
        percentages: null,
      });
  });

  it.each([
    ['wrong state', activeState({ status: 'locked' }), 'wrong_state', undefined],
    ['host actor', activeState(), 'not_allowed', { id: hostId, role: 'host' as const }],
    ['wrong contestant id', activeState(), 'not_allowed', { id: 'other-contestant', role: 'contestant' as const }],
    ['expired deadline', activeState(), 'deadline_passed', undefined],
    ['already used', activeState({
      lifelines: {
        ...createInitialState().lifelines,
        fiftyFifty: { used: true, usedAtPosition: 1, removed: [1, 2] },
      },
    }), 'lifeline_used', undefined],
  ] as const)('does not load sensitive dependencies after dry run rejects for %s', async (
    _label,
    state,
    error,
    actor,
  ) => {
    const deps = makeDeps(state, {
      now: vi.fn(() => error === 'deadline_passed' ? 200 : 100),
    });

    await expect(runSessionEvent(deps, {
      sessionId,
      event: lifelineRequest('fifty_fifty', actor),
    })).resolves.toEqual({ ok: false, reason: 'rejected', error });

    expect(deps.loadCorrectIndex).not.toHaveBeenCalled();
    expect(deps.loadVotes).not.toHaveBeenCalled();
    expect(deps.randomInt).not.toHaveBeenCalled();
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('uses exactly one clock value for the lifeline dry run and real run', async () => {
    const now = vi.fn()
      .mockReturnValueOnce(199)
      .mockReturnValue(200);
    const deps = makeDeps(activeState(), { now });

    await expect(runSessionEvent(deps, {
      sessionId,
      event: lifelineRequest('audience'),
    })).resolves.toMatchObject({ ok: true });

    expect(now).toHaveBeenCalledOnce();
  });

  it.each(['fifty_fifty', 'phone'] as const)(
    'returns unknown without committing when %s has no correct index',
    async (lifeline) => {
      const deps = makeDeps(activeState(), {
        loadCorrectIndex: vi.fn(async () => null),
      });
      await expect(runSessionEvent(deps, {
        sessionId,
        event: lifelineRequest(lifeline),
      })).resolves.toEqual({ ok: false, reason: 'unknown' });
      expect(deps.commit).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['correct index', 'fifty_fifty', { loadCorrectIndex: vi.fn(async () => { throw new Error('answer detail'); }) }],
    ['votes', 'audience', { loadVotes: vi.fn(async () => { throw new Error('vote detail'); }) }],
    ['random source', 'fifty_fifty', { randomInt: vi.fn(() => { throw new Error('random detail'); }) }],
  ] as const)('returns unknown when the %s dependency throws', async (_name, lifeline, overrides) => {
    const deps = makeDeps(activeState(), overrides);
    await expect(runSessionEvent(deps, {
      sessionId,
      event: lifelineRequest(lifeline),
    })).resolves.toEqual({ ok: false, reason: 'unknown' });
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it.each(['phone', 'audience'] as const)(
    'reloads %s source on conflict retry',
    async (lifeline) => {
      const state = activeState();
      const loadSession = vi.fn(async () => ({
        hostId,
        engineState: structuredClone(state),
        version: 7,
        currentQuestion: question,
      }));
      const commit = vi.fn<RunSessionEventDeps['commit']>()
        .mockResolvedValueOnce({ data: null, error: { code: 'PJ003' } })
        .mockResolvedValueOnce({ data: 9, error: null });
      const loadCorrectIndex = vi.fn(async () => 2 as const);
      const loadVotes = vi.fn(async () => [{ option_index: 2 }, { option_index: 3 }]);
      const deps = makeDeps(state, {
        loadSession,
        loadCorrectIndex,
        loadVotes,
        commit,
      });

      await expect(runSessionEvent(deps, {
        sessionId,
        event: lifelineRequest(lifeline),
      })).resolves.toEqual({ ok: true, version: 9 });

      expect(loadSession).toHaveBeenCalledTimes(2);
      if (lifeline === 'phone') {
        expect(loadCorrectIndex).toHaveBeenCalledTimes(2);
        expect(loadVotes).not.toHaveBeenCalled();
      } else {
        expect(loadVotes).toHaveBeenCalledTimes(2);
        expect(loadCorrectIndex).not.toHaveBeenCalled();
      }
    },
  );

  it('ignores runtime payload fields supplied with a lifeline request', async () => {
    const event = {
      type: 'use_lifeline' as const,
      actor: { id: participantId, role: 'contestant' as const },
      lifeline: 'fifty_fifty' as const,
      remove: [0, 1],
      hint: 3,
      hintIsCorrect: true,
      voteCounts: [9, 8, 7, 6],
      correctIndex: 3,
    } as RunnableEvent;
    const deps = makeDeps(activeState(), {
      loadCorrectIndex: vi.fn(async () => 2 as const),
      randomInt: vi.fn(() => 0),
    });

    await runSessionEvent(deps, { sessionId, event });

    expect(vi.mocked(deps.commit).mock.calls[0][0].p_engine_state.lifelines.fiftyFifty.removed)
      .toEqual([1, 3]);
  });

  it('keeps distinctive lifeline inputs out of console output', async () => {
    const privateSessionId = 'distinctive-lifeline-session-841';
    const privateHostId = 'distinctive-lifeline-host-952';
    const privateParticipantId = 'distinctive-lifeline-contestant-163';
    const privateVoteValue = 'distinctive-vote-value-274';
    const privateCorrectAnswerContext = 'correct answer context 385';
    const before = loggedOutput.length;
    const state = activeState({ contestantId: privateParticipantId });
    const privateDeps = (overrides: Partial<RunSessionEventDeps> = {}) =>
      makeDeps(state, {
        loadSession: vi.fn(async () => ({
          hostId: privateHostId,
          engineState: structuredClone(state),
          version: 7,
          currentQuestion: question,
        })),
        loadCorrectIndex: vi.fn(async () => 3 as const),
        loadVotes: vi.fn(async () => [
          { option_index: 0, participant_id: privateVoteValue },
          { option_index: 3, participant_id: privateVoteValue },
        ]),
        randomInt: vi.fn(() => 0),
        ...overrides,
      });
    const deps = privateDeps();

    await runSessionEvent(deps, {
      sessionId: privateSessionId,
      event: lifelineRequest('fifty_fifty', {
        id: privateParticipantId,
        role: 'contestant',
      }),
    });
    await runSessionEvent(deps, {
      sessionId: privateSessionId,
      event: lifelineRequest('audience', {
        id: privateParticipantId,
        role: 'contestant',
      }),
    });
    await runSessionEvent(deps, {
      sessionId: privateSessionId,
      event: lifelineRequest('phone', {
        id: privateParticipantId,
        role: 'contestant',
      }),
    });
    await runSessionEvent(privateDeps({
      loadCorrectIndex: vi.fn(async () => {
        throw new Error(privateCorrectAnswerContext);
      }),
    }), {
      sessionId: privateSessionId,
      event: lifelineRequest('phone', {
        id: privateParticipantId,
        role: 'contestant',
      }),
    });
    await runSessionEvent(privateDeps({
      loadVotes: vi.fn(async () => {
        throw new Error(privateVoteValue);
      }),
    }), {
      sessionId: privateSessionId,
      event: lifelineRequest('audience', {
        id: privateParticipantId,
        role: 'contestant',
      }),
    });
    await runSessionEvent(privateDeps({
      randomInt: vi.fn(() => {
        throw new Error(privateCorrectAnswerContext);
      }),
    }), {
      sessionId: privateSessionId,
      event: lifelineRequest('fifty_fifty', {
        id: privateParticipantId,
        role: 'contestant',
      }),
    });

    const output = JSON.stringify(loggedOutput.slice(before));
    for (const value of [
      privateSessionId,
      privateHostId,
      privateParticipantId,
      privateVoteValue,
      privateCorrectAnswerContext,
      '3',
      JSON.stringify([{ option_index: 0, participant_id: privateVoteValue }]),
    ]) {
      expect(output).not.toContain(value);
    }
  });

  it('commits set_contestant with the loaded version and public state', async () => {
    const state = createInitialState();
    state.lifelines.phone = {
      used: true,
      usedAtPosition: 1,
      hint: 2,
      hintIsCorrect: true,
    };
    const deps = makeDeps(state);
    const event = makeEvent({
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId,
    });

    const result = await runSessionEvent(deps, { sessionId, event });

    expect(result).toEqual({ ok: true, version: 8 });
    expect(deps.commit).toHaveBeenCalledWith({
      p_session_id: sessionId,
      p_expected_version: 7,
      p_engine_state: { ...state, contestantId: participantId },
      p_public_state: toPublicState({ ...state, contestantId: participantId }),
      p_current_question: null,
      p_set_contestant_id: participantId,
    });
    const committed = vi.mocked(deps.commit).mock.calls[0][0];
    expect(committed.p_public_state.lifelines.phone.hintIsCorrect).toBeNull();
    expect(deps.loadQuestionAt).not.toHaveBeenCalled();
  });

  it('loads the position one question when start succeeds and commits only safe question data', async () => {
    const state = { ...createInitialState(), contestantId: participantId };
    const privateQuestion = { ...question, correct_index: 2 };
    const deps = makeDeps(state, {
      loadQuestionAt: vi.fn(async () => privateQuestion),
    });
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    const result = await runSessionEvent(deps, { sessionId, event });

    expect(result).toEqual({ ok: true, version: 8 });
    expect(deps.loadQuestionAt).toHaveBeenCalledWith(sessionId, 1);
    expect(deps.loadQuestionAt).toHaveBeenCalledTimes(1);
    expect(deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        p_expected_version: 7,
        p_current_question: {
          id: question.id,
          text: question.text,
          options: question.options,
        },
        p_set_contestant_id: null,
        p_engine_state: expect.objectContaining({
          status: 'question_active',
          questionEndsAt: 100 + QUESTION_DURATION_MS,
        }),
      }),
    );
    const committed = vi.mocked(deps.commit).mock.calls[0][0];
    expect(Object.keys(committed.p_current_question ?? {}).sort()).toEqual([
      'id',
      'options',
      'text',
    ]);
    expect(JSON.stringify(committed)).not.toContain('correct_index');
  });

  it.each([
    {
      name: 'select_answer',
      state: {
        ...createInitialState(),
        status: 'question_active' as const,
        position: 1,
        contestantId: participantId,
        questionEndsAt: 200,
      },
      event: makeEvent({
        type: 'select_answer',
        actor: { id: participantId, role: 'contestant' },
        option: 2,
      }),
    },
    {
      name: 'lock_in',
      state: {
        ...createInitialState(),
        status: 'question_active' as const,
        position: 1,
        contestantId: participantId,
        questionEndsAt: 200,
        selectedAnswer: 2 as const,
      },
      event: makeEvent({
        type: 'lock_in',
        actor: { id: participantId, role: 'contestant' },
      }),
    },
    {
      name: 'use_lifeline',
      state: {
        ...createInitialState(),
        status: 'question_active' as const,
        position: 1,
        contestantId: participantId,
        questionEndsAt: 200,
      },
      event: makeEvent({
        type: 'use_lifeline',
        actor: { id: participantId, role: 'contestant' },
        lifeline: 'phone',
      }),
    },
  ])('$name reuses the stored question during question_active', async ({ state, event }) => {
    const deps = makeDeps(state, {
      loadCorrectIndex: vi.fn(async () => 0 as const),
      randomInt: vi.fn(() => 0),
    });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toMatchObject({
      ok: true,
    });

    expect(deps.loadQuestionAt).not.toHaveBeenCalled();
    expect(vi.mocked(deps.commit).mock.calls[0][0].p_current_question).toEqual(question);
  });

  it.each([
    ['missing', null],
    ['malformed', { id: question.id, text: question.text, options: ['A', 'B', 'C'] }],
  ])('returns unknown for a %s stored question during question_active events', async (_label, currentQuestion) => {
    const state = {
      ...createInitialState(),
      status: 'question_active' as const,
      position: 1,
      contestantId: participantId,
      questionEndsAt: 200,
      selectedAnswer: 2 as const,
    };
    const deps = makeDeps(state, {}, currentQuestion);
    const event = makeEvent({
      type: 'select_answer',
      actor: { id: participantId, role: 'contestant' },
      option: 1,
    });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(deps.loadQuestionAt).not.toHaveBeenCalled();
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('loads the next position question once when next succeeds', async () => {
    const state = {
      ...createInitialState(),
      status: 'revealed' as const,
      position: 1,
      contestantId: participantId,
      lastResult: 'correct' as const,
    };
    const deps = makeDeps(state);
    const event = makeEvent({ type: 'next', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toMatchObject({
      ok: true,
    });

    expect(deps.loadQuestionAt).toHaveBeenCalledTimes(1);
    expect(deps.loadQuestionAt).toHaveBeenCalledWith(sessionId, 2);
  });

  it.each([
    [
      'locked',
      {
        ...createInitialState(),
        status: 'question_active' as const,
        position: 1,
        contestantId: participantId,
        questionEndsAt: 200,
        selectedAnswer: 2 as const,
      },
      makeEvent({ type: 'lock_in', actor: { id: participantId, role: 'contestant' } }),
    ],
    [
      'revealed',
      {
        ...createInitialState(),
        status: 'locked' as const,
        position: 1,
        contestantId: participantId,
        lockedAnswer: 0 as const,
      },
      makeEvent({
        type: 'reveal',
        actor: { id: hostId, role: 'host' },
      }),
    ],
  ])('keeps the existing current question when the new state is %s', async (_label, state, event) => {
    const deps = makeDeps(state);

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toMatchObject({
      ok: true,
    });
    expect(deps.loadQuestionAt).not.toHaveBeenCalled();
    expect(deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        p_current_question: question,
      }),
    );
  });

  it('keeps the stored question when a wrong reveal ends the game', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 1,
      contestantId: participantId,
      lockedAnswer: 1,
    };
    const event = makeEvent({
      type: 'reveal',
      actor: { id: hostId, role: 'host' },
    });

    await expectFinishedQuestionCommit(state, event, 0);
  });

  it('keeps the stored question when a timeout reveal ends the game', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 1,
      contestantId: participantId,
      lockedAnswer: null,
    };
    const event = makeEvent({
      type: 'reveal',
      actor: { id: hostId, role: 'host' },
    });

    await expectFinishedQuestionCommit(state, event, 0);
  });

  it('keeps the stored question when a correct answer on question 15 ends the game', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'locked',
      position: 15,
      contestantId: participantId,
      lockedAnswer: 0,
    };
    const event = makeEvent({
      type: 'reveal',
      actor: { id: hostId, role: 'host' },
    });

    await expectFinishedQuestionCommit(state, event, 0);
  });

  it('keeps the stored question when ending a session during an active question', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'question_active',
      position: 1,
      contestantId: participantId,
      questionEndsAt: 200,
    };
    const event = makeEvent({ type: 'end_session', actor: { id: hostId, role: 'host' } });

    await expectFinishedQuestionCommit(state, event, null);
  });

  it('keeps the stored question when the contestant walks away', async () => {
    const state: SessionState = {
      ...createInitialState(),
      status: 'revealed',
      position: 1,
      contestantId: participantId,
      correctIndex: 0,
      lastResult: 'correct',
    };
    const event = makeEvent({
      type: 'walk_away',
      actor: { id: participantId, role: 'contestant' },
    });

    await expectFinishedQuestionCommit(state, event, 0);
  });

  it('clears the current question when ending a session in waiting', async () => {
    const deps = makeDeps(createInitialState(), {}, null);
    const event = makeEvent({ type: 'end_session', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toMatchObject({
      ok: true,
    });
    expect(vi.mocked(deps.commit).mock.calls[0][0].p_current_question).toBeNull();
    expect(deps.loadQuestionAt).not.toHaveBeenCalled();
  });

  it('returns not_found when the host does not own the session', async () => {
    const deps = makeDeps(createInitialState());
    const event = makeEvent({
      type: 'set_contestant',
      actor: { id: 'other-host', role: 'host' },
      participantId,
    });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(deps.commit).not.toHaveBeenCalled();
    expect(deps.loadQuestionAt).not.toHaveBeenCalled();
  });

  it('returns not_found for a missing session', async () => {
    const deps = makeDeps(createInitialState(), {
      loadSession: vi.fn(async () => null),
    });
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('returns the engine rejection when start has no contestant', async () => {
    const deps = makeDeps(createInitialState());
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'rejected',
      error: 'no_contestant',
    });
    expect(deps.commit).not.toHaveBeenCalled();
    expect(deps.loadQuestionAt).not.toHaveBeenCalled();
  });

  it('returns the wrong_state rejection when the event does not match the state', async () => {
    const state = { ...createInitialState(), status: 'question_active' as const };
    const deps = makeDeps(state);
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'rejected',
      error: 'wrong_state',
    });
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('retries a conflict with freshly loaded state and version', async () => {
    const firstState = { ...createInitialState(), contestantId: participantId };
    const secondState = {
      ...firstState,
      lifelines: {
        ...firstState.lifelines,
        phone: { used: true, usedAtPosition: 0, hint: 1 as const, hintIsCorrect: false },
      },
    };
    const loadSession = vi
      .fn<RunSessionEventDeps['loadSession']>()
      .mockResolvedValueOnce({
        hostId,
        engineState: firstState,
        version: 3,
        currentQuestion: null,
      })
      .mockResolvedValueOnce({
        hostId,
        engineState: secondState,
        version: 9,
        currentQuestion: null,
      });
    const commit = vi
      .fn<RunSessionEventDeps['commit']>()
      .mockResolvedValueOnce({ data: null, error: { code: 'PJ003' } })
      .mockResolvedValueOnce({ data: 10, error: null });
    const deps = makeDeps(firstState, { loadSession, commit });
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: true,
      version: 10,
    });
    expect(loadSession).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][0].p_expected_version).toBe(9);
    expect(commit.mock.calls[1][0].p_engine_state.lifelines.phone.used).toBe(true);
    expect(commit.mock.calls[1][0].p_engine_state.questionEndsAt).toBe(
      100 + QUESTION_DURATION_MS,
    );
  });

  it('returns conflict after two compare and swap failures', async () => {
    const state = { ...createInitialState(), contestantId: participantId };
    const deps = makeDeps(state, {
      commit: vi.fn(async () => ({ data: null, error: { code: 'PJ003' } })),
    });
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(deps.loadSession).toHaveBeenCalledTimes(2);
    expect(deps.commit).toHaveBeenCalledTimes(2);
  });

  it('returns the second engine rejection after a conflict without another commit', async () => {
    const loadSession = vi
      .fn<RunSessionEventDeps['loadSession']>()
      .mockResolvedValueOnce({
        hostId,
        engineState: { ...createInitialState(), contestantId: participantId },
        version: 3,
        currentQuestion: null,
      })
      .mockResolvedValueOnce({
        hostId,
        engineState: createInitialState(),
        version: 4,
        currentQuestion: null,
      });
    const commit = vi
      .fn<RunSessionEventDeps['commit']>()
      .mockResolvedValueOnce({ data: null, error: { code: 'PJ003' } });
    const deps = makeDeps(createInitialState(), { loadSession, commit });
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'rejected',
      error: 'no_contestant',
    });
    expect(loadSession).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['PJ004', 'participant_not_found'],
    ['PJ005', 'unsafe_state'],
  ] as const)('maps %s without retrying', async (code, reason) => {
    const deps = makeDeps(createInitialState(), {
      commit: vi.fn(async () => ({ data: null, error: { code } })),
    });
    const event = makeEvent({
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId,
    });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason,
    });
    expect(deps.commit).toHaveBeenCalledTimes(1);
    expect(deps.loadSession).toHaveBeenCalledTimes(1);
  });

  it('returns unknown for an unrecognized commit error code', async () => {
    const deps = makeDeps(createInitialState(), {
      commit: vi.fn(async () => ({ data: null, error: { code: 'XX001' } })),
    });
    const event = makeEvent({
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId,
    });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('returns unknown when commit has neither an error nor a version number', async () => {
    const deps = makeDeps(createInitialState(), {
      commit: vi.fn(async () => ({ data: null, error: null })),
    });
    const event = makeEvent({
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId,
    });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('does not log sensitive values for event failure scenarios', async () => {
    const privateSessionId = 'session-log-secret-827';
    const privateHostId = 'host-log-secret-193';
    const privateParticipantId = 'participant-log-secret-546';
    const privateQuestionText = 'distinctive private question text';
    const thrownMessage = `${privateSessionId} private dependency failure`;
    const privateQuestion = {
      id: 'question-log-secret-381',
      text: privateQuestionText,
      options: ['A', 'B', 'C', 'D'],
    };
    const sensitiveValues = [
      privateSessionId,
      privateHostId,
      privateParticipantId,
      privateQuestionText,
      thrownMessage,
    ];
    const assertLogsRedacted = (): void => {
      const output = JSON.stringify(loggedOutput);
      for (const value of sensitiveValues) {
        expect(output).not.toContain(value);
      }
    };
    const privateEvent = makeEvent({
      type: 'set_contestant',
      actor: { id: privateHostId, role: 'host' },
      participantId: privateParticipantId,
    });
    const privateStartEvent = makeEvent({
      type: 'start',
      actor: { id: privateHostId, role: 'host' },
    });
    const privateState = { ...createInitialState(), contestantId: privateParticipantId };
    const privateDeps = (
      overrides: Partial<RunSessionEventDeps> = {},
      engineState: unknown = createInitialState(),
    ): RunSessionEventDeps =>
      makeDeps(engineState, {
        loadSession: vi.fn(async () => ({
          hostId: privateHostId,
          engineState: structuredClone(engineState),
          version: 7,
          currentQuestion: privateQuestion,
        })),
        ...overrides,
      });

    await expect(runSessionEvent(
      privateDeps({
        commit: vi.fn(async () => ({ data: null, error: { code: 'XX901' } })),
      }),
      { sessionId: privateSessionId, event: privateEvent },
    )).resolves.toMatchObject({ ok: false, reason: 'unknown' });
    assertLogsRedacted();

    await expect(runSessionEvent(
      privateDeps({
        commit: vi.fn(async () => ({ data: null, error: { code: 'PJ005' } })),
      }),
      { sessionId: privateSessionId, event: privateEvent },
    )).resolves.toMatchObject({ ok: false, reason: 'unsafe_state' });
    assertLogsRedacted();

    await expect(runSessionEvent(
      privateDeps({
        commit: vi.fn(async () => {
          throw new Error(thrownMessage);
        }),
      }),
      { sessionId: privateSessionId, event: privateEvent },
    )).resolves.toMatchObject({ ok: false, reason: 'unknown' });
    assertLogsRedacted();

    await expect(runSessionEvent(
      privateDeps({}, null),
      { sessionId: privateSessionId, event: privateEvent },
    )).resolves.toMatchObject({ ok: false, reason: 'unknown' });
    assertLogsRedacted();

    await expect(runSessionEvent(
      privateDeps({
        commit: vi.fn(async () => ({ data: null, error: null })),
      }),
      { sessionId: privateSessionId, event: privateEvent },
    )).resolves.toMatchObject({ ok: false, reason: 'unknown' });
    assertLogsRedacted();

    await expect(runSessionEvent(
      privateDeps(
        { loadQuestionAt: vi.fn(async () => null) },
        privateState,
      ),
      { sessionId: privateSessionId, event: privateStartEvent },
    )).resolves.toMatchObject({ ok: false, reason: 'unknown' });
    assertLogsRedacted();
  });

  it.each([
    ['null state', null],
    ['string state', 'invalid'],
    ['non-string status', { status: 4 }],
  ])('returns unknown for invalid stored engine state (%s)', async (_label, engineState) => {
    const deps = makeDeps(engineState);
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('returns unknown when the current question is missing at start', async () => {
    const state = { ...createInitialState(), contestantId: participantId };
    const deps = makeDeps(state, {
      loadQuestionAt: vi.fn(async () => null),
    });
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it.each([
    ['loadSession', { loadSession: vi.fn(async () => { throw new Error('private text'); }) }],
    [
      'loadQuestionAt',
      {
        loadQuestionAt: vi.fn(async () => {
          throw new Error('private text');
        }),
      },
    ],
    [
      'commit',
      {
        commit: vi.fn(async () => {
          throw new Error('private text');
        }),
      },
    ],
    [
      'now',
      {
        now: vi.fn(() => {
          throw new Error('private text');
        }),
      },
    ],
  ])('returns unknown when %s throws', async (_dependency, overrides) => {
    const state = { ...createInitialState(), contestantId: participantId };
    const deps = makeDeps(state, overrides);
    const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

    await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('does not mutate a deeply frozen event', async () => {
    const state = createInitialState();
    const deps = makeDeps(state);
    const event = makeEvent({
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId,
    });

    await runSessionEvent(deps, { sessionId, event });

    expect(event).toEqual({
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId,
    });
  });
});
