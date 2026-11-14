// Reads and validates the settings from .env (see .env.example).
// A wrong setting stops the app immediately with a readable message
// instead of failing later in the middle of a request.
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z
    .string()
    .max(64)
    .regex(/^[A-Za-z0-9_]+$/, 'may only contain letters, digits and underscores')
    .default('lantern_stays_v2'),
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters').default('lantern-stays-local-development-secret'),
  SQL_INSPECTOR: z.enum(['true', 'false']).default('true'),
});

// An empty value such as "PORT=" means "use the default".
const provided = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));
const parsed = schema.safeParse(provided);

if (!parsed.success) {
  console.error('\nInvalid settings in .env:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  console.error('Compare your .env with .env.example.\n');
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  },
  sessionSecret: env.SESSION_SECRET,
  sqlInspector: env.SQL_INSPECTOR === 'true',
};

export type Config = typeof config;
