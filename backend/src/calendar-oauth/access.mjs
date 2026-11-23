const algorithm = {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'};
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid JWT segment.');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

function object(segment) {
  const value = JSON.parse(decoder.decode(decode(segment)));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JWT object.');
  return value;
}

export function createCalendarAccessVerifier({issuer, audience, transport = fetch, clock = Date.now}) {
  if (typeof issuer !== 'string' || !/^https:\/\/[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(issuer) ||
      typeof audience !== 'string' || !/^[a-f0-9]{64}$/.test(audience)) {
    throw new Error('Calendar OAuth requires the configured Access team and application audience.');
  }

  return async function verifyAccess(request) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
    if (!token || token.length > 8192) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerSegment, claimsSegment, signatureSegment] = parts;

    let header, claims, signature;
    try {
      header = object(headerSegment);
      claims = object(claimsSegment);
      signature = decode(signatureSegment);
    } catch {
      return null;
    }
    const now = Math.floor(clock() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(header.kid) ||
        header.crit !== undefined || claims.iss !== issuer || !Array.isArray(claims.aud) ||
        !claims.aud.includes(audience) || claims.type !== 'app' ||
        !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
        (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now)) ||
        typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 256) return null;

    const response = await transport(issuer + '/cdn-cgi/access/certs', {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Access signing keys unavailable.');
    const {keys} = await response.json();
    if (!Array.isArray(keys)) throw new Error('Access signing keys invalid.');
    const matches = keys.filter(key => key?.kid === header.kid);
    if (matches.length !== 1) return null;
    const [jwk] = matches;
    if (jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig') return null;
    const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['verify']);
    if (key.algorithm.modulusLength < 2048) return null;
    const authenticated = await crypto.subtle.verify(
      algorithm, key, signature, encoder.encode(headerSegment + '.' + claimsSegment),
    );
    if (!authenticated || claims.exp <= Math.floor(clock() / 1000)) return null;
    return {subject: claims.sub};
  };
}
