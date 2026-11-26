import { describe, expect, it } from 'vitest';
import {
  checkBoundaries,
  extractImports,
  findForbiddenPlayerLifelineFields,
  findIdentifierFiles,
  findImportsFromDirectories,
  findImportsOfFiles,
  findUnexpectedIdentifierFiles,
  findAnswerDataFiles,
  findDynamicFromCalls,
  findParticipantIdentifierMatches,
  findVotesTableReads,
  isClientFile,
  isExactVotesRead,
  resolveSpecifier,
} from './import-boundaries';

const DATABASE_ANSWER_COLUMN = 'correct' + '_index';

const PAGE = 'src/app/host/sessions/[id]/page.tsx';
const CLIENT = 'src/app/host/sessions/[id]/session-controls.tsx';
const DEPS = '@/lib/sessions/session-event-deps';
const ADMIN = '@/lib/supabase/admin';

function violations(path: string, source: string) {
  return checkBoundaries([{ path, source }]);
}

function expectRule(
  found: ReturnType<typeof checkBoundaries>,
  rule: string,
): void {
  expect(found.some((violation) => violation.rule === rule)).toBe(true);
}

describe('extractImports', () => {
  it('finds static, side effect, type only, multiline, export, dynamic, and require imports', () => {
    expect(extractImports(`
      import '@/side-effect';
      import type { A } from "@/types";
      import {
        B,
        C,
      } from
        '@/multi-line';
      export { D } from '@/named-export';
      export * from "@/star-export";
      const lazy = import('@/dynamic');
      const required = require("@/required");
    `)).toEqual([
      '@/side-effect',
      '@/types',
      '@/multi-line',
      '@/named-export',
      '@/star-export',
      '@/dynamic',
      '@/required',
    ]);
  });

  it('returns no specifiers for a source without imports', () => {
    expect(extractImports('export const value = "plain text";')).toEqual([]);
  });
});

describe('resolveSpecifier', () => {
  it('resolves aliases and strips extensions and index files', () => {
    expect(resolveSpecifier('@/lib/sessions/index.ts', PAGE)).toBe('src/lib/sessions');
  });

  it('resolves relative Windows and forward slash paths equivalently', () => {
    const fromWindowsPath = resolveSpecifier(
      '..\\..\\..\\..\\lib\\sessions\\session-event-deps.ts',
      'src\\app\\host\\sessions\\[id]\\page.tsx',
    );
    const fromForwardPath = resolveSpecifier(
      '../../../../lib/sessions/session-event-deps.ts',
      PAGE,
    );
    expect(fromWindowsPath).toBe('src/lib/sessions/session-event-deps');
    expect(fromWindowsPath).toBe(fromForwardPath);
  });

  it('treats the bracketed route segment literally', () => {
    expect(resolveSpecifier('./session-controls.tsx', CLIENT)).toBe(
      'src/app/host/sessions/[id]/session-controls',
    );
  });
});

describe('isClientFile', () => {
  it('detects a directive after a leading comment and blank lines', () => {
    expect(isClientFile('\n  // client component\n\n  "use client";\nimport React from "react";')).toBe(true);
    expect(isClientFile('/* client component */\n\'use client\'\n')).toBe(true);
  });

  it('does not treat a later string mentioning the directive as a client file', () => {
    expect(isClientFile('const text = "use client";')).toBe(false);
  });
});

