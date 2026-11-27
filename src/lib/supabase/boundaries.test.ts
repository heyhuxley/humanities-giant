import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('Supabase key boundaries', () => {
  const files = sourceFiles(join(process.cwd(), 'src'));
const serviceKeyName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
  it('keeps the admin client and service key out of client modules', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (/^\s*(['"])use client\1/m.test(source)) {
        expect(source, file).not.toMatch(/from\s+['"][^'"]*lib\/supabase\/admin['"]/);
        expect(source, file).not.toContain(serviceKeyName);
      }
    }
  });
  it('mentions the service role key only in admin.ts', () => {
    for (const file of files) {
      if (readFileSync(file, 'utf8').includes(serviceKeyName)) expect(file.replaceAll('\\', '/')).toMatch(/src\/lib\/supabase\/admin\.ts$/);
    }
  });
  it('does not expose a service role environment variable publicly', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/);
    }
  });
  it('keeps the question bank routes away from the admin client', () => {
    const questionFiles = sourceFiles(join(process.cwd(), 'src', 'app', 'host', 'questions'));
    for (const file of questionFiles) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from\s+['"][^'"]*lib\/supabase\/admin['"]/);
    }
  });
});
