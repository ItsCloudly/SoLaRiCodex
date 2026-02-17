import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';

const databasePath = process.env.SOLARI_DB_PATH ?? './data/solari.db';
const databaseDir = path.dirname(databasePath);

if (databaseDir && databaseDir !== '.') {
  fs.mkdirSync(databaseDir, { recursive: true });
}

const sqlite = new Database(databasePath);
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
