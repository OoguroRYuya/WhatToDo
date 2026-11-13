import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { nowIso } from './time';

export const DB_NAME = 'daybook.db';

/**
 * Schema follows requirement 3.3, plus two additions:
 * - `is_deleted` (soft delete / tombstone): a plain DELETE could never reach the cloud, and a
 *   later Restore would bring the row back. Rows are hidden locally and purged after a backup.
 * - `created_at`, for a stable list order that edits do not reshuffle.
 * `api_cache` holds external API responses (requirement 3.6, local caching);
 * `meta` holds per-user values such as the last successful backup time.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
    due_date TEXT,
    is_synced INTEGER NOT NULL DEFAULT 0 CHECK (is_synced IN (0, 1)),
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_todos_user ON todos (user_id, is_deleted, is_completed, due_date);

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    is_encrypted INTEGER NOT NULL DEFAULT 0 CHECK (is_encrypted IN (0, 1)),
    is_synced INTEGER NOT NULL DEFAULT 0 CHECK (is_synced IN (0, 1)),
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notes_user ON notes (user_id, is_deleted, updated_at);

  CREATE TABLE IF NOT EXISTS api_cache (
    key TEXT PRIMARY KEY NOT NULL,
    body TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

/** SQLiteProvider onInit: WAL mode and versioned migrations via PRAGMA user_version. */
export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

// ---------- Types ----------

export type Todo = {
  id: string;
  user_id: string;
  title: string;
  is_completed: 0 | 1;
  due_date: string | null;
  is_synced: 0 | 1;
  is_deleted: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_encrypted: 0 | 1;
  is_synced: 0 | 1;
  is_deleted: 0 | 1;
  created_at: string;
  updated_at: string;
};

/** List rows for notes never carry the content: the list does not need it, and a locked
 * note's ciphertext should not sit in React state. */
export type NoteListItem = Omit<Note, 'content'> & { preview: string };

// ---------- Todos ----------

export function listTodos(db: SQLiteDatabase, userId: string) {
  // Open first, then by due date (no date last), then newest.
  return db.getAllAsync<Todo>(
    `SELECT * FROM todos WHERE user_id = ? AND is_deleted = 0
     ORDER BY is_completed ASC, due_date IS NULL ASC, due_date ASC, created_at DESC`,
    userId,
  );
}

export function getTodo(db: SQLiteDatabase, userId: string, id: string) {
  return db.getFirstAsync<Todo>(
    'SELECT * FROM todos WHERE id = ? AND user_id = ? AND is_deleted = 0',
    id,
    userId,
  );
}

export async function createTodo(
  db: SQLiteDatabase,
  userId: string,
  input: { title: string; due_date: string | null },
) {
  const now = nowIso();
  const id = randomUUID();
  await db.runAsync(
    `INSERT INTO todos (id, user_id, title, is_completed, due_date, is_synced, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, 0, 0, ?, ?)`,
    id, userId, input.title, input.due_date, now, now,
  );
  return id;
}

export function updateTodo(
  db: SQLiteDatabase,
  userId: string,
  id: string,
  input: { title: string; due_date: string | null },
) {
  return db.runAsync(
    `UPDATE todos SET title = ?, due_date = ?, is_synced = 0, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    input.title, input.due_date, nowIso(), id, userId,
  );
}

export function setTodoCompleted(db: SQLiteDatabase, userId: string, id: string, done: boolean) {
  return db.runAsync(
    'UPDATE todos SET is_completed = ?, is_synced = 0, updated_at = ? WHERE id = ? AND user_id = ?',
    done ? 1 : 0, nowIso(), id, userId,
  );
}

export function deleteTodo(db: SQLiteDatabase, userId: string, id: string) {
  return db.runAsync(
    'UPDATE todos SET is_deleted = 1, is_synced = 0, updated_at = ? WHERE id = ? AND user_id = ?',
    nowIso(), id, userId,
  );
}

// ---------- Notes ----------

export function listNotes(db: SQLiteDatabase, userId: string) {
  // The preview is cut in SQL so long notes never cross the bridge in full.
  return db.getAllAsync<NoteListItem>(
    `SELECT id, user_id, title, is_encrypted, is_synced, is_deleted, created_at, updated_at,
            CASE WHEN is_encrypted = 1 THEN '' ELSE substr(content, 1, 140) END AS preview
     FROM notes WHERE user_id = ? AND is_deleted = 0
     ORDER BY updated_at DESC`,
    userId,
  );
}

export function getNote(db: SQLiteDatabase, userId: string, id: string) {
  return db.getFirstAsync<Note>(
    'SELECT * FROM notes WHERE id = ? AND user_id = ? AND is_deleted = 0',
    id,
    userId,
  );
}

export async function createNote(
  db: SQLiteDatabase,
  userId: string,
  input: { title: string; content: string; is_encrypted: boolean },
) {
  const now = nowIso();
  const id = randomUUID();
  await db.runAsync(
    `INSERT INTO notes (id, user_id, title, content, is_encrypted, is_synced, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    id, userId, input.title, input.content, input.is_encrypted ? 1 : 0, now, now,
  );
  return id;
}

export function updateNote(
  db: SQLiteDatabase,
  userId: string,
  id: string,
  input: { title: string; content: string; is_encrypted: boolean },
) {
  return db.runAsync(
    `UPDATE notes SET title = ?, content = ?, is_encrypted = ?, is_synced = 0, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    input.title, input.content, input.is_encrypted ? 1 : 0, nowIso(), id, userId,
  );
}

export function deleteNote(db: SQLiteDatabase, userId: string, id: string) {
  // The content is blanked at once: a deleted secret note should not linger as ciphertext.
  return db.runAsync(
    `UPDATE notes SET is_deleted = 1, content = '', is_synced = 0, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    nowIso(), id, userId,
  );
}

// ---------- Summary ----------

export type Summary = { open: number; dueToday: number; done: number; notes: number; unsynced: number };

export async function getSummary(db: SQLiteDatabase, userId: string, today: string): Promise<Summary> {
  const row = await db.getFirstAsync<Summary>(
    `SELECT
       (SELECT COUNT(*) FROM todos WHERE user_id = $u AND is_deleted = 0 AND is_completed = 0) AS open,
       (SELECT COUNT(*) FROM todos WHERE user_id = $u AND is_deleted = 0 AND is_completed = 0
          AND due_date IS NOT NULL AND due_date <= $today) AS dueToday,
       (SELECT COUNT(*) FROM todos WHERE user_id = $u AND is_deleted = 0 AND is_completed = 1) AS done,
       (SELECT COUNT(*) FROM notes WHERE user_id = $u AND is_deleted = 0) AS notes,
       (SELECT COUNT(*) FROM todos WHERE user_id = $u AND is_synced = 0)
         + (SELECT COUNT(*) FROM notes WHERE user_id = $u AND is_synced = 0) AS unsynced`,
    { $u: userId, $today: today },
  );
  return row ?? { open: 0, dueToday: 0, done: 0, notes: 0, unsynced: 0 };
}

// ---------- Meta ----------

export async function getMeta(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export function setMeta(db: SQLiteDatabase, key: string, value: string) {
  return db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}
