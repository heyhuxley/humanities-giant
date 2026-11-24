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

function isActionFile(path: string): boolean {
  return isUnder(path, 'src/app') && path.split('/').at(-1) === 'actions.ts';
}

function isTypeOnlyImport(source: string, specifier: string): boolean {
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
  ]);
  const sessionModules = [
    MODULES.runSessionEvent,
    MODULES.createSession,
    MODULES.joinSession,
  ];

  for (const file of files) {
    const filePath = normalizedPath(file.path);
    if (isTestFile(filePath)) continue;
    const appFile = isUnder(filePath, 'src/app');
    const actionFile = isActionFile(filePath);
    const clientFile = isClientFile(file.source);

    for (const specifier of extractImports(file.source)) {
      const resolved = resolveSpecifier(specifier, filePath);
      const importsAdmin = matchesModule(specifier, resolved, MODULES.admin);
      const importsDeps = matchesModule(specifier, resolved, MODULES.sessionEventDeps);
      const importsAnswerDeps = matchesModule(specifier, resolved, MODULES.answerDeps);
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

      if (
        importsSessionModule &&
        !isUnder(filePath, 'src/lib/sessions') &&
        !actionFile
      ) {
        violations.push({ file: file.path, rule: 'session-module-importer', specifier });
      }

      if (clientFile && (
        importsAdmin || importsDeps || importsAnswerDeps || importsSessionModule || importsRequireHost
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
