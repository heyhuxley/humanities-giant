import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('game engine purity', () => {
  it('keeps non-test game source free of clocks, randomness, UI, and alias imports', () => {
    const directory = __dirname;
    const files = readdirSync(directory).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(directory, file), 'utf8');
      expect(source, file).not.toMatch(/Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(|performance\.now\s*\(/);
      expect(source, file).not.toMatch(/from\s*['"](?:react|next(?:\/[^'"]*)?|@supabase(?:\/[^'"]*)?)['"]|import\s*\(['"](?:react|next(?:\/[^'"]*)?|@supabase(?:\/[^'"]*)?)['"]\)/);
      expect(source, file).not.toMatch(/from\s*['"]@\/|import\s*\(['"]@\//);
    }
  });
});
