import { describe, expect, it } from 'vitest';
import {
  checkBoundaries,
  extractImports,
  findAnswerDataFiles,
  isClientFile,
  resolveSpecifier,
} from './import-boundaries';

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

describe('checkBoundaries', () => {
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
      { path: 'src/app/host/questions.tsx', source: '.select("correct_index")' },
      { path: 'src/lib/sessions/safe.ts', source: 'export const value = 1;' },
      { path: 'src/lib/sessions/example.test.ts', source: 'question_answers correct_index' },
      { path: 'src/app/host/questions.js', source: 'question_answers' },
    ])).toEqual([
      'src/app/host/questions.tsx',
      'src/lib/sessions/answer-deps.ts',
    ]);
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
