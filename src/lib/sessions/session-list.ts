export type SessionListStatus =
  | 'waiting'
  | 'question_active'
  | 'locked'
  | 'revealed'
  | 'finished'
  | 'unknown';

export type SessionListItem = {
  id: string;
  code: string;
  status: SessionListStatus;
  createdAt: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const STATUSES: ReadonlySet<Exclude<SessionListStatus, 'unknown'>> = new Set([
  'waiting',
  'question_active',
  'locked',
  'revealed',
  'finished',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStatus(value: unknown): SessionListStatus {
  if (!isRecord(value) || typeof value.status !== 'string') return 'unknown';
  return STATUSES.has(value.status as Exclude<SessionListStatus, 'unknown'>)
    ? value.status as Exclude<SessionListStatus, 'unknown'>
    : 'unknown';
}

export function toSessionListItem(row: unknown): SessionListItem | null {
  if (!isRecord(row)) return null;
  const { id, code, public_state: publicState, created_at: createdAt } = row;
  if (
    typeof id !== 'string' ||
    !UUID_PATTERN.test(id) ||
    typeof code !== 'string' ||
    typeof createdAt !== 'string' ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    id,
    code,
    status: readStatus(publicState),
    createdAt,
  };
}
