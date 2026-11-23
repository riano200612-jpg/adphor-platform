const encoder = new TextEncoder();
const format = 1;

function encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function additionalData(stateDigest) {
  if (typeof stateDigest !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(stateDigest)) {
    throw new Error('Invalid OAuth transaction context.');
  }
  return encoder.encode('adphor-qa:calendar-oauth:transaction:v1:' + stateDigest);
}

// Supply a dedicated 32-byte key from the server's secret configuration.
export async function createCalendarOAuthTransactionCipher(keyBytes) {
  if (!(keyBytes instanceof Uint8Array) || keyBytes.byteLength !== 32) {
    throw new Error('OAuth transaction encryption requires a 256-bit key.');
  }
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return {
    async seal(payload, stateDigest) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: additionalData(stateDigest)},
        key, encoder.encode(JSON.stringify(payload)),
      );
      return {version: format, iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext))};
    },
    async open(envelope, stateDigest) {
      if (envelope?.version !== format || typeof envelope.iv !== 'string' ||
          typeof envelope.ciphertext !== 'string') throw new Error('Invalid OAuth transaction envelope.');
      const iv = decode(envelope.iv);
      const ciphertext = decode(envelope.ciphertext);
      if (iv.byteLength !== 12 || ciphertext.byteLength < 16) {
        throw new Error('Invalid OAuth transaction envelope.');
      }
      const body = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv, additionalData: additionalData(stateDigest)}, key, ciphertext,
      );
      return JSON.parse(new TextDecoder().decode(body));
    },
  };
}
