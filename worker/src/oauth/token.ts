/**
 * OAuth 2.0 Token Endpoint
 * /oauth/token - Exchange authorization code for tokens
 */

import {
  TokenRequest,
  TokenResponse,
  AuthorizationCode,
  OAuthClient,
  RefreshTokenRecord,
  UserProfile,
  OAuthEnv,
  TOKEN_EXPIRY,
} from './types';
import { verifyPKCE } from '../utils/pkce';
import {
  signAccessToken,
  signIDToken,
  generateRefreshToken,
  hashToken,
  verifyClientSecret,
  verifyTokenHash,
} from '../utils/crypto';

// ========== Database Helpers ==========

async function getAuthorizationCode(code: string, env: OAuthEnv): Promise<AuthorizationCode | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/oauth_authorization_codes?code=eq.${encodeURIComponent(code)}&used=eq.false&select=*`;

  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return null;

  const codes = await response.json() as AuthorizationCode[];
  return codes[0] || null;
}

async function markCodeAsUsed(code: string, env: OAuthEnv): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/oauth_authorization_codes?code=eq.${encodeURIComponent(code)}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ used: true }),
  });

  return response.ok;
}

async function getClient(clientId: string, env: OAuthEnv): Promise<OAuthClient | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/oauth_clients?client_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&select=*`;

  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return null;

  const clients = await response.json() as OAuthClient[];
  return clients[0] || null;
}

async function getUserProfile(userId: string, env: OAuthEnv): Promise<UserProfile | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;

  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return null;

  const profiles = await response.json() as UserProfile[];
  return profiles[0] || null;
}

async function getUserEmail(userId: string, env: OAuthEnv): Promise<string | null> {
  // Query auth.users table for email
  const url = `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`;

  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return null;

  const user = await response.json() as { email?: string };
  return user.email || null;
}

async function storeRefreshToken(
  tokenHash: string,
  userId: string,
  clientId: string,
  scope: string,
  env: OAuthEnv
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH_TOKEN * 1000).toISOString();

  const url = `${env.SUPABASE_URL}/rest/v1/oauth_refresh_tokens`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token_hash: tokenHash,
      user_id: userId,
      client_id: clientId,
      scope,
      expires_at: expiresAt,
      revoked: false,
    }),
  });

  return response.ok;
}

