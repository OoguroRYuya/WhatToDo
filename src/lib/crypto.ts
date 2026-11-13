/**
 * Secret notes (requirement 3.6, FR-05).
 *
 * Scheme, per note:
 *   salt (16 random bytes) + PIN --PBKDF2-HMAC-SHA256, ITERATIONS--> 64 bytes
 *     first 32 bytes:  AES-256-CBC key
 *     last 32 bytes:   HMAC-SHA256 key
 *   iv (16 random bytes), ciphertext = AES-CBC(plaintext), mac = HMAC(version|iter|salt|iv|ciphertext)
 *
 * Encrypt-then-MAC means a wrong PIN or a tampered payload is detected before any decryption,
 * so a wrong PIN never produces garbage text. Randomness comes from expo-crypto (the platform
 * CSPRNG), not from crypto-js, which has no secure random source on Hermes.
 *
 * Stored format (one string, safe for SQLite TEXT and Firestore):
 *   dbk1$<iterations>$<salt b64>$<iv b64>$<ciphertext b64>$<mac b64>
 */
import CryptoJS from 'crypto-js';
import { getRandomBytes } from 'expo-crypto';

const VERSION = 'dbk1';
/** crypto-js PBKDF2 is pure JS and Hermes has no JIT: ~350ms in Node becomes seconds on a phone.
 * The count is stored in each payload, so it can be raised later without breaking old notes. */
const ITERATIONS = 10_000;

type WordArray = CryptoJS.lib.WordArray;

function bytesToWords(bytes: Uint8Array): WordArray {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return CryptoJS.enc.Hex.parse(hex);
}

function deriveKeys(pin: string, salt: WordArray, iterations: number) {
  const material = CryptoJS.PBKDF2(pin, salt, {
    keySize: 512 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  const hex = material.toString(CryptoJS.enc.Hex);
  return {
    encKey: CryptoJS.enc.Hex.parse(hex.slice(0, 64)),
    macKey: CryptoJS.enc.Hex.parse(hex.slice(64, 128)),
  };
}

function macOf(macKey: WordArray, parts: string[]) {
  return CryptoJS.HmacSHA256(parts.join('$'), macKey).toString(CryptoJS.enc.Base64);
}

/** Compares two strings in time independent of where they first differ. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** PBKDF2 blocks the JS thread; yield one frame first so a spinner can paint. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 32));

export function isEncryptedPayload(value: string) {
  return value.startsWith(`${VERSION}$`);
}

export async function encryptNote(plaintext: string, pin: string): Promise<string> {
  await nextFrame();
  const salt = bytesToWords(getRandomBytes(16));
  const iv = bytesToWords(getRandomBytes(16));
  const { encKey, macKey } = deriveKeys(pin, salt, ITERATIONS);
  const ct = CryptoJS.AES.encrypt(plaintext, encKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext.toString(CryptoJS.enc.Base64);
  const parts = [
    VERSION,
    String(ITERATIONS),
    salt.toString(CryptoJS.enc.Base64),
    iv.toString(CryptoJS.enc.Base64),
    ct,
  ];
  return [...parts, macOf(macKey, parts)].join('$');
}

export class WrongPinError extends Error {
  constructor() {
    super('That PIN does not open this note.');
    this.name = 'WrongPinError';
  }
}

export async function decryptNote(payload: string, pin: string): Promise<string> {
  const parts = payload.split('$');
  if (parts.length !== 6 || parts[0] !== VERSION) throw new Error('This note is not in a format this app can read.');
  const [version, iterStr, saltB64, ivB64, ctB64, mac] = parts;
  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > 1_000_000) {
    throw new Error('This note is not in a format this app can read.');
  }
  await nextFrame();
  const salt = CryptoJS.enc.Base64.parse(saltB64);
  const { encKey, macKey } = deriveKeys(pin, salt, iterations);
  if (!safeEqual(macOf(macKey, [version, iterStr, saltB64, ivB64, ctB64]), mac)) {
    throw new WrongPinError();
  }
  const plain = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(ctB64) }),
    encKey,
    { iv: CryptoJS.enc.Base64.parse(ivB64), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  );
  return plain.toString(CryptoJS.enc.Utf8);
}
