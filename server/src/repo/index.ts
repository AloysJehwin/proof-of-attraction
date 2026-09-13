import type { Repo } from './types.js';
import { MemoryRepo } from './memory.js';
import { db } from '../db/client.js';
import { PgRepo } from './pg.js';

let instance: Repo | null = null;

export function getRepo(): Repo {
  if (instance) return instance;
  instance = db ? new PgRepo(db) : new MemoryRepo();
  return instance;
}

export * from './types.js';
