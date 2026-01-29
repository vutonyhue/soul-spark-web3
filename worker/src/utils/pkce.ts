/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * RFC 7636 implementation for OAuth 2.0
 */

/**
 * Base64URL encode a Uint8Array
 * Per RFC 4648 Section 5
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decode to Uint8Array
 */
export function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) {
    padded += '=';
  }
  
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate SHA-256 hash of a string
 */
async function sha256(message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Verify PKCE code_verifier against stored code_challenge
 * 
 * @param codeVerifier - The code_verifier sent by the client
 * @param codeChallenge - The code_challenge stored during authorization
 * @param method - The code_challenge_method (only 'S256' is supported)
 * @returns true if verification passes
 */
export async function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: string = 'S256'
): Promise<boolean> {
  // Only support S256 (SHA-256)
  if (method !== 'S256') {
    console.warn('Unsupported PKCE method:', method);
    return false;
  }

  // Validate code_verifier format per RFC 7636
  // Must be 43-128 characters, [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) {
    console.warn('Invalid code_verifier format');
    return false;
  }

  try {
    // Compute S256: BASE64URL(SHA256(code_verifier))
    const hash = await sha256(codeVerifier);
    const computedChallenge = base64UrlEncode(hash);
    
    // Constant-time comparison to prevent timing attacks
    return secureCompare(computedChallenge, codeChallenge);
  } catch (error) {
    console.error('PKCE verification error:', error);
    return false;
  }
}

/**
 * Generate a code_challenge from code_verifier (for testing)
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = await sha256(codeVerifier);
  return base64UrlEncode(hash);
}

/**
 * Validate code_challenge format
 * Must be BASE64URL encoded, 43 characters for S256
 */
export function isValidCodeChallenge(codeChallenge: string): boolean {
  // S256 produces 256 bits = 32 bytes = 43 BASE64URL characters
  if (!/^[A-Za-z0-9\-_]{43}$/.test(codeChallenge)) {
    return false;
  }
  return true;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate a cryptographically random code_verifier (for testing)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}