async function getRefreshTokenRecord(tokenHash: string, env: OAuthEnv): Promise<RefreshTokenRecord | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/oauth_refresh_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}&revoked=eq.false&select=*`;

  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return null;

  const records = await response.json() as RefreshTokenRecord[];
  return records[0] || null;
}

async function revokeRefreshToken(tokenHash: string, env: OAuthEnv): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/oauth_refresh_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      revoked: true,
      revoked_at: new Date().toISOString(),
    }),
  });

  return response.ok;
}

// ========== Token Generation ==========

async function generateTokens(
  userId: string,
  clientId: string,
  scope: string,
  nonce: string | null,
  env: OAuthEnv
): Promise<TokenResponse | null> {
  const issuer = env.FUNID_ISSUER || 'https://funprofile-api.funecosystem.org';
  const scopes = scope.split(' ');

  // Get user profile for claims
  const profile = await getUserProfile(userId, env);
  
  // Sign access token
  const accessToken = await signAccessToken(
    {
      sub: userId,
      aud: clientId,
      client_id: clientId,
      scope,
    },
    env
  );

  // Build ID token claims based on requested scopes
  const idTokenClaims: Record<string, unknown> = {
    sub: userId,
    aud: clientId,
  };

  if (nonce) {
    idTokenClaims.nonce = nonce;
  }

  // Profile scope
  if (scopes.includes('profile') && profile) {
    if (profile.display_name) idTokenClaims.name = profile.display_name;
    if (profile.avatar_url) idTokenClaims.picture = profile.avatar_url;
  }

  // Email scope
  if (scopes.includes('email')) {
    const email = await getUserEmail(userId, env);
    if (email) {
      idTokenClaims.email = email;
      idTokenClaims.email_verified = true; // Supabase verifies emails
    }
  }

  // Wallet scope (custom FUN-ID claim)
  if (scopes.includes('wallet') && profile) {
    if (profile.wallet_address) idTokenClaims.wallet_address = profile.wallet_address;
    if (profile.camly_balance !== null) idTokenClaims.camly_balance = profile.camly_balance;
  }

  // Sign ID token
  const idToken = await signIDToken(idTokenClaims as any, env);

  // Generate refresh token
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);

  // Store refresh token
  const stored = await storeRefreshToken(refreshTokenHash, userId, clientId, scope, env);
  if (!stored) {
    console.error('Failed to store refresh token');
    return null;
  }

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: TOKEN_EXPIRY.ACCESS_TOKEN,
    refresh_token: refreshToken,
    id_token: idToken,
    scope,
  };
}

// ========== Request Parsing ==========

function parseFormData(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of body.split('&')) {
    const [key, value] = pair.split('=').map(decodeURIComponent);
    if (key) result[key] = value || '';
  }
  return result;
}

// ========== Error Response ==========

function tokenError(error: string, description: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    }
  );
}

// ========== Main Handler ==========

/**
 * Handle POST /oauth/token
 */
export async function handleToken(
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  // Parse request body
  const contentType = request.headers.get('Content-Type') || '';
  let params: Record<string, string>;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.text();
    params = parseFormData(body);
  } else if (contentType.includes('application/json')) {
    params = await request.json() as Record<string, string>;
  } else {
    return tokenError('invalid_request', 'Content-Type must be application/x-www-form-urlencoded or application/json');
  }

  const grantType = params.grant_type;

  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(params, env);
  } else if (grantType === 'refresh_token') {
    return handleRefreshTokenGrant(params, env);
  } else {
    return tokenError('unsupported_grant_type', 'Only authorization_code and refresh_token grants are supported');
  }
}

// ========== Authorization Code Grant ==========

async function handleAuthorizationCodeGrant(
  params: Record<string, string>,
  env: OAuthEnv
): Promise<Response> {
  const { code, redirect_uri, client_id, client_secret, code_verifier } = params;

  // Validate required parameters
  if (!code) {
    return tokenError('invalid_request', 'Missing code parameter');
  }
  if (!redirect_uri) {
    return tokenError('invalid_request', 'Missing redirect_uri parameter');
  }
  if (!client_id) {
    return tokenError('invalid_request', 'Missing client_id parameter');
  }
  if (!code_verifier) {
    return tokenError('invalid_request', 'Missing code_verifier parameter (PKCE required)');
  }

  // Get authorization code
  const authCode = await getAuthorizationCode(code, env);
  if (!authCode) {
    return tokenError('invalid_grant', 'Invalid or expired authorization code');
  }

  // Check expiration
  if (new Date(authCode.expires_at) < new Date()) {
    await markCodeAsUsed(code, env);
    return tokenError('invalid_grant', 'Authorization code has expired');
  }

  // Validate client_id matches
  if (authCode.client_id !== client_id) {
    return tokenError('invalid_grant', 'client_id does not match authorization code');
  }

  // Validate redirect_uri matches
  if (authCode.redirect_uri !== redirect_uri) {
    return tokenError('invalid_grant', 'redirect_uri does not match authorization code');
  }

  // Verify PKCE
  if (!authCode.code_challenge) {
    return tokenError('invalid_grant', 'Authorization code missing code_challenge');
  }

  const pkceValid = await verifyPKCE(
    code_verifier,
    authCode.code_challenge,
    authCode.code_challenge_method || 'S256'
  );

  if (!pkceValid) {
    return tokenError('invalid_grant', 'PKCE verification failed');
  }

  // Get client
  const client = await getClient(client_id, env);
  if (!client) {
    return tokenError('invalid_client', 'Client not found');
  }

  // Verify client secret for confidential clients
  if (client.is_confidential) {
    if (!client_secret) {
      return tokenError('invalid_client', 'Missing client_secret for confidential client');
    }

    const secretValid = await verifyClientSecret(client_secret, client.client_secret_hash);
    if (!secretValid) {
      return tokenError('invalid_client', 'Invalid client_secret');
    }
  }

  // Mark code as used BEFORE generating tokens
  await markCodeAsUsed(code, env);

  // Generate tokens
  const tokens = await generateTokens(
    authCode.user_id,
    authCode.client_id,
    authCode.scope,
    authCode.nonce,
    env
  );

  if (!tokens) {
    return tokenError('server_error', 'Failed to generate tokens', 500);
  }

  return new Response(JSON.stringify(tokens), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    },
  });
}

// ========== Refresh Token Grant ==========

async function handleRefreshTokenGrant(
  params: Record<string, string>,
  env: OAuthEnv
): Promise<Response> {
  const { refresh_token, client_id, client_secret } = params;

  if (!refresh_token) {
    return tokenError('invalid_request', 'Missing refresh_token parameter');
  }
  if (!client_id) {
    return tokenError('invalid_request', 'Missing client_id parameter');
  }

  // Hash the provided token to look up record
  const tokenHash = await hashToken(refresh_token);
  const tokenRecord = await getRefreshTokenRecord(tokenHash, env);

  if (!tokenRecord) {
    return tokenError('invalid_grant', 'Invalid or expired refresh token');
  }

  // Check expiration
  if (new Date(tokenRecord.expires_at) < new Date()) {
    await revokeRefreshToken(tokenHash, env);
    return tokenError('invalid_grant', 'Refresh token has expired');
  }

  // Validate client_id matches
  if (tokenRecord.client_id !== client_id) {
    return tokenError('invalid_grant', 'client_id does not match refresh token');
  }

  // Get client
  const client = await getClient(client_id, env);
  if (!client) {
    return tokenError('invalid_client', 'Client not found');
  }

  // Verify client secret for confidential clients
  if (client.is_confidential) {
    if (!client_secret) {
      return tokenError('invalid_client', 'Missing client_secret for confidential client');
    }

    const secretValid = await verifyClientSecret(client_secret, client.client_secret_hash);
    if (!secretValid) {
      return tokenError('invalid_client', 'Invalid client_secret');
    }
  }

  // Revoke old refresh token (rotate tokens)
  await revokeRefreshToken(tokenHash, env);

  // Generate new tokens
  const tokens = await generateTokens(
    tokenRecord.user_id,
    tokenRecord.client_id,
    tokenRecord.scope,
    null, // No nonce for refresh
    env
  );

  if (!tokens) {
    return tokenError('server_error', 'Failed to generate tokens', 500);
  }

  return new Response(JSON.stringify(tokens), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    },
  });
}
