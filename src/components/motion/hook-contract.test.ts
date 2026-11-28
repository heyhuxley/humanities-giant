import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dataAttributeSelectorMatchesSources,
  extractDataAttributeSelectors,
} from '../../test-utils/import-boundaries';

type SourceFile = { path: string; source: string };

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

function closingBrace(source: string, openBrace: number): number {
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return source.length;
}

describe('motion hook contracts', () => {
  it('extracts and matches data attribute selectors against real JSX sources', () => {
    const runSource = readFileSync(join(process.cwd(), 'src/components/motion/run-motion.ts'), 'utf8');
    const selectors = extractDataAttributeSelectors(runSource);
    const componentSources = [
      ...sourceFiles(join(process.cwd(), 'src/app')),
      ...sourceFiles(join(process.cwd(), 'src/components')),
    ].filter((file) => !/\.test\.tsx?$/.test(file.path));

    expect(selectors.length).toBeGreaterThanOrEqual(10);
    for (const selector of selectors) {
      expect(
        dataAttributeSelectorMatchesSources(selector, componentSources),
        selector,
      ).toBe(true);
    }

    expect(extractDataAttributeSelectors(
      `const missing = '[data-missing="fake"]';`,
    )).toEqual(['[data-missing="fake"]']);
  });

  it('declares motion-written attributes in CSS or the runner', () => {
    const runner = readFileSync(join(process.cwd(), 'src/components/motion/run-motion.ts'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    for (const attribute of ['data-motion-running', 'data-counting', 'data-active']) {
      expect(runner.includes(attribute) || css.includes(attribute)).toBe(true);
    }
  });

  it('keeps every GSAP tween call inside the no-preference matchMedia callback', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/motion/run-motion.ts'), 'utf8');
    expect(source).toContain('gsap.matchMedia');
    expect(source).toContain('prefers-reduced-motion: no-preference');

    const callback = source.match(/media\.add\(\s*['"`]\(prefers-reduced-motion:\s*no-preference\)['"`]\s*,\s*\(\)\s*=>\s*\{/);
    expect(callback).not.toBeNull();
    if (callback === null) return;
    const openBrace = (callback.index ?? 0) + callback[0].lastIndexOf('{');
    const closeBrace = closingBrace(source, openBrace);
    const callbackSource = source.slice(openBrace, closeBrace + 1);
    expect(callbackSource).toBeDefined();

    for (const call of ['gsap.timeline(', 'gsap.from(', 'gsap.to(', 'gsap.fromTo(']) {
      let from = 0;
      while (true) {
        const matchIndex = source.indexOf(call, from);
        if (matchIndex < 0) break;
        expect(matchIndex).toBeGreaterThan(openBrace);
        expect(matchIndex).toBeLessThan(closeBrace);
        from = matchIndex + call.length;
      }
      // This text based check is structural but cannot model dynamic string construction
      // or calls built through variables, so it is a focused guard rather than a parser.
    }
  });

  it('keeps reduced motion CSS declarations within the no-preference block', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const mediaRanges = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{/g)]
      .map((match) => {
        const openBrace = (match.index ?? 0) + match[0].lastIndexOf('{');
        return { start: match.index ?? 0, end: closingBrace(css, openBrace) };
    });

    for (const match of css.matchAll(/@keyframes\s+[-\w]+/g)) {
      const index = match.index ?? 0;
      expect(mediaRanges.some((range) => index > range.start && index < range.end)).toBe(true);
    }

    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    for (const match of css.matchAll(rulePattern)) {
      const declarations = match[2] ?? '';
      const index = match.index ?? 0;
      if (/(?:transition(?:-[\w]+)?|animation(?:-[\w]+)?):[^;]*(?:opacity|transform)/.test(declarations)) {
        const isRunningException = (match[1] ?? '').includes('[data-motion-running');
        expect(isRunningException || mediaRanges.some((range) => index > range.start && index < range.end)).toBe(true);
      }
    }
    expect(/scroll-behavior\s*:\s*smooth/.test(css)).toBe(false);
  });
});
