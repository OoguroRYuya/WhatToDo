/**
 * The secret-note PIN, one per account on this phone.
 *
 * The PIN itself is never stored. expo-secure-store (Keychain / Keystore) keeps a verifier:
 * a random salt and SHA-256(salt + PIN), so the app can say "wrong PIN" quickly and refuse to
 * lock a note under a mistyped PIN. Each note's own HMAC (see crypto.ts) is the real check.
 *
 * On a new phone after Restore there is no verifier yet; the first PIN that opens a restored
 * note becomes the verifier (adoptPin).
 */
import * as SecureStore from 'expo-secure-store';
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';

// SecureStore keys allow only alphanumerics, ".", "-" and "_". Firebase UIDs are alphanumeric.
const keyFor = (uid: string) => `pin_verifier.${uid.replace(/[^A-Za-z0-9]/g, '_')}`;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

async function hash(salt: string, pin: string) {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasPin(uid: string) {
  return (await SecureStore.getItemAsync(keyFor(uid))) !== null;
}

export async function setPin(uid: string, pin: string) {
  const salt = toHex(getRandomBytes(16));
  await SecureStore.setItemAsync(keyFor(uid), `${salt}$${await hash(salt, pin)}`);
}

/** Used after a restored note opens with a PIN this phone has not seen yet. */
export const adoptPin = setPin;

export async function clearPin(uid: string) {
  await SecureStore.deleteItemAsync(keyFor(uid));
}

// ---- Attempt limiting: five wrong PINs lock entry for 30 seconds, doubling each time. ----
let failures = 0;
let lockedUntil = 0;

export function pinLockoutSeconds() {
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

export function recordPinFailure() {
  failures += 1;
  if (failures >= 5) {
    const step = Math.min(failures - 5, 5);
    lockedUntil = Date.now() + 30_000 * 2 ** step;
  }
}

export function recordPinSuccess() {
  failures = 0;
  lockedUntil = 0;
}

/** 'unset' when this phone has no verifier for the account yet. */
export async function verifyPin(uid: string, pin: string): Promise<boolean | 'unset'> {
  const stored = await SecureStore.getItemAsync(keyFor(uid));
  if (!stored) return 'unset';
  const [salt, expected] = stored.split('$');
  return (await hash(salt, pin)) === expected;
}
