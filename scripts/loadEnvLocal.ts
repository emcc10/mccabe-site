import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Load KEY=VALUE lines from .env.local / .env without overwriting existing env. */
export function loadEnvLocal(repoRoot = process.cwd()): void {
  for (const name of ['.env.local', '.env']) {
    const path = join(repoRoot, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
