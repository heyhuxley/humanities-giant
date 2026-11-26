import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkBoundaries,
  extractImports,
  findAnswerDataFiles,
  findIdentifierFiles,
  findForbiddenPlayerLifelineFields,
  findImportsFromDirectories,
  findImportsOfFiles,
  findUnexpectedIdentifierFiles,
  findDynamicFromCalls,
  findParticipantIdentifierMatches,
  findVotesTableReads,
  isActionFile,
  isClientFile,
  isTypeOnlyImport,
  isExactVotesRead,
  resolveSpecifier,
} from '../../test-utils/import-boundaries';

type SourceFile = { path: string; source: string };

const HOST_PAGE = 'src/app/host/sessions/[id]/page.tsx';
const HOST_CONTROLS = 'src/app/host/sessions/[id]/session-controls.tsx';
const HOST_ACTIONS = 'src/app/host/sessions/[id]/actions.ts';
const COUNTDOWN_TIMER = 'src/components/countdown-timer';
const LIFELINE_PAYLOADS = 'src/lib/sessions/lifeline-payloads';
const SESSION_EVENT_DEPS = 'src/lib/sessions/session-event-deps.ts';
const PLAY_ACTIONS = 'src/app/play/[sessionId]/actions.ts';
const CONTESTANT_PANEL = 'src/app/play/[sessionId]/contestant-panel.tsx';
const CONTESTANT_FORBIDDEN_IMPORTS = [
  'src/lib/supabase/admin',
  'src/lib/sessions/session-event-deps',
  'src/lib/sessions/run-session-event',
  'src/lib/sessions/answer-deps',
  'src/lib/sessions/cast-vote',
  'src/lib/sessions/player-forms',
  'src/lib/sessions/player-flows',
  'src/lib/sessions/player-messages',
  'src/lib/sessions/verified-user',
  'src/lib/sessions/lifeline-payloads',
  'src/lib/auth/require-host',
  'src/app/host',
];
const NODE_CRYPTO_ALLOWED_FILES = [
  'src/lib/sessions/join-code.ts',
  'src/lib/sessions/session-event-deps.ts',
].sort();
const DATABASE_ANSWER_COLUMN = 'correct' + '_index';
const PUBLIC_ANSWER_IDENTIFIER = ['correct', 'Index'].join('');
const HOST_SENSITIVE_FIELDS = ['question_answers', DATABASE_ANSWER_COLUMN, 'session_private'];
const PLAYER_IMPORT_DIRECTORIES = [
  'src/app/play',
  'src/app/join',
  'src/components',
];
const QUESTION_AUTHORING_FILES = [
  'src/app/host/questions/[id]/edit/page.tsx',
  'src/app/host/questions/actions.ts',
  'src/app/host/questions/delete-question-form.tsx',
  'src/app/host/questions/new/page.tsx',
  'src/app/host/questions/page.tsx',
  'src/app/host/questions/question-form.tsx',
  'src/lib/questions/db-errors.ts',
  'src/lib/questions/form-data.ts',
  'src/lib/questions/validate.ts',
];
const CORRECT_INDEX_ALLOWLIST = [
  'src/app/host/questions/[id]/edit/page.tsx',
  'src/app/host/questions/actions.ts',
  'src/app/host/questions/question-form.tsx',
  'src/app/play/[sessionId]/audience-panel.tsx',
  'src/app/play/[sessionId]/contestant-panel.tsx',
  'src/app/play/[sessionId]/page.tsx',
  'src/game/apply-event.ts',
  'src/game/initial-state.ts',
  'src/game/types.ts',
  'src/lib/questions/form-data.ts',
  'src/lib/questions/validate.ts',
  'src/lib/sessions/lifeline-payloads.ts',
  'src/lib/sessions/read-public-state.ts',
  'src/lib/sessions/reveal-view.ts',
  'src/lib/sessions/run-session-event.ts',
].sort();
const LIFELINE_FORBIDDEN_TEXT = [
  ['question', '_answers'].join(''),
  ['correct', '_index'].join(''),
  ['session', '_private'].join(''),
  ['Math', '.', 'random'].join(''),
  ['Date', '.', 'now'].join(''),
];

function sourceFiles(directory: string): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return [];
    return [{
      path: relative(process.cwd(), absolutePath).replaceAll('\\', '/'),
      source: readFileSync(absolutePath, 'utf8'),
    }];
  });
}

function importsClientCountdown(page: SourceFile, component: SourceFile): boolean {
  const countdownImports = extractImports(page.source).filter((specifier) =>
    resolveSpecifier(specifier, page.path) === COUNTDOWN_TIMER,
  );
  return countdownImports.length === 1 && isClientFile(component.source);
}

function containsHostSensitiveField(source: string): boolean {
  const normalizedSource = source.toLowerCase();
  return HOST_SENSITIVE_FIELDS.some((field) => normalizedSource.includes(field));
}

function actionDefinitionPaths(files: SourceFile[], actionName: string): string[] {
  const definition = new RegExp(`\\bexport\\s+async\\s+function\\s+${actionName}\\s*\\(`);
  return files
    .filter((file) => !file.path.endsWith('.test.ts') && definition.test(file.source))
    .map((file) => file.path)
    .sort();
}

function filesWithDatabaseAnswerColumn(files: SourceFile[]): string[] {
  return files
    .filter((file) => file.source.toLowerCase().includes(DATABASE_ANSWER_COLUMN))
    .map((file) => file.path)
    .sort();
}

function lifelineForbiddenImports(filesToCheck: SourceFile[]): string[] {
  const forbiddenModules = [
    'react',
    'next',
    '@supabase/supabase-js',
    'server-only',
    'node:crypto',
    'src/lib/supabase',
    'src/app',
  ];

  return filesToCheck.flatMap((file) =>
    extractImports(file.source)
      .map((specifier) => resolveSpecifier(specifier, file.path))
      .filter((resolved) => forbiddenModules.some((module) =>
        resolved === module || resolved.startsWith(`${module}/`),
      )),
  );
}

function importsResolvedModule(file: SourceFile, expectedModule: string): boolean {
  return extractImports(file.source).some((specifier) =>
    resolveSpecifier(specifier, file.path) === expectedModule,
  );
}

function lifelinePayloadImporters(filesToCheck: SourceFile[]): string[] {
  return filesToCheck
    .filter((file) => importsResolvedModule(file, LIFELINE_PAYLOADS))
    .map((file) => file.path)
    .sort();
}

function unexpectedLifelinePayloadImporters(filesToCheck: SourceFile[]): string[] {
  return lifelinePayloadImporters(filesToCheck).filter((filePath) =>
    filePath !== 'src/lib/sessions/run-session-event.ts' &&
    !/\.test\.tsx?$/i.test(filePath),
  );
}

function nodeCryptoImporters(filesToCheck: SourceFile[]): string[] {
  return filesToCheck
    .filter((file) => !/\.test\.tsx?$/i.test(file.path))
    .filter((file) => importsResolvedModule(file, 'node:crypto'))
    .map((file) => file.path)
    .sort();
}

