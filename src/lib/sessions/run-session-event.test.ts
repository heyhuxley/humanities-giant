import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialState,
  QUESTION_DURATION_MS,
  toPublicState,
  type GameEvent,
  type SessionState,
} from '../../game';
import { runSessionEvent, type RunSessionEventDeps } from './run-session-event';

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

function makeEvent<T extends GameEvent>(event: T): T {
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
    commit: vi.fn(async () => ({ data: 8, error: null })),
    now: vi.fn(() => 100),
    ...overrides,
  };
}

async function expectFinishedQuestionCommit(
  state: SessionState,
  event: GameEvent,
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

let loggedOutput: string[];
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  loggedOutput = [];
  consoleError = vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
    loggedOutput.push(values.join(' '));
  });
});

afterEach(() => {
  expect(loggedOutput.join(' ')).not.toContain(sessionId);
  expect(loggedOutput.join(' ')).not.toContain(hostId);
  expect(loggedOutput.join(' ')).not.toContain(participantId);
  expect(loggedOutput.join(' ')).not.toContain(questionText);
  consoleError.mockRestore();
});

describe('runSessionEvent', () => {
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
        correctIndex: 0,
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
      correctIndex: 0,
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
      correctIndex: 0,
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
      correctIndex: 0,
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

  it.each([null, 'invalid', { status: 4 }])(
    'returns unknown for invalid stored engine state',
    async (engineState) => {
      const deps = makeDeps(engineState);
      const event = makeEvent({ type: 'start', actor: { id: hostId, role: 'host' } });

      await expect(runSessionEvent(deps, { sessionId, event })).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
      expect(deps.commit).not.toHaveBeenCalled();
    },
  );

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