describe('hardening helpers', () => {
  it('finds lifeline result fields in player facing fake sources, but not prose', () => {
    const fakeSources = [
      { path: 'src/app/play/unsafe.tsx', source: 'state.hintIsCorrect' },
      { path: 'src/components/unsafe.tsx', source: 'const { removed } = state;' },
      { path: 'src/lib/sessions/read-public-state.ts', source: 'const value = { percentages: [] };' },
      { path: 'src/lib/sessions/player-flows.ts', source: "const value = { 'hint': 1 };" },
      { path: 'src/lib/sessions/player-forms.ts', source: 'const key = ["voteCounts"];' },
      { path: 'src/lib/sessions/player-messages.ts', source: 'const value = { notEnoughVotes: true };' },
      { path: 'src/app/play/copy.tsx', source: '// hint and percentages are not shown' },
      { path: 'src/app/play/copy.test.ts', source: 'state.hintIsCorrect' },
      { path: 'src/lib/sessions/unrelated.ts', source: 'state.hintIsCorrect' },
    ];

    expect(findForbiddenPlayerLifelineFields(fakeSources)).toEqual([
      'src/app/play/unsafe.tsx:hintIsCorrect',
      'src/components/unsafe.tsx:removed',
      'src/lib/sessions/player-flows.ts:hint',
      'src/lib/sessions/player-forms.ts:voteCounts',
      'src/lib/sessions/player-messages.ts:notEnoughVotes',
      'src/lib/sessions/read-public-state.ts:percentages',
    ]);
  });

  it('matches only the exact votes read chain', () => {
    const sessionId = 'sessionId';
    const position = 'position';
    expect(isExactVotesRead(
      `admin.from('votes').select('option_index').eq('session_id', ${sessionId}).eq('position', ${position});`,
    )).toBe(true);
    expect(isExactVotesRead(
      `admin.from("votes").select("option_index").eq("session_id", ${sessionId}).eq("position", ${position});`,
    )).toBe(true);
    expect(isExactVotesRead(
      `admin
        .from(\`votes\`)
        .select(\`option_index\`)
        .eq(\`session_id\`, ${sessionId})
        .eq(\`position\`, ${position});`,
    )).toBe(true);

    const failures = [
      `admin.from('votes').select('option_index, participant_id').eq('session_id', ${sessionId}).eq('position', ${position});`,
      `admin.from('votes').select('*').eq('session_id', ${sessionId}).eq('position', ${position});`,
      `admin.from("votes").select("*").eq("session_id", ${sessionId}).eq("position", ${position});`,
      `admin.from(\`votes\`).select(\`*\`).eq("session_id", ${sessionId}).eq("position", ${position});`,
      `admin.from('votes').select().eq('session_id', ${sessionId}).eq('position', ${position});`,
      `const selected = 'option_index'; admin.from('votes').select(selected).eq('session_id', ${sessionId}).eq('position', ${position});`,
      `admin.from('votes').select('option_index').select('option_index').eq('session_id', ${sessionId}).eq('position', ${position});`,
      `admin.from('votes').select('option_index').eq('session_id', ${sessionId}).eq('position', ${position}).eq('extra', 1);`,
      `const tableName = 'votes'; admin.from(tableName).select('option_index').eq('session_id', ${sessionId}).eq('position', ${position});`,
    ];
    for (const source of failures) expect(isExactVotesRead(source), source).toBe(false);
  });

  it('counts exact votes reads and rejects participant identifier text', () => {
    const chain = "admin.from('votes').select('option_index').eq('session_id', sessionId).eq('position', position);";
    expect(findVotesTableReads([
      { path: 'src/lib/sessions/session-event-deps.ts', source: chain },
      { path: 'src/lib/sessions/other.ts', source: chain },
      { path: 'src/lib/sessions/session-event-deps.test.ts', source: chain },
    ])).toEqual([
      'src/lib/sessions/other.ts',
      'src/lib/sessions/session-event-deps.ts',
    ]);
    expect(findParticipantIdentifierMatches('const participant_id = 1; const participantId = 2;'))
      .toEqual(['participant_id', 'participantId']);
  });

  it('detects dynamic from calls and excludes only the named receivers', () => {
    const result = findDynamicFromCalls([
      { path: 'src/lib/sessions/literals.ts', source: "admin.from('sessions'); admin.from(`participants`);" },
      { path: 'src/lib/sessions/dynamic.ts', source: 'admin.from(tableName); admin.from(`${tableName}`);' },
      { path: 'src/lib/sessions/excluded.ts', source: 'Array.from([1]); Buffer.from("x"); Uint8Array.from([1]); Object.from([1]);' },
      { path: 'src/lib/sessions/example.test.ts', source: 'admin.from(tableName);' },
    ]);
    expect(result.violations.map((hit) => hit.filePath)).toEqual([
      'src/lib/sessions/dynamic.ts',
      'src/lib/sessions/dynamic.ts',
    ]);
    expect(result.exclusions.map((hit) => hit.receiver).sort()).toEqual([
      'Array',
      'Buffer',
      'Object',
      'Uint8Array',
    ]);
  });
});

