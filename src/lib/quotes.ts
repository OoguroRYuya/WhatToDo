/**
 * External API (requirement 3.4, option 1; FR-02): a daily quote.
 * Primary: ZenQuotes "today" (one quote per day, rate-limited per IP).
 * Fallback: DummyJSON random quote.
 *
 * Caching (requirement 3.6): the response is kept in SQLite `api_cache` and reused for the rest of
 * the local day, so moving between screens or reopening the app never calls the API again.
 * If both APIs fail, the last cached quote is shown and marked stale; with no cache, an error state.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { localDate, nowIso } from './time';

export type Quote = { text: string; author: string; source: 'ZenQuotes' | 'DummyJSON' };
export type QuoteResult = { quote: Quote; stale: boolean };

const CACHE_KEY = 'quote.daily';
const TIMEOUT_MS = 5_000; // per API; worst case ~10s before the cached or error state

export class QuoteTimeoutError extends Error {}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new QuoteTimeoutError('The quote service timed out.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

async function fromZenQuotes(): Promise<Quote> {
  const data = (await getJson('https://zenquotes.io/api/today')) as { q?: string; a?: string }[];
  const item = Array.isArray(data) ? data[0] : undefined;
  const text = clean(item?.q, 400);
  const author = clean(item?.a, 80);
  // When rate-limited, ZenQuotes answers 200 with its own notice, attributed to itself.
  if (!text || !author || author.toLowerCase() === 'zenquotes.io') throw new Error('ZenQuotes gave no quote');
  return { text, author, source: 'ZenQuotes' };
}

async function fromDummyJson(): Promise<Quote> {
  const data = (await getJson('https://dummyjson.com/quotes/random')) as { quote?: string; author?: string };
  const text = clean(data?.quote, 400);
  const author = clean(data?.author, 80);
  if (!text || !author) throw new Error('DummyJSON gave no quote');
  return { text, author, source: 'DummyJSON' };
}

type Cached = { quote: Quote; day: string };

async function readCache(db: SQLiteDatabase): Promise<Cached | null> {
  const row = await db.getFirstAsync<{ body: string }>('SELECT body FROM api_cache WHERE key = ?', CACHE_KEY);
  if (!row) return null;
  try {
    return JSON.parse(row.body) as Cached;
  } catch {
    return null;
  }
}

/** In-memory copy: tab switches do not even touch SQLite. */
let memory: Cached | null = null;

export async function getDailyQuote(db: SQLiteDatabase, { force = false } = {}): Promise<QuoteResult> {
  const today = localDate();
  if (!force && memory?.day === today) return { quote: memory.quote, stale: false };

  const cached = await readCache(db);
  if (!force && cached?.day === today) {
    memory = cached;
    return { quote: cached.quote, stale: false };
  }

  try {
    let quote: Quote;
    try {
      quote = await fromZenQuotes();
    } catch {
      quote = await fromDummyJson();
    }
    const entry: Cached = { quote, day: today };
    await db.runAsync(
      `INSERT INTO api_cache (key, body, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
      CACHE_KEY, JSON.stringify(entry), nowIso(),
    );
    memory = entry;
    return { quote, stale: false };
  } catch (e) {
    if (cached) return { quote: cached.quote, stale: true };
    throw e;
  }
}
