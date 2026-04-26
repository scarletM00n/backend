import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from 'dotenv';
dotenv.config({ override: true });

function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(
      'DATABASE_URL is missing. Create scentra-backend/.env and set a valid PostgreSQL connection string.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is invalid. Expected format: postgresql://user:password@host:5432/dbname');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql:// protocol.');
  }

  if (!parsed.password || parsed.password.trim().length === 0) {
    throw new Error(
      'DATABASE_URL has no password. This causes PostgreSQL SCRAM auth errors (client password must be a string).'
    );
  }

  return raw;
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});