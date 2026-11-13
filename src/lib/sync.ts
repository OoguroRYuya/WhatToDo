/**
 * Manual Backup and Restore between SQLite and Firestore (requirement 3.5, FR-06).
 *
 * Cloud layout:  users/{uid}/todos/{id}   users/{uid}/notes/{id}
 * Conflict rule: last write wins on `updated_at` (ISO UTC strings compare as text).
 * Deletes travel as tombstones (`is_deleted: true`) so a Restore on another phone removes them.
 * Secret notes leave the phone as ciphertext only: the cloud never sees a PIN or plaintext.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from './firebase';
import { setMeta, type Note, type Todo } from './db';
import { nowIso } from './time';
import { isEncryptedPayload } from './crypto';
import { LIMITS } from './validation';

const BATCH_LIMIT = 450; // Firestore allows 500 writes per batch.
const TIMEOUT_MS = 20_000;

export class SyncTimeoutError extends Error {
  constructor() {
    super('The cloud did not answer in time. Check the connection and try again.');
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SyncTimeoutError()), TIMEOUT_MS);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

type CloudTodo = { title: string; is_completed: boolean; due_date: string | null; is_deleted: boolean; created_at: string; updated_at: string };
type CloudNote = { title: string; content: string; is_encrypted: boolean; is_deleted: boolean; created_at: string; updated_at: string };

const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Cloud data is checked before it reaches SQLite: a bad document is skipped, not trusted. */
function parseTodo(data: Record<string, unknown>): CloudTodo | null {
  if (!isIso(data.updated_at)) return null;
  return {
    title: str(data.title, LIMITS.title),
    is_completed: data.is_completed === true,
    due_date: typeof data.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.due_date) ? data.due_date : null,
    is_deleted: data.is_deleted === true,
    created_at: isIso(data.created_at) ? data.created_at : data.updated_at,
    updated_at: data.updated_at,
  };
}

function parseNote(data: Record<string, unknown>): CloudNote | null {
  if (!isIso(data.updated_at)) return null;
  const is_encrypted = data.is_encrypted === true;
  const content = typeof data.content === 'string' ? data.content : '';
  // An "encrypted" note whose content is not our payload would be unreadable; skip it.
  if (is_encrypted && content && !isEncryptedPayload(content)) return null;
  return {
    title: str(data.title, LIMITS.title),
    content: is_encrypted ? content : content.slice(0, LIMITS.content),
    is_encrypted,
    is_deleted: data.is_deleted === true,
    created_at: isIso(data.created_at) ? data.created_at : data.updated_at,
    updated_at: data.updated_at,
  };
}

async function cloudUpdatedAt(uid: string, name: 'todos' | 'notes') {
  const snap = await withTimeout(getDocs(collection(firestore(), 'users', uid, name)));
  const map = new Map<string, Record<string, unknown>>();
  snap.forEach((d) => map.set(d.id, d.data()));
  return map;
}

export type BackupResult = { uploaded: number; skippedNewerInCloud: number };

export async function backup(db: SQLiteDatabase, uid: string): Promise<BackupResult> {
  const fs = firestore();
  const todos = await db.getAllAsync<Todo>('SELECT * FROM todos WHERE user_id = ? AND is_synced = 0', uid);
  const notes = await db.getAllAsync<Note>('SELECT * FROM notes WHERE user_id = ? AND is_synced = 0', uid);
  if (todos.length === 0 && notes.length === 0) {
    await setMeta(db, `last_backup.${uid}`, nowIso());
    return { uploaded: 0, skippedNewerInCloud: 0 };
  }

  // Read the cloud's timestamps first, so a newer edit from another phone is never overwritten.
  const [cloudTodos, cloudNotes] = await Promise.all([cloudUpdatedAt(uid, 'todos'), cloudUpdatedAt(uid, 'notes')]);
  const newerInCloud = (cloud: Map<string, Record<string, unknown>>, id: string, local: string) => {
    const remote = cloud.get(id)?.updated_at;
    return typeof remote === 'string' && remote > local;
  };

  type Write = { ref: ReturnType<typeof doc>; data: object; table: 'todos' | 'notes'; id: string; updated_at: string };
  const writes: Write[] = [];
  let skipped = 0;

  for (const t of todos) {
    if (newerInCloud(cloudTodos, t.id, t.updated_at)) { skipped++; continue; }
    writes.push({
      ref: doc(fs, 'users', uid, 'todos', t.id),
      table: 'todos', id: t.id, updated_at: t.updated_at,
      data: {
        title: t.title, is_completed: t.is_completed === 1, due_date: t.due_date,
        is_deleted: t.is_deleted === 1, created_at: t.created_at, updated_at: t.updated_at,
      },
    });
  }
  for (const n of notes) {
    if (newerInCloud(cloudNotes, n.id, n.updated_at)) { skipped++; continue; }
    writes.push({
      ref: doc(fs, 'users', uid, 'notes', n.id),
      table: 'notes', id: n.id, updated_at: n.updated_at,
      data: {
        title: n.title, content: n.is_deleted ? '' : n.content, is_encrypted: n.is_encrypted === 1,
        is_deleted: n.is_deleted === 1, created_at: n.created_at, updated_at: n.updated_at,
      },
    });
  }

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(fs);
    chunk.forEach((w) => batch.set(w.ref, w.data));
    await withTimeout(batch.commit());
    // Mark synced only if the row was not edited while the upload was in flight.
    await db.withTransactionAsync(async () => {
      for (const w of chunk) {
        await db.runAsync(
          `UPDATE ${w.table} SET is_synced = 1 WHERE id = ? AND user_id = ? AND updated_at = ?`,
          w.id, uid, w.updated_at,
        );
      }
    });
  }

  // Tombstones that reached the cloud are no longer needed on this phone.
  await db.runAsync('DELETE FROM todos WHERE user_id = ? AND is_deleted = 1 AND is_synced = 1', uid);
  await db.runAsync('DELETE FROM notes WHERE user_id = ? AND is_deleted = 1 AND is_synced = 1', uid);
  await setMeta(db, `last_backup.${uid}`, nowIso());
  return { uploaded: writes.length, skippedNewerInCloud: skipped };
}

