/**
 * Cryptographic Utilities for OAuth 2.0 / OIDC
 * JWT Signing with RS256 using jose library
 */

import { SignJWT, importPKCS8, importSPKI, exportJWK, JWTPayload } from 'jose';
import { 
  IDTokenClaims, 
  AccessTokenClaims, 
  TOKEN_EXPIRY,
  JWK,
  OAuthEnv 
} from '../oauth/types';
import { base64UrlEncode } from './pkce';

// ========== Cache for imported keys ==========
let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicKey: CryptoKey | null = null;

/**
 * Import RSA private key from PEM format
 */
async function getPrivateKey(pem: string): Promise<CryptoKey> {
  if (!cachedPrivateKey) {
    cachedPrivateKey = await importPKCS8(pem, 'RS256');
  }
  return cachedPrivateKey;
}

/**
 * Import RSA public key from PEM format
 */
async function getPublicKey(pem: string): Promise<CryptoKey> {
  if (!cachedPublicKey) {
    cachedPublicKey = await importSPKI(pem, 'RS256');
  }
  return cachedPublicKey;
}

/**
 * Sign an Access Token with RS256
 */
export async function signAccessToken(
  claims: Omit<AccessTokenClaims, 'iss' | 'iat' | 'exp'>,
  env: OAuthEnv
): Promise<string> {
  if (!env.FUNID_RSA_PRIVATE_KEY) {
    throw new Error('RSA private key not configured');
  }

  const privateKey = await getPrivateKey(env.FUNID_RSA_PRIVATE_KEY);
  const issuer = env.FUNID_ISSUER || 'https://funprofile-api.funecosystem.org';
  const kid = env.FUNID_RSA_KID || 'funid-key-2026';

  return new SignJWT(claims as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'RS256', typ: 'at+jwt', kid })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(`${TOKEN_EXPIRY.ACCESS_TOKEN}s`)
    .sign(privateKey);
}

/**
 * Sign an ID Token with RS256
 */
export async function signIDToken(
  claims: Omit<IDTokenClaims, 'iss' | 'iat' | 'exp'>,
  env: OAuthEnv
): Promise<string> {
  if (!env.FUNID_RSA_PRIVATE_KEY) {
    throw new Error('RSA private key not configured');
  }

  const privateKey = await getPrivateKey(env.FUNID_RSA_PRIVATE_KEY);
  const issuer = env.FUNID_ISSUER || 'https://funprofile-api.funecosystem.org';
  const kid = env.FUNID_RSA_KID || 'funid-key-2026';

  return new SignJWT(claims as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(`${TOKEN_EXPIRY.ID_TOKEN}s`)
    .sign(privateKey);
}

/**
 * Export RSA public key as JWK for JWKS endpoint
 */
export async function exportPublicKeyAsJWK(env: OAuthEnv): Promise<JWK | null> {
  if (!env.FUNID_RSA_PUBLIC_KEY) {
    console.error('RSA public key not configured');
    return null;
  }

  try {
    const publicKey = await getPublicKey(env.FUNID_RSA_PUBLIC_KEY);
    const jwk = await exportJWK(publicKey);
    const kid = env.FUNID_RSA_KID || 'funid-key-2026';

    return {
      kty: jwk.kty || 'RSA',
      kid: kid,
      use: 'sig',
      alg: 'RS256',
      n: jwk.n || '',
      e: jwk.e || '',
    };
  } catch (error) {
    console.error('Failed to export public key as JWK:', error);
    return null;
  }
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate an authorization code
 */
export function generateAuthorizationCode(): string {
  return generateSecureToken(32);
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(): string {
  return generateSecureToken(48);
}

/**
 * Hash a string using SHA-256 (for storing refresh tokens)
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

/**
 * Verify a token against its hash
 */
export async function verifyTokenHash(token: string, hash: string): Promise<boolean> {
  const computedHash = await hashToken(token);
  return computedHash === hash;
}

/**
 * Hash client secret for storage (bcrypt-like pattern but using SHA-256)
 * Note: In production, use a proper password hashing library
 */
export async function hashClientSecret(secret: string): Promise<string> {
  // Add a prefix to identify the hashing method
  const hash = await hashToken(secret);
  return `sha256:${hash}`;
}

/**
 * Verify client secret against stored hash
 */
export async function verifyClientSecret(secret: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('sha256:')) {
    console.warn('Unknown hash format');
    return false;
  }
  
  const hash = storedHash.slice(7); // Remove 'sha256:' prefix
  return verifyTokenHash(secret, hash);
}

/**
 * Clear cached keys (for key rotation)
 */
export function clearKeyCache(): void {
  cachedPrivateKey = null;
  cachedPublicKey = null;
}
