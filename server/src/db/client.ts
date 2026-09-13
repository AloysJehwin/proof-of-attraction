import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const url = process.env.DATABASE_URL;

if (url && process.env.NEON_FORCE_IPV4 !== '0') {
  try {
    const dns = await import('node:dns');
    dns.setDefaultResultOrder('ipv4first');
    const { Agent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new Agent({ connect: { family: 4 } as any }));
  } catch {}
}

export const usingPostgres = Boolean(url);

export const db = url ? drizzle({ client: neon(url), schema }) : null;

