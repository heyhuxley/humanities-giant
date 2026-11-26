import { posix } from 'node:path';

const STATIC_IMPORT_PATTERN =
  /\bimport\s+(?:type\s+)?(?:(?:(?!\bimport\s)[\s\S])*?\s+from\s+)?(['"])([^'"]+)\1/g;
const EXPORT_FROM_PATTERN =
  /\bexport\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*|\*\s+as\s+[A-Za-z_$][\w$]*)\s+from\s+(['"])([^'"]+)\1/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
const REQUIRE_PATTERN = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g;

const MODULES = {
  admin: 'src/lib/supabase/admin',
  sessionEventDeps: 'src/lib/sessions/session-event-deps',
  answerDeps: 'src/lib/sessions/answer-deps',
  castVote: 'src/lib/sessions/cast-vote',
  playerForms: 'src/lib/sessions/player-forms',
  playerFlows: 'src/lib/sessions/player-flows',
  playerMessages: 'src/lib/sessions/player-messages',
  verifiedUser: 'src/lib/sessions/verified-user',
  playActions: 'src/app/play/[sessionId]/actions',
  knockActions: 'src/app/knock/actions',
  runSessionEvent: 'src/lib/sessions/run-session-event',
  createSession: 'src/lib/sessions/create-session',
  joinSession: 'src/lib/sessions/join-session',
  requireHost: 'src/lib/auth/require-host',
} as const;

function isTestFile(filePath: string): boolean {
  return /\.(?:test\.ts|test\.tsx)$/i.test(filePath.replaceAll('\\', '/'));
}

function normalizedPath(filePath: string): string {
  return posix.normalize(filePath.replaceAll('\\', '/')).replace(/^\.\//, '');
}

function matchesModule(specifier: string, resolved: string, target: string): boolean {
  const normalizedSpecifier = normalizedPath(specifier);
  return resolved === target ||
    resolved.startsWith(`${target}/`) ||
    normalizedSpecifier.replace(/\.(?:tsx?|jsx?)$/i, '') === target ||
    normalizedSpecifier.endsWith(`/${target.slice(target.lastIndexOf('/') + 1)}`);
}

function isUnder(path: string, directory: string): boolean {
  return path === directory || path.startsWith(`${directory}/`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type ImportReference = {
  filePath: string;
  importedPath: string;
};

export function findIdentifierFiles(
  files: { path: string; source: string }[],
  identifier: string,
): string[] {
  const identifierPattern = new RegExp(`\\b${escapeRegExp(identifier)}\\b`);
  return files
    .filter((file) => !isTestFile(file.path) && /\.(?:ts|tsx)$/i.test(file.path))
    .filter((file) => identifierPattern.test(file.source))
    .map((file) => normalizedPath(file.path))
    .sort();
}

export function findUnexpectedIdentifierFiles(
  files: { path: string; source: string }[],
  identifier: string,
  allowedPaths: string[],
): string[] {
  const allowed = new Set(allowedPaths.map(normalizedPath));
  return findIdentifierFiles(files, identifier).filter((filePath) => !allowed.has(filePath));
}

export function findImportsFromDirectories(
  files: { path: string; source: string }[],
  importerDirectories: string[],
  blockedDirectories: string[],
): ImportReference[] {
  return files
    .filter((file) => importerDirectories.some((directory) =>
      isUnder(normalizedPath(file.path), directory),
    ))
    .flatMap((file) => extractImports(file.source)
      .map((specifier) => resolveSpecifier(specifier, file.path))
      .filter((importedPath) => blockedDirectories.some((directory) =>
        isUnder(importedPath, directory),
      ))
      .map((importedPath) => ({
        filePath: normalizedPath(file.path),
        importedPath,
      })));
}

export function findImportsOfFiles(
  files: { path: string; source: string }[],
  importerDirectories: string[],
  blockedFiles: string[],
): ImportReference[] {
  const blocked = new Set(blockedFiles.map((filePath) =>
    normalizedPath(filePath).replace(/\.(?:tsx?|jsx?)$/i, ''),
  ));
  return files
    .filter((file) => importerDirectories.some((directory) =>
      isUnder(normalizedPath(file.path), directory),
    ))
    .flatMap((file) => extractImports(file.source)
      .map((specifier) => resolveSpecifier(specifier, file.path))
      .filter((importedPath) => blocked.has(importedPath))
      .map((importedPath) => ({
        filePath: normalizedPath(file.path),
        importedPath,
      })));
}

export function isActionFile(path: string): boolean {
  return isUnder(path, 'src/app') && path.split('/').at(-1) === 'actions.ts';
}

export function isTypeOnlyImport(source: string, specifier: string): boolean {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `\\bimport\\s+type\\s+(?:(?:(?!\\bimport\\s)[\\s\\S])*?\\s+from\\s+)?(['"])${escaped}\\1`,
  ).test(source);
}

export function extractImports(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    STATIC_IMPORT_PATTERN,
    EXPORT_FROM_PATTERN,
    DYNAMIC_IMPORT_PATTERN,
    REQUIRE_PATTERN,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const specifier = match[2];
      if (specifier !== undefined) specifiers.push(specifier);
    }
  }

  return specifiers;
}

export function resolveSpecifier(specifier: string, importerPath: string): string {
  const normalizedSpecifier = specifier.replaceAll('\\', '/');
  let resolved: string;
  if (normalizedSpecifier.startsWith('@/')) {
    resolved = `src/${normalizedSpecifier.slice(2)}`;
  } else if (normalizedSpecifier.startsWith('.')) {
    resolved = posix.normalize(posix.join(posix.dirname(normalizedPath(importerPath)), normalizedSpecifier));
  } else {
    resolved = posix.normalize(normalizedSpecifier);
  }

  return resolved
    .replace(/\.(?:d\.)?(?:tsx?|jsx?|mjs|cjs)$/i, '')
    .replace(/\/index$/i, '');
}

export function isClientFile(source: string): boolean {
  let remaining = source.replace(/^\uFEFF/, '').trimStart();
  while (remaining.startsWith('//') || remaining.startsWith('/*')) {
    if (remaining.startsWith('//')) {
      const newline = remaining.indexOf('\n');
      remaining = newline === -1 ? '' : remaining.slice(newline + 1).trimStart();
    } else {
      const commentEnd = remaining.indexOf('*/');
      if (commentEnd === -1) return false;
      remaining = remaining.slice(commentEnd + 2).trimStart();
    }
  }

  return /^(?:'use client'|"use client")(?:\s*;)?(?:\s|$)/.test(remaining);
}

export function findAnswerDataFiles(
  files: { path: string; source: string }[],
): string[] {
  const answerTable = 'question' + '_answers';
  const answerColumn = 'correct' + '_index';
  return files
    .filter((file) => !isTestFile(file.path) && /\.(?:ts|tsx)$/i.test(file.path))
    .filter((file) => file.source.includes(answerTable) || file.source.includes(answerColumn))
    .map((file) => normalizedPath(file.path))
    .sort();
}

export function findVotesTableReads(
  files: { path: string; source: string }[],
): string[] {
  const votesTablePattern = /\.from\s*\(\s*(['"`])votes\1\s*\)/g;
  return files
    .filter((file) => !isTestFile(file.path) && /\.(?:ts|tsx)$/i.test(file.path))
    .filter((file) => {
      votesTablePattern.lastIndex = 0;
      return votesTablePattern.test(file.source);
    })
    .map((file) => normalizedPath(file.path))
    .sort();
}

export function isExactVotesRead(source: string): boolean {
  const exactVotesChain = /\.from\s*\(\s*(['"`])votes\1\s*\)\s*\.select\s*\(\s*(['"`])option_index\2\s*\)\s*\.eq\s*\(\s*(['"`])session_id\3\s*,\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\)\s*\.eq\s*\(\s*(['"`])position\4\s*,\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\)\s*;/;
  return exactVotesChain.test(source);
}

export function findParticipantIdentifierMatches(source: string): string[] {
  const matches: string[] = [];
  if (/\bparticipant_id\b/.test(source)) matches.push('participant_id');
  if (/\bparticipantId\b/.test(source)) matches.push('participantId');
  return matches;
}

export type DynamicFromCall = {
  filePath: string;
  line: number;
  receiver: string;
  argument: string;
  excluded: boolean;
};

export type DynamicFromResult = {
  hits: DynamicFromCall[];
  violations: DynamicFromCall[];
  exclusions: DynamicFromCall[];
};

function readQuotedArgument(source: string, start: number): { quote: string; end: number } | null {
  const quote = source[start];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;

  for (let index = start + 1; index < source.length; index += 1) {
    if (quote === '`' && source[index] === '$' && source[index + 1] === '{') return null;
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === quote) return { quote, end: index + 1 };
  }
  return null;
}

export function findDynamicFromCalls(
  files: { path: string; source: string }[],
): DynamicFromResult {
  const excludedReceivers = new Set(['Array', 'Buffer', 'Uint8Array', 'Object']);
  const hits: DynamicFromCall[] = [];
  const violations: DynamicFromCall[] = [];
  const exclusions: DynamicFromCall[] = [];

  for (const file of files) {
    if (isTestFile(file.path) || !/\.(?:ts|tsx)$/i.test(file.path)) continue;
    const pattern = /\.from\s*\(/g;
    for (const match of file.source.matchAll(pattern)) {
      const matchIndex = match.index ?? 0;
      const prefix = file.source.slice(0, matchIndex);
      const receiverMatch = prefix.match(/([A-Za-z_$][\w$]*)\s*$/);
      const receiver = receiverMatch?.[1] ?? '<unknown>';
      const argumentStart = matchIndex + match[0].length;
      let firstArgumentIndex = argumentStart;
      while (/[\s]/.test(file.source[firstArgumentIndex] ?? '')) firstArgumentIndex += 1;
      const remaining = file.source.slice(firstArgumentIndex);
      const quoted = readQuotedArgument(file.source, firstArgumentIndex);
      const excluded = excludedReceivers.has(receiver);
      const line = file.source.slice(0, matchIndex).split('\n').length;
      const hit: DynamicFromCall = {
        filePath: normalizedPath(file.path),
        line,
        receiver,
        argument: remaining.slice(0, 80),
        excluded,
      };
      hits.push(hit);
      if (excluded) {
        exclusions.push(hit);
      } else if (quoted === null) {
        violations.push(hit);
      }
    }
  }

  return { hits, violations, exclusions };
}

export function checkBoundaries(
  files: { path: string; source: string }[],
): { file: string; rule: string; specifier: string }[] {
  const violations: { file: string; rule: string; specifier: string }[] = [];
  const allowedAdminImporters = new Set([
    'src/lib/supabase/admin',
    'src/lib/sessions/create-session',
    'src/lib/sessions/join-session',
    MODULES.sessionEventDeps,
    MODULES.answerDeps,
    MODULES.castVote,
  ]);
  const sessionModules = [
    MODULES.runSessionEvent,
    MODULES.createSession,
    MODULES.joinSession,
  ];
  const playerPureModules = [
    MODULES.playerForms,
    MODULES.playerFlows,
    MODULES.playerMessages,
  ];
  const newPlayerModules = [
    ...playerPureModules,
    MODULES.verifiedUser,
    MODULES.playActions,
    MODULES.knockActions,
  ];
  const restrictedPlayerText = [
    'question' + '_answers',
    'correct' + '_index',
    'session' + '_private',
  ];

  for (const file of files) {
    const filePath = normalizedPath(file.path);
    if (isTestFile(filePath)) continue;
    const appFile = isUnder(filePath, 'src/app');
    const actionFile = isActionFile(filePath);
    const clientFile = isClientFile(file.source);
    const fileWithoutExtension = filePath.replace(/\.(?:tsx?|jsx?)$/i, '');

    if (playerPureModules.includes(fileWithoutExtension as typeof playerPureModules[number])) {
      for (const restrictedText of restrictedPlayerText) {
        if (file.source.toLowerCase().includes(restrictedText)) {
          violations.push({
            file: file.path,
            rule: 'player-sensitive-source',
            specifier: restrictedText,
          });
        }
      }
    }

    if (fileWithoutExtension === MODULES.verifiedUser) {
      for (const specifier of extractImports(file.source)) {
        const resolved = resolveSpecifier(specifier, filePath);
        if (specifier !== 'server-only' && resolved !== 'src/lib/supabase/server') {
          violations.push({ file: file.path, rule: 'verified-user-importer', specifier });
        }
      }
    }

    for (const specifier of extractImports(file.source)) {
      const resolved = resolveSpecifier(specifier, filePath);
      const importsAdmin = matchesModule(specifier, resolved, MODULES.admin);
      const importsDeps = matchesModule(specifier, resolved, MODULES.sessionEventDeps);
      const importsAnswerDeps = matchesModule(specifier, resolved, MODULES.answerDeps);
      const importsCastVote = matchesModule(specifier, resolved, MODULES.castVote);
      const importedPlayerModule = newPlayerModules.find((target) =>
        matchesModule(specifier, resolved, target),
      );
      const importsSessionModule = sessionModules.some((target) =>
        matchesModule(specifier, resolved, target),
      );
      const importsRequireHost = matchesModule(specifier, resolved, MODULES.requireHost);

      if (importsAdmin && !allowedAdminImporters.has(filePath.replace(/\.(?:tsx?|jsx?)$/i, ''))) {
        violations.push({ file: file.path, rule: 'admin-importer', specifier });
      }

      if (importsDeps && !isTypeOnlyImport(file.source, specifier) && !actionFile) {
        violations.push({ file: file.path, rule: 'deps-importer', specifier });
      }

      if (
        importsAnswerDeps &&
        filePath.replace(/\.(?:tsx?|jsx?)$/i, '') !== MODULES.sessionEventDeps
      ) {
        violations.push({ file: file.path, rule: 'answer-deps-importer', specifier });
      }

      if (importsCastVote && !actionFile && !isTypeOnlyImport(file.source, specifier)) {
        violations.push({ file: file.path, rule: 'cast-vote-importer', specifier });
      }

      if (
        clientFile &&
        importedPlayerModule !== undefined &&
        importedPlayerModule !== MODULES.playActions &&
        importedPlayerModule !== MODULES.knockActions
      ) {
        violations.push({ file: file.path, rule: 'client-player-module-import', specifier });
      }

      if (
        playerPureModules.includes(fileWithoutExtension as typeof playerPureModules[number]) &&
        (
          importsAdmin ||
          importsCastVote ||
          importsDeps ||
          importsAnswerDeps
        ) &&
        !isTypeOnlyImport(file.source, specifier)
      ) {
        violations.push({ file: file.path, rule: 'player-pure-runtime-import', specifier });
      }

      if (
        importsSessionModule &&
        !isUnder(filePath, 'src/lib/sessions') &&
        !actionFile
      ) {
        violations.push({ file: file.path, rule: 'session-module-importer', specifier });
      }

      if (clientFile && (
        importsAdmin || importsDeps || importsAnswerDeps || importsCastVote ||
        importsSessionModule || importsRequireHost
      )) {
        violations.push({ file: file.path, rule: 'client-import', specifier });
      }

      if (appFile && !actionFile && (importsDeps || importsAnswerDeps || importsSessionModule)) {
        violations.push({ file: file.path, rule: 'app-module-importer', specifier });
      }
    }
  }

  return violations;
}