export type RestoreResult = { added: number; updated: number; removed: number; keptLocal: number };

export async function restore(db: SQLiteDatabase, uid: string): Promise<RestoreResult> {
  const [cloudTodos, cloudNotes] = await Promise.all([cloudUpdatedAt(uid, 'todos'), cloudUpdatedAt(uid, 'notes')]);
  const result: RestoreResult = { added: 0, updated: 0, removed: 0, keptLocal: 0 };

  await db.withTransactionAsync(async () => {
    for (const [id, raw] of cloudTodos) {
      const c = parseTodo(raw);
      if (!c) continue;
      const local = await db.getFirstAsync<{ updated_at: string; user_id: string }>(
        'SELECT updated_at, user_id FROM todos WHERE id = ?', id,
      );
      if (local && local.user_id !== uid) continue; // never overwrite another account's row
      if (!local) {
        if (c.is_deleted) continue;
        await db.runAsync(
          `INSERT INTO todos (id, user_id, title, is_completed, due_date, is_synced, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
          id, uid, c.title, c.is_completed ? 1 : 0, c.due_date, c.created_at, c.updated_at,
        );
        result.added++;
      } else if (c.updated_at > local.updated_at) {
        if (c.is_deleted) {
          await db.runAsync('DELETE FROM todos WHERE id = ? AND user_id = ?', id, uid);
          result.removed++;
        } else {
          await db.runAsync(
            `UPDATE todos SET title = ?, is_completed = ?, due_date = ?, is_synced = 1, is_deleted = 0, updated_at = ?
             WHERE id = ? AND user_id = ?`,
            c.title, c.is_completed ? 1 : 0, c.due_date, c.updated_at, id, uid,
          );
          result.updated++;
        }
      } else if (c.updated_at < local.updated_at) {
        result.keptLocal++;
      }
    }

    for (const [id, raw] of cloudNotes) {
      const c = parseNote(raw);
      if (!c) continue;
      const local = await db.getFirstAsync<{ updated_at: string; user_id: string }>(
        'SELECT updated_at, user_id FROM notes WHERE id = ?', id,
      );
      if (local && local.user_id !== uid) continue;
      if (!local) {
        if (c.is_deleted) continue;
        await db.runAsync(
          `INSERT INTO notes (id, user_id, title, content, is_encrypted, is_synced, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
          id, uid, c.title, c.content, c.is_encrypted ? 1 : 0, c.created_at, c.updated_at,
        );
        result.added++;
      } else if (c.updated_at > local.updated_at) {
        if (c.is_deleted) {
          await db.runAsync('DELETE FROM notes WHERE id = ? AND user_id = ?', id, uid);
          result.removed++;
        } else {
          await db.runAsync(
            `UPDATE notes SET title = ?, content = ?, is_encrypted = ?, is_synced = 1, is_deleted = 0, updated_at = ?
             WHERE id = ? AND user_id = ?`,
            c.title, c.content, c.is_encrypted ? 1 : 0, c.updated_at, id, uid,
          );
          result.updated++;
        }
      } else if (c.updated_at < local.updated_at) {
        result.keptLocal++;
      }
    }
  });

  await setMeta(db, `last_restore.${uid}`, nowIso());
  return result;
}