function filesReadingVotes(filesToCheck: SourceFile[]): string[] {
  const votesTablePattern = /\.from\s*\(\s*(['"`])votes\1\s*\)/;
  return filesToCheck
    .filter((file) => !/\.test\.tsx?$/i.test(file.path))
    .filter((file) => votesTablePattern.test(file.source))
    .map((file) => file.path)
    .sort();
}

function selectsOnlyVoteOption(source: string): boolean {
  return /\.from\s*\(\s*(['"`])votes\1\s*\)\s*\.select\s*\(\s*(['"`])option_index\2\s*\)/.test(source);
}

describe('session import boundaries', () => {
  const files = sourceFiles(join(process.cwd(), 'src'));
  const answerDataFiles = findAnswerDataFiles(files);
  const castVoteFile = files.find((file) => file.path === 'src/lib/sessions/cast-vote.ts');
  const playerPurePaths = [
    'src/lib/sessions/player-forms.ts',
    'src/lib/sessions/player-flows.ts',
    'src/lib/sessions/player-messages.ts',
  ];
  const playerFiles = files.filter((file) =>
    playerPurePaths.includes(file.path) ||
    file.path === 'src/lib/sessions/verified-user.ts',
  );

  it('scans all source files and rejects every forbidden import', () => {
    const paths = new Set(files.map((file) => file.path));
    expect(files.length).toBeGreaterThanOrEqual(50);
    expect(paths.has('src/app/host/sessions/[id]/page.tsx')).toBe(true);
    expect(paths.has('src/app/host/sessions/[id]/actions.ts')).toBe(true);
    expect(checkBoundaries(files)).toEqual([]);
  });

  it('detects the forbidden database answer column in fake sources', () => {
    expect(filesWithDatabaseAnswerColumn([
      { path: 'src/app/play/fake.tsx', source: `const column = '${DATABASE_ANSWER_COLUMN}';` },
    ])).toEqual(['src/app/play/fake.tsx']);
  });

  it('keeps the database answer column out of player, component, and reveal helper files', () => {
    const restrictedFiles = files.filter((file) =>
      PLAYER_IMPORT_DIRECTORIES.some((directory) => file.path.startsWith(`${directory}/`)) ||
      [
        'src/lib/sessions/reveal-view.ts',
        'src/lib/sessions/ladder-view.ts',
        'src/lib/sessions/read-public-state.ts',
      ].includes(file.path),
    );
    expect(filesWithDatabaseAnswerColumn(restrictedFiles)).toEqual([]);
  });

  it('allows the public answer identifier only in the exact scanned source paths', () => {
    expect(findUnexpectedIdentifierFiles(
      files,
      PUBLIC_ANSWER_IDENTIFIER,
      CORRECT_INDEX_ALLOWLIST,
    )).toEqual([]);
    expect(findIdentifierFiles(files, PUBLIC_ANSWER_IDENTIFIER)).toEqual(
      CORRECT_INDEX_ALLOWLIST,
    );
    expect(findUnexpectedIdentifierFiles(
      [{
        path: 'src/lib/sessions/unlisted.ts',
        source: `export const value = ${PUBLIC_ANSWER_IDENTIFIER};`,
      }],
      PUBLIC_ANSWER_IDENTIFIER,
      CORRECT_INDEX_ALLOWLIST,
    )).toEqual(['src/lib/sessions/unlisted.ts']);
  });

  it('scans the lifeline payload module and keeps its public answer identifier allowlisted', () => {
    expect(files.some((file) => file.path === 'src/lib/sessions/lifeline-payloads.ts')).toBe(true);
    expect(findUnexpectedIdentifierFiles(
      files,
      PUBLIC_ANSWER_IDENTIFIER,
      CORRECT_INDEX_ALLOWLIST,
    )).toEqual([]);
    expect(findIdentifierFiles(files, PUBLIC_ANSWER_IDENTIFIER)).toEqual(
      CORRECT_INDEX_ALLOWLIST,
    );
  });

  it('keeps the lifeline payload module free of forbidden imports and source text', () => {
    const lifelineFile = files.find((file) => file.path === 'src/lib/sessions/lifeline-payloads.ts');
    expect(lifelineFile).toBeDefined();
    if (!lifelineFile) return;

    expect(lifelineForbiddenImports([lifelineFile])).toEqual([]);
    expect(LIFELINE_FORBIDDEN_TEXT.filter((text) => lifelineFile.source.includes(text))).toEqual([]);
  });

  it('detects forbidden lifeline imports and source text in fake files', () => {
    const fakeFiles: SourceFile[] = [
      {
        path: 'src/lib/sessions/lifeline-payloads.ts',
        source: [
          "import 'react';",
          "import 'next/server';",
          "import '@supabase/supabase-js';",
          "import '../supabase/admin';",
          "import '../supabase/server';",
          "import 'node:crypto';",
          "import '../../app/host/actions';",
          `const restricted = '${LIFELINE_FORBIDDEN_TEXT.join(' ')}';`,
        ].join('\n'),
      },
    ];

    expect(lifelineForbiddenImports(fakeFiles)).toHaveLength(7);
    expect(LIFELINE_FORBIDDEN_TEXT.filter((text) =>
      fakeFiles[0].source.includes(text),
    )).toEqual(LIFELINE_FORBIDDEN_TEXT);
  });

  it('limits lifeline payload imports to the runner and tests', () => {
    const importers = lifelinePayloadImporters(files);
    expect(importers).toContain('src/lib/sessions/run-session-event.ts');
    expect(unexpectedLifelinePayloadImporters(files)).toEqual([]);

    for (const file of files) {
      if (importsResolvedModule(file, LIFELINE_PAYLOADS) && isClientFile(file.source)) {
        expect(file.path).toBe('src/lib/sessions/run-session-event.ts');
      }
    }
  });

  it('detects disallowed lifeline payload importers and client imports in fake files', () => {
    const fakeFiles: SourceFile[] = [
      {
        path: 'src/lib/sessions/other.ts',
        source: "import { buildPhoneHint } from './lifeline-payloads';",
      },
      {
        path: 'src/components/other.tsx',
        source: "'use client'; import { buildPhoneHint } from '../lib/sessions/lifeline-payloads';",
      },
    ];
    expect(lifelinePayloadImporters(fakeFiles)).toEqual([
      'src/components/other.tsx',
      'src/lib/sessions/other.ts',
    ]);
    expect(unexpectedLifelinePayloadImporters(fakeFiles)).toEqual([
      'src/components/other.tsx',
      'src/lib/sessions/other.ts',
    ]);
    expect(fakeFiles.filter((file) =>
      importsResolvedModule(file, LIFELINE_PAYLOADS) && isClientFile(file.source),
    ).map((file) => file.path)).toEqual(['src/components/other.tsx']);
  });

  it('limits votes table reads to the exact session event dependency chain', () => {
    expect(findVotesTableReads(files)).toEqual([SESSION_EVENT_DEPS]);
    expect(filesReadingVotes(files)).toEqual([SESSION_EVENT_DEPS]);
    const depsFile = files.find((file) => file.path === SESSION_EVENT_DEPS);
    expect(depsFile).toBeDefined();
    expect(depsFile && isExactVotesRead(depsFile.source)).toBe(true);
    expect(depsFile && selectsOnlyVoteOption(depsFile.source)).toBe(true);
    expect(depsFile && findParticipantIdentifierMatches(depsFile.source)).toEqual([]);
  });

  it('proves exact and malformed votes chains in fake sources', () => {
    const id = 'sessionId';
    const position = 'position';
    const passing = [
      `admin.from('votes').select('option_index').eq('session_id', ${id}).eq('position', ${position});`,
      `admin.from("votes").select("option_index").eq("session_id", ${id}).eq("position", ${position});`,
      `admin
        .from("votes")
        .select("option_index")
        .eq("session_id", ${id})
        .eq("position", ${position});`,
    ];
    for (const source of passing) expect(isExactVotesRead(source), source).toBe(true);

    const failing = [
      `admin.from('votes').select('option_index, participant_id').eq('session_id', ${id}).eq('position', ${position});`,
      `admin.from('votes').select('*').eq('session_id', ${id}).eq('position', ${position});`,
      `admin.from("votes").select("*").eq("session_id", ${id}).eq("position", ${position});`,
      `admin.from(\`votes\`).select(\`*\`).eq("session_id", ${id}).eq("position", ${position});`,
      `admin.from('votes').select().eq('session_id', ${id}).eq('position', ${position});`,
      `const selected = 'option_index'; admin.from('votes').select(selected).eq('session_id', ${id}).eq('position', ${position});`,
      `admin.from('votes').select('option_index').select('option_index').eq('session_id', ${id}).eq('position', ${position});`,
      `admin.from('votes').select('option_index').eq('session_id', ${id}).eq('position', ${position}).eq('extra', 1);`,
      `const tableName = 'votes'; admin.from(tableName).select('option_index').eq('session_id', ${id}).eq('position', ${position});`,
    ];
    for (const source of failing) expect(isExactVotesRead(source), source).toBe(false);

    const secondRead: SourceFile[] = [
      { path: SESSION_EVENT_DEPS, source: passing[0] },
      { path: 'src/lib/sessions/another.ts', source: passing[0] },
    ];
    expect(findVotesTableReads(secondRead)).toEqual([
      'src/lib/sessions/another.ts',
      SESSION_EVENT_DEPS,
    ]);
  });

  it('requires literal table names in every non-test from call', () => {
    const dynamicResult = findDynamicFromCalls(files);
    expect(dynamicResult.violations).toEqual([]);
    expect(dynamicResult.hits.length).toBeGreaterThan(0);

    const fakeFiles: SourceFile[] = [
      { path: 'src/lib/sessions/literal.ts', source: "admin.from('votes'); admin.from(\"sessions\"); admin.from(`participants`);" },
      { path: 'src/lib/sessions/dynamic.ts', source: 'const tableName = "votes"; admin.from(tableName); admin.from(`${tableName}`);' },
      { path: 'src/lib/sessions/excluded.ts', source: 'Array.from([1]); Buffer.from("x"); Uint8Array.from([1]); Object.from([1]);' },
      { path: 'src/lib/sessions/example.test.ts', source: 'admin.from(tableName);' },
    ];
    const fakeResult = findDynamicFromCalls(fakeFiles);
    expect(fakeResult.violations.map((hit) => hit.filePath)).toEqual([
      'src/lib/sessions/dynamic.ts',
      'src/lib/sessions/dynamic.ts',
    ]);
    expect(fakeResult.exclusions.map((hit) => hit.receiver).sort()).toEqual([
      'Array',
      'Buffer',
      'Object',
      'Uint8Array',
    ]);
  });

  it('limits node crypto imports to the exact server source files', () => {
    expect(nodeCryptoImporters(files)).toEqual(NODE_CRYPTO_ALLOWED_FILES);
    const runner = files.find((file) => file.path === 'src/lib/sessions/run-session-event.ts');
    expect(runner).toBeDefined();
    expect(runner && importsResolvedModule(runner, 'src/lib/supabase/admin')).toBe(false);
    expect(runner && importsResolvedModule(runner, 'node:crypto')).toBe(false);
  });

  it('detects node crypto and admin imports from the runner in fake sources', () => {
    const fakeRunner: SourceFile = {
      path: 'src/lib/sessions/run-session-event.ts',
      source: "import 'node:crypto'; import '@/lib/supabase/admin';",
    };
    expect([
      importsResolvedModule(fakeRunner, 'node:crypto'),
      importsResolvedModule(fakeRunner, 'src/lib/supabase/admin'),
    ]).toEqual([true, true]);
  });

  it('detects node crypto imports from an unlisted source file', () => {
    const fakeFiles: SourceFile[] = [
      { path: 'src/lib/sessions/unlisted.ts', source: "import { randomInt } from 'node:crypto';" },
      { path: 'src/lib/sessions/session-event-deps.test.ts', source: "import 'node:crypto';" },
    ];
    expect(nodeCryptoImporters(fakeFiles)).toEqual(['src/lib/sessions/unlisted.ts']);
    expect(nodeCryptoImporters(fakeFiles)).not.toContain('src/lib/sessions/session-event-deps.ts');
  });

  it('blocks player, join, and component imports from host and question helper directories', () => {
    expect(findImportsFromDirectories(
      files,
      PLAYER_IMPORT_DIRECTORIES,
      ['src/app/host', 'src/lib/questions'],
    )).toEqual([]);
  });

  it('blocks imports of exact question authoring files from player, join, and component code', () => {
    expect(findImportsOfFiles(
      files,
      PLAYER_IMPORT_DIRECTORIES,
      QUESTION_AUTHORING_FILES,
    )).toEqual([]);
  });

  it('detects both restricted import rules in fake sources', () => {
    const fakeFiles: SourceFile[] = [
      {
        path: 'src/app/play/fake.tsx',
        source: "import '@/app/host/sessions/actions';",
      },
      {
        path: 'src/app/join/fake.tsx',
        source: "import '../../lib/questions/validate';",
      },
      {
        path: 'src/components/fake.tsx',
        source: "import '../app/host/questions/question-form';",
      },
    ];

    expect(findImportsFromDirectories(
      fakeFiles,
      PLAYER_IMPORT_DIRECTORIES,
      ['src/app/host', 'src/lib/questions'],
    )).toHaveLength(3);
    expect(findImportsOfFiles(
      fakeFiles,
      PLAYER_IMPORT_DIRECTORIES,
      QUESTION_AUTHORING_FILES,
    )).toEqual([
      { filePath: 'src/app/join/fake.tsx', importedPath: 'src/lib/questions/validate' },
      { filePath: 'src/components/fake.tsx', importedPath: 'src/app/host/questions/question-form' },
    ]);
  });

  it('keeps pure view helpers free of React, Next, and Supabase imports', () => {
    for (const path of ['src/lib/sessions/reveal-view.ts', 'src/lib/sessions/ladder-view.ts']) {
      const file = files.find((entry) => entry.path === path);
      expect(file, path).toBeDefined();
      if (!file) continue;

      for (const specifier of extractImports(file.source)) {
        const importedPath = resolveSpecifier(specifier, file.path);
        expect(importedPath, path).not.toMatch(/^react(?:\/|$)/);
        expect(importedPath, path).not.toMatch(/^next(?:\/|$)/);
        expect(importedPath, path).not.toMatch(/^src\/lib\/supabase(?:\/|$)/);
      }
    }
  });

  it('keeps the money ladder free of admin and server only imports', () => {
    const file = files.find((entry) => entry.path === 'src/components/money-ladder.tsx');
    expect(file).toBeDefined();
    if (!file) throw new Error('Expected the money ladder in the source scan.');

    for (const specifier of extractImports(file.source)) {
      const importedPath = resolveSpecifier(specifier, file.path);
      expect(specifier).not.toBe('server-only');
      expect(importedPath).not.toBe('src/lib/supabase/admin');
      expect(importedPath).not.toBe('src/lib/sessions/session-event-deps');
      expect(importedPath).not.toBe('src/lib/sessions/run-session-event');
    }
  });

  it('keeps the live refresh component client safe', () => {
    const component = files.find((file) =>
      file.path === 'src/components/live-session-refresh.tsx',
    );
    expect(component).toBeDefined();
    if (!component) throw new Error('Expected the live refresh component in the source scan.');

    expect(isClientFile(component.source)).toBe(true);
    const imports = extractImports(component.source).map((specifier) =>
      resolveSpecifier(specifier, component.path),
    );
    for (const importedPath of imports) {
      expect(importedPath).not.toBe('src/lib/supabase/admin');
      expect(importedPath).not.toBe('src/lib/sessions/session-event-deps');
      expect(importedPath).not.toBe('src/lib/sessions/run-session-event');
      expect(importedPath).not.toBe('src/lib/sessions/create-session');
      expect(importedPath).not.toBe('src/lib/sessions/join-session');
      expect(importedPath).not.toMatch(/^src\/lib\/auth(?:\/|$)/);
    }

    const source = component.source.toLowerCase();
    expect(source).not.toContain('session_private');
    expect(source).not.toContain('question_answers');
    expect(source).not.toContain(DATABASE_ANSWER_COLUMN);
  });

  it('keeps private tables and answer fields out of host session pages', () => {
    const hostSessionFiles = files.filter((file) =>
      file.path.startsWith('src/app/host/sessions/'),
    );
    expect(hostSessionFiles.length).toBeGreaterThan(0);
    for (const file of hostSessionFiles) {
      const source = file.source.toLowerCase();
      expect(source, file.path).not.toContain('session_private');
      expect(source, file.path).not.toContain('question_answers');
      expect(source, file.path).not.toContain(DATABASE_ANSWER_COLUMN);
    }
  });

  it('detects sensitive fields in fake host page and control sources', () => {
    expect(containsHostSensitiveField("const field = 'question_answers';")).toBe(true);
    expect(containsHostSensitiveField(`const field = '${DATABASE_ANSWER_COLUMN}';`)).toBe(true);
    expect(containsHostSensitiveField("const field = 'session_private';")).toBe(true);
  });

  it('keeps the scanned host page and controls free of sensitive fields', () => {
    const hostFiles = files.filter((file) =>
      file.path === HOST_PAGE || file.path === HOST_CONTROLS,
    );
    expect(hostFiles.map((file) => file.path).sort()).toEqual([HOST_PAGE, HOST_CONTROLS]);

    for (const file of hostFiles) {
      expect(containsHostSensitiveField(file.source), file.path).toBe(false);
    }
  });

  it('requires the host page countdown import to resolve to a client component', () => {
    const page: SourceFile = {
      path: HOST_PAGE,
      source: "import { CountdownTimer } from '../../../../components/countdown-timer';",
    };
    const clientTimer: SourceFile = {
      path: 'src/components/countdown-timer.tsx',
      source: "'use client';\nexport function CountdownTimer() {}",
    };
    const serverTimer: SourceFile = {
      ...clientTimer,
      source: 'export function CountdownTimer() {}',
    };

    expect(importsClientCountdown(page, clientTimer)).toBe(true);
    expect(importsClientCountdown(page, serverTimer)).toBe(false);
    expect(importsClientCountdown({ ...page, source: 'export const page = true;' }, clientTimer)).toBe(false);
  });

  it('uses the scanned client countdown component from the host page', () => {
    const page = files.find((file) => file.path === HOST_PAGE);
    const timer = files.find((file) => file.path === `${COUNTDOWN_TIMER}.tsx`);
    expect(page).toBeDefined();
    expect(timer).toBeDefined();
    if (!page || !timer) throw new Error('Expected the host page and countdown component in the source scan.');

    expect(importsClientCountdown(page, timer)).toBe(true);
  });

  it('detects duplicate reveal and next actions in fake sources', () => {
    const fakeFiles: SourceFile[] = [
      { path: HOST_ACTIONS, source: 'export async function revealAction() {}' },
      { path: 'src/app/play/actions.ts', source: 'export async function revealAction() {}' },
      { path: HOST_ACTIONS, source: 'export async function nextAction() {}' },
      { path: 'src/app/play/actions.ts', source: 'export async function nextAction() {}' },
    ];

    expect(actionDefinitionPaths(fakeFiles, 'revealAction')).toEqual([
      HOST_ACTIONS,
      'src/app/play/actions.ts',
    ]);
    expect(actionDefinitionPaths(fakeFiles, 'nextAction')).toEqual([
      HOST_ACTIONS,
      'src/app/play/actions.ts',
    ]);
  });

  it('keeps reveal and next action definitions only in the scanned host actions file', () => {
    expect(actionDefinitionPaths(files, 'revealAction')).toEqual([HOST_ACTIONS]);
    expect(actionDefinitionPaths(files, 'nextAction')).toEqual([HOST_ACTIONS]);
  });

  it('keeps the session event dependency query away from answer data and select all', () => {
    const depsFile = files.find((file) =>
      file.path === 'src/lib/sessions/session-event-deps.ts',
    );
    expect(depsFile).toBeDefined();
    const source = depsFile?.source.toLowerCase() ?? '';
    expect(source).not.toContain('question_answers');
    expect(source).not.toContain(DATABASE_ANSWER_COLUMN);
    expect(source).not.toMatch(/\.select\s*\(\s*(?:['"]\*['"]|`\*`)?\s*\)/);
  });

  it('keeps player routes away from private session and answer tables', () => {
    const playerFiles = files.filter((file) =>
      file.path.startsWith('src/app/play/') || file.path.startsWith('src/app/join/'),
    );

    for (const file of playerFiles) {
      const source = file.source.toLowerCase();
      expect(source, file.path).not.toContain('session_private');
      expect(source, file.path).not.toContain('question_answers');
    }
  });

  it('allows answer fields in exactly the current host bank files and answer loader', () => {
    expect(answerDataFiles).toEqual([
      'src/app/host/questions/[id]/edit/page.tsx',
      'src/app/host/questions/actions.ts',
      'src/app/host/questions/page.tsx',
      'src/lib/sessions/answer-deps.ts',
    ]);

    expect(answerDataFiles).not.toContain('src/lib/sessions/run-session-event.ts');
    expect(answerDataFiles).not.toContain('src/lib/sessions/session-event-deps.ts');
    for (const file of files) {
      if (file.path.startsWith('src/app/play/') || file.path.startsWith('src/app/join/')) {
        expect(answerDataFiles, file.path).not.toContain(file.path);
      }
    }
  });

  it('keeps answer dependencies out of player routes and client files', () => {
    for (const file of files) {
      const importsAnswerDeps = extractImports(file.source).some((specifier) =>
        resolveSpecifier(specifier, file.path) === 'src/lib/sessions/answer-deps',
      );
      if (file.path.startsWith('src/app/play/') || file.path.startsWith('src/app/join/')) {
        expect(importsAnswerDeps, file.path).toBe(false);
      }
      if (isClientFile(file.source)) expect(importsAnswerDeps, file.path).toBe(false);
    }
  });

  it('keeps answer field names out of the cast vote module', () => {
    expect(castVoteFile).toBeDefined();
    expect(answerDataFiles).not.toContain('src/lib/sessions/cast-vote.ts');
  });

  it('limits cast vote runtime imports to app actions and excludes client files', () => {
    const castVoteImports = files.filter((file) =>
      extractImports(file.source).some((specifier) =>
        resolveSpecifier(specifier, file.path) === 'src/lib/sessions/cast-vote',
      ),
    );

    for (const file of castVoteImports) {
      const importedSpecifiers = extractImports(file.source).filter((specifier) =>
        resolveSpecifier(specifier, file.path) === 'src/lib/sessions/cast-vote',
      );
      if (isClientFile(file.source)) expect(importedSpecifiers).toEqual([]);
      for (const specifier of importedSpecifiers) {
        if (
          !file.path.endsWith('.test.ts')
          && !isTypeOnlyImport(file.source, specifier)
        ) {
          expect(isActionFile(file.path), file.path).toBe(true);
        }
      }
    }
  });

  it('keeps player logic free of private fields and forbidden runtime dependencies', () => {
    expect(playerFiles.map((file) => file.path).sort()).toEqual([
      ...playerPurePaths,
      'src/lib/sessions/verified-user.ts',
    ].sort());
    expect(checkBoundaries(playerFiles)).toEqual([]);
  });

  it('allows client files to import player actions, but no other new player modules', () => {
    const playerModules = [
      ...playerPurePaths,
      'src/lib/sessions/verified-user',
    ];
    const clientFiles = files.filter((file) => isClientFile(file.source));
    for (const file of clientFiles) {
      const importedModules = extractImports(file.source)
        .map((specifier) => resolveSpecifier(specifier, file.path));
      for (const modulePath of playerModules) {
        expect(importedModules, file.path).not.toContain(modulePath);
      }
    }
  });

  it('keeps countdown and answering panels client safe and free of sensitive fields', () => {
    const paths = [
      'src/components/countdown-timer.tsx',
      'src/app/play/[sessionId]/contestant-panel.tsx',
      'src/app/play/[sessionId]/audience-panel.tsx',
    ];

    for (const path of paths) {
      const file = files.find((entry) => entry.path === path);
      expect(file, path).toBeDefined();
      if (!file) continue;

      expect(isClientFile(file.source), path).toBe(true);
      const source = file.source.toLowerCase();
      expect(source, path).not.toContain('question_answers');
      expect(source, path).not.toContain(DATABASE_ANSWER_COLUMN);
      expect(source, path).not.toContain('session_private');

      for (const specifier of extractImports(file.source)) {
        const importedPath = resolveSpecifier(specifier, file.path);
        expect(importedPath, path).not.toBe('src/lib/supabase/admin');
        expect(importedPath, path).not.toBe('src/lib/sessions/session-event-deps');
        expect(importedPath, path).not.toBe('src/lib/sessions/run-session-event');
        expect(importedPath, path).not.toBe('src/lib/sessions/answer-deps');
        expect(importedPath, path).not.toBe('src/lib/sessions/cast-vote');
        expect(importedPath, path).not.toMatch(/^src\/lib\/auth(?:\/|$)/);
      }
    }
  });

  it('keeps lifeline results out of player facing source', () => {
    expect(findForbiddenPlayerLifelineFields(files)).toEqual([]);
  });

  it('keeps useLifelineAction only in play actions', () => {
    const fakeFiles: SourceFile[] = [
      { path: PLAY_ACTIONS, source: 'export async function useLifelineAction() {}' },
      { path: 'src/app/host/actions.ts', source: 'export async function useLifelineAction() {}' },
    ];
    expect(actionDefinitionPaths(fakeFiles, 'useLifelineAction')).toEqual([
      'src/app/host/actions.ts',
      PLAY_ACTIONS,
    ]);
    expect(actionDefinitionPaths(files, 'useLifelineAction')).toEqual([PLAY_ACTIONS]);
  });

  it('keeps the contestant panel free of forbidden modules', () => {
    const fakeFiles: SourceFile[] = [{
      path: CONTESTANT_PANEL,
      source: [
        "'use client';",
        "import { lifelineFlow } from '../../../lib/sessions/player-flows';",
        "import { runSessionEvent } from '../../../lib/sessions/run-session-event';",
      ].join('\n'),
    }];
    expect(findImportsOfFiles(
      fakeFiles,
      ['src/app/play'],
      CONTESTANT_FORBIDDEN_IMPORTS,
    )).toEqual([
      { filePath: CONTESTANT_PANEL, importedPath: 'src/lib/sessions/player-flows' },
      { filePath: CONTESTANT_PANEL, importedPath: 'src/lib/sessions/run-session-event' },
    ]);

    const panel = files.find((file) => file.path === CONTESTANT_PANEL);
    expect(panel).toBeDefined();
    expect(findImportsOfFiles(
      panel ? [panel] : [],
      ['src/app/play'],
      CONTESTANT_FORBIDDEN_IMPORTS,
    )).toEqual([]);
  });

  it('keeps countdown helpers pure and outside React and Supabase', () => {
    for (const path of [
      'src/lib/sessions/countdown.ts',
      'src/lib/sessions/knock-loop.ts',
    ]) {
      const file = files.find((entry) => entry.path === path);
      expect(file, path).toBeDefined();
      if (!file) continue;
      for (const specifier of extractImports(file.source)) {
        const importedPath = resolveSpecifier(specifier, file.path);
        expect(importedPath, path).not.toMatch(/^react(?:\/|$)/);
        expect(importedPath, path).not.toMatch(/^next(?:\/|$)/);
        expect(importedPath, path).not.toMatch(/^src\/lib\/supabase(?:\/|$)/);
      }
    }
  });
});