describe('checkBoundaries', () => {
  it('scans exact identifier names and exempts test files by filename ending', () => {
    const identifier = ['correct', 'Index'].join('');
    const sources = [
      { path: 'src/game/types.ts', source: `export type Value = { ${identifier}: number };` },
      { path: 'src/lib/example.test.ts', source: `const ${identifier} = 1;` },
    ];

    expect(findIdentifierFiles(sources, identifier)).toEqual(['src/game/types.ts']);
    expect(findUnexpectedIdentifierFiles(sources, identifier, ['src/game/types.ts'])).toEqual([]);
    expect(findUnexpectedIdentifierFiles(sources, identifier, [])).toEqual(['src/game/types.ts']);
  });

  it('finds imports from restricted directories through aliases and relative paths', () => {
    const sources = [
      {
        path: 'src/app/play/[sessionId]/page.tsx',
        source: "import '@/app/host/sessions/actions'; import '@/lib/questions/validate';",
      },
      {
        path: 'src/app/join/join-form.tsx',
        source: "import '../host/questions/actions';",
      },
      {
        path: 'src/components/player.tsx',
        source: "import '../app/host/questions/question-form'; import '../lib/questions/form-data';",
      },
    ];

    expect(findImportsFromDirectories(
      sources,
      ['src/app/play', 'src/app/join', 'src/components'],
      ['src/app/host', 'src/lib/questions'],
    )).toEqual([
      { filePath: 'src/app/play/[sessionId]/page.tsx', importedPath: 'src/app/host/sessions/actions' },
      { filePath: 'src/app/play/[sessionId]/page.tsx', importedPath: 'src/lib/questions/validate' },
      { filePath: 'src/app/join/join-form.tsx', importedPath: 'src/app/host/questions/actions' },
      { filePath: 'src/components/player.tsx', importedPath: 'src/app/host/questions/question-form' },
      { filePath: 'src/components/player.tsx', importedPath: 'src/lib/questions/form-data' },
    ]);
  });

  it('finds imports of exact question authoring files in restricted directories', () => {
    const sources = [
      {
        path: 'src/app/play/[sessionId]/page.tsx',
        source: "import '@/app/host/questions/question-form';",
      },
      {
        path: 'src/components/question.tsx',
        source: "import '../app/host/questions/[id]/edit/page';",
      },
      {
        path: 'src/app/join/join-form.tsx',
        source: "import '../../lib/questions/validate';",
      },
    ];
    const authoringFiles = [
      'src/app/host/questions/question-form.tsx',
      'src/app/host/questions/[id]/edit/page.tsx',
      'src/lib/questions/validate.ts',
    ];

    expect(findImportsOfFiles(
      sources,
      ['src/app/play', 'src/app/join', 'src/components'],
      authoringFiles,
    )).toEqual([
      { filePath: 'src/app/play/[sessionId]/page.tsx', importedPath: 'src/app/host/questions/question-form' },
      { filePath: 'src/components/question.tsx', importedPath: 'src/app/host/questions/[id]/edit/page' },
      { filePath: 'src/app/join/join-form.tsx', importedPath: 'src/lib/questions/validate' },
    ]);
  });

  it('rejects private data and forbidden runtime imports in pure player modules', () => {
    const forbiddenText = 'session' + '_private';
    const cases = [
      {
        path: 'src/lib/sessions/player-forms.ts',
        source: `export const detail = '${forbiddenText}';`,
        rule: 'player-sensitive-source',
      },
      {
        path: 'src/lib/sessions/player-flows.ts',
        source: `import { castVote } from '@/lib/sessions/cast-vote';`,
        rule: 'player-pure-runtime-import',
      },
      {
        path: 'src/lib/sessions/player-messages.ts',
        source: `import '@/lib/supabase/admin';`,
        rule: 'player-pure-runtime-import',
      },
      {
        path: 'src/lib/sessions/player-flows.ts',
        source: `import '@/lib/sessions/session-event-deps';`,
        rule: 'player-pure-runtime-import',
      },
      {
        path: 'src/lib/sessions/player-flows.ts',
        source: `import '@/lib/sessions/answer-deps';`,
        rule: 'player-pure-runtime-import',
      },
    ];

    for (const testCase of cases) {
      expectRule(violations(testCase.path, testCase.source), testCase.rule);
    }
  });

  it('limits verified user imports to the server Supabase client', () => {
    expect(violations(
      'src/lib/sessions/verified-user.ts',
      `import 'server-only';\nimport { createClient } from '../supabase/server';`,
    )).toEqual([]);
    expectRule(
      violations(
        'src/lib/sessions/verified-user.ts',
        `import { createAdminClient } from '../supabase/admin';`,
      ),
      'verified-user-importer',
    );
  });

  it('allows client references to player server actions only', () => {
    expect(violations(
      'src/components/player-controls.tsx',
      `'use client';\nimport { submitAnswerAction } from '../app/play/[sessionId]/actions';`,
    )).toEqual([]);
    expectRule(
      violations(
        'src/components/player-controls.tsx',
        `'use client';\nimport { submitAnswerFlow } from '../lib/sessions/player-flows';`,
      ),
      'client-player-module-import',
    );
    expectRule(
      violations(
        'src/components/player-controls.tsx',
        `'use client';\nimport { getVerifiedUserId } from '../lib/sessions/verified-user';`,
      ),
      'client-player-module-import',
    );
  });

  it.each([
    [PAGE, `import { createRunSessionEventDeps } from '${DEPS}';`, 'app-module-importer'],
    [CLIENT, `'use client';\nimport '${DEPS}';`, 'client-import'],
    [PAGE, `import { createRunSessionEventDeps } from '../../session-event-deps';`, 'app-module-importer'],
    [CLIENT, `'use client';\nimport '../../session-event-deps';`, 'client-import'],
    [CLIENT, `'use client';\nimport type { Admin } from '${ADMIN}';`, 'client-import'],
    [PAGE, `const admin = import('${ADMIN}');`, 'admin-importer'],
    [PAGE, `export { createRunSessionEventDeps } from '${DEPS}';`, 'app-module-importer'],
    [
      'src/app/host/sessions/[id]/bad.tsx',
      `import '${ADMIN}';`,
      'admin-importer',
    ],
    [
      'src/app/host/sessions/[id]/bad.tsx',
      `import "${ADMIN}";`,
      'admin-importer',
    ],
    [
      'src/app/host/sessions/[id]/bad.tsx',
      `import '${DEPS}';`,
      'app-module-importer',
    ],
    [
      CLIENT,
      `'use client';\nimport '@/lib/auth/require-host/child';`,
      'client-import',
    ],
  ])('flags forbidden imports from %s', (path, source, rule) => {
    expectRule(violations(path, source), rule);
  });

  it('allows the dependency import in its authorized app action', () => {
    expect(violations(
      'src/app/host/sessions/[id]/actions.ts',
      `import { createRunSessionEventDeps } from '${DEPS}';`,
    )).toEqual([]);
  });

  it('allows the admin import in session event dependencies', () => {
    expect(violations(
      'src/lib/sessions/session-event-deps.ts',
      `import { createAdminClient } from '${ADMIN}';`,
    )).toEqual([]);
  });

  it('allows the admin import in answer dependencies', () => {
    expect(violations(
      'src/lib/sessions/answer-deps.ts',
      `import { createAdminClient } from '${ADMIN}';`,
    )).toEqual([]);
  });

  it('allows answer dependencies only in session dependencies and test files', () => {
    const answerDeps = '@/lib/sessions/answer-deps';
    expect(violations(
      'src/lib/sessions/session-event-deps.ts',
      `import { createAnswerDeps } from '${answerDeps}';`,
    )).toEqual([]);
    expect(violations(
      'src/lib/sessions/answer-deps.test.ts',
      `import { createAnswerDeps } from '${answerDeps}';`,
    )).toEqual([]);
    expectRule(
      violations('src/app/play/page.tsx', `import '${answerDeps}';`),
      'answer-deps-importer',
    );
    expectRule(
      violations('src/components/player.tsx', `'use client';\nimport '${answerDeps}';`),
      'answer-deps-importer',
    );
  });

  it('scans non test TypeScript files for answer field names', () => {
    expect(findAnswerDataFiles([
      { path: 'src/lib/sessions/answer-deps.ts', source: "from('question_answers')" },
      { path: 'src/app/host/questions.tsx', source: `.select("${DATABASE_ANSWER_COLUMN}")` },
      { path: 'src/lib/sessions/comment.ts', source: `// ${DATABASE_ANSWER_COLUMN} must stay private` },
      { path: 'src/lib/sessions/safe.ts', source: 'export const value = 1;' },
      { path: 'src/lib/sessions/example.test.ts', source: `question_answers ${DATABASE_ANSWER_COLUMN}` },
      { path: 'src/app/host/questions.js', source: 'question_answers' },
    ])).toEqual([
      'src/app/host/questions.tsx',
      'src/lib/sessions/answer-deps.ts',
      'src/lib/sessions/comment.ts',
    ]);
  });

  it('allows cast vote at runtime only from app actions and forbids client imports', () => {
    const castVote = '@/lib/sessions/cast-vote';
    expect(violations(
      'src/app/play/actions.ts',
      `import { castVote } from '${castVote}';`,
    )).toEqual([]);
    expectRule(
      violations('src/app/play/page.tsx', `import { castVote } from '${castVote}';`),
      'cast-vote-importer',
    );
    expectRule(
      violations('src/lib/sessions/other.ts', `import { castVote } from '${castVote}';`),
      'cast-vote-importer',
    );
    expectRule(
      violations('src/components/vote.tsx', `'use client';\nimport type { VoteOption } from '${castVote}';`),
      'client-import',
    );
    expect(violations(
      'src/lib/sessions/other.ts',
      `import type { VoteOption } from '${castVote}';`,
    )).toEqual([]);
  });

  it('allows the admin import in cast vote server module', () => {
    expect(violations(
      'src/lib/sessions/cast-vote.ts',
      `import { createAdminClient } from '${ADMIN}';`,
    )).toEqual([]);
  });

  it('exempts only test file name endings', () => {
    expect(violations(
      'src/app/host/sessions/[id]/check.test.ts',
      `import '${DEPS}';`,
    )).toEqual([]);
    expectRule(
      violations(
        'src/app/host/sessions/[id]/session-event-deps-helper.ts',
        `import '${DEPS}';`,
      ),
      'app-module-importer',
    );
  });

  it('detects a multiline forbidden import', () => {
    const found = violations(
      PAGE,
      `import {
        createRunSessionEventDeps,
      } from '${DEPS}';`,
    );
    expectRule(found, 'app-module-importer');
  });

  it('returns no violations for a file with no imports', () => {
    expect(violations(PAGE, 'export const pageText = "safe";')).toEqual([]);
  });
});
