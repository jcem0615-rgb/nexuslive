import path from 'node:path';
import { config as loadEnvFile } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Replaces the `prisma` block in package.json, which Prisma 6 deprecates and
 * Prisma 7 removes.
 *
 * The moment this file exists Prisma stops loading `.env` itself ("Prisma
 * config detected, skipping environment variable loading"), so we do it here —
 * otherwise `env("DATABASE_URL")` in the schema resolves to nothing and every
 * CLI command fails with P1012. Same precedence Next.js uses: `.env.local`
 * first, then `.env`, and neither overrides a variable the environment already
 * sets (which is how Render and CI supply it).
 */
for (const file of ['.env.local', '.env']) {
  loadEnvFile({ path: path.join(process.cwd(), file), quiet: true });
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    // What `prisma db seed` runs — and what `migrate dev`/`migrate reset` call
    // after applying the schema.
    seed: 'tsx prisma/seed.ts',
  },
});
