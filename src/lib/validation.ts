/**
 * Input validation and sanitisation (requirement 3.6, "Validasi Input").
 * SQL injection is handled separately: every query binds parameters, never string concatenation.
 */

export const LIMITS = {
  title: 120,
  content: 20_000,
  passwordMin: 8,
  passwordMax: 128,
  pinMin: 4,
  pinMax: 8,
} as const;

// Control characters except tab (\u0009) and newline (\u000A); also zero-width and bidi overrides,
// which can hide or reorder text in a title.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;

/** One-line fields: strip control characters, collapse whitespace, trim. */
export function sanitizeLine(value: string): string {
  return value.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
}

/** Multi-line fields: strip control characters, normalise line endings, trim the ends. */
export function sanitizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(CONTROL, '').trim();
}

export type Check = { ok: true } | { ok: false; message: string };
const ok: Check = { ok: true };
const fail = (message: string): Check => ({ ok: false, message });

// Deliberately pragmatic: one @, a dot in the domain, no spaces. Firebase does the final check.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkEmail(raw: string): Check {
  const email = raw.trim();
  if (!email) return fail('Enter your email address.');
  if (email.length > 254 || !EMAIL.test(email)) return fail('That email address is not valid.');
  return ok;
}

export function checkPassword(pw: string, isRegister: boolean): Check {
  if (!pw) return fail('Enter your password.');
  if (!isRegister) return ok;
  if (pw.length < LIMITS.passwordMin) return fail(`Use at least ${LIMITS.passwordMin} characters.`);
  if (pw.length > LIMITS.passwordMax) return fail(`Use at most ${LIMITS.passwordMax} characters.`);
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return fail('Use at least one letter and one number.');
  return ok;
}

export function checkTitle(raw: string): Check {
  const title = sanitizeLine(raw);
  if (!title) return fail('A title is required.');
  if (title.length > LIMITS.title) return fail(`Keep the title under ${LIMITS.title} characters.`);
  return ok;
}

export function checkContent(raw: string): Check {
  if (sanitizeText(raw).length > LIMITS.content) {
    return fail(`Keep the note under ${LIMITS.content.toLocaleString()} characters.`);
  }
  return ok;
}

/** Empty is allowed (no due date). Otherwise a real calendar date as YYYY-MM-DD. */
export function checkDueDate(raw: string): Check {
  const v = raw.trim();
  if (!v) return ok;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return fail('Use the format YYYY-MM-DD.');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return fail('That date does not exist.');
  }
  return ok;
}

export function checkPin(pin: string): Check {
  if (!/^\d+$/.test(pin)) return fail('The PIN is digits only.');
  if (pin.length < LIMITS.pinMin || pin.length > LIMITS.pinMax) {
    return fail(`Use ${LIMITS.pinMin} to ${LIMITS.pinMax} digits.`);
  }
  return ok;
}
