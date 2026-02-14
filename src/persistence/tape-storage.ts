import { openDB, type IDBPDatabase } from 'idb';
import type { TapeProject } from '../types';

const DB_NAME = 'tape-vibes';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tapes')) {
          db.createObjectStore('tapes', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveTape(tape: TapeProject): Promise<number> {
  const db = await getDb();
  tape.updatedAt = new Date();
  const id = await db.put('tapes', tape);
  return id as number;
}

export async function loadTape(id: number): Promise<TapeProject | undefined> {
  const db = await getDb();
  return db.get('tapes', id);
}

export async function listTapes(): Promise<TapeProject[]> {
  const db = await getDb();
  return db.getAll('tapes');
}

export async function deleteTape(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('tapes', id);
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('settings', value, key);
}

export async function loadSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get('settings', key);
}
