/**
 * OAuth 2.0 / OIDC UserInfo Endpoint
 * /oauth/userinfo - Returns claims about the authenticated user
 */

import { UserInfoResponse, UserProfile, OAuthEnv } from './types';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';

// ========== JWKS for verifying our own tokens ==========
let selfJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getSelfJWKS(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  if (!selfJwks) {
    const jwksUrl = new URL('/.well-known/jwks.json', issuer);
    selfJwks = createRemoteJWKSet(jwksUrl);
  }
  return selfJwks;
}

// ========== Access Token Verification ==========

interface AccessTokenPayload extends JWTPayload {
  sub: string;
  client_id: string;
  scope: string;
}

async function verifyAccessToken(
  token: string,
  env: OAuthEnv
): Promise<AccessTokenPayload | null> {
  const issuer = env.FUNID_ISSUER || 'https://funprofile-api.funecosystem.org';

  try {
    const { payload } = await jwtVerify(token, getSelfJWKS(issuer), {
      issuer,
    });

    if (!payload.sub || typeof payload.sub !== 'string') {
      console.error('Access token missing sub claim');
      return null;
    }

    return payload as AccessTokenPayload;
  } catch (error) {
    console.error('Access token verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ========== Database Helpers ==========

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

// ========== Error Response ==========

function errorResponse(error: string, description: string, status: number): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer error="${error}", error_description="${description}"`,
      },
    }
  );
}

// ========== Main Handler ==========

/**
 * Handle GET /oauth/userinfo
 * Returns claims about the authenticated user based on the access token's scope
 */
export async function handleUserInfo(
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  // Extract Bearer token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('invalid_token', 'Missing or invalid Authorization header', 401);
  }

  const accessToken = authHeader.slice(7);
  if (!accessToken) {
    return errorResponse('invalid_token', 'Missing access token', 401);
  }

  // Verify access token
  const payload = await verifyAccessToken(accessToken, env);
  if (!payload) {
    return errorResponse('invalid_token', 'Invalid or expired access token', 401);
  }

  const userId = payload.sub;
  const scopes = (payload.scope || '').split(' ');

  // Build response based on scopes
  const response: UserInfoResponse = {
    sub: userId,
  };

  // Get user profile
  const profile = await getUserProfile(userId, env);

  // Profile scope
  if (scopes.includes('profile') && profile) {
    if (profile.display_name) {
      response.name = profile.display_name;
    }
    if (profile.avatar_url) {
      response.picture = profile.avatar_url;
    }
  }

  // Email scope
  if (scopes.includes('email')) {
    const email = await getUserEmail(userId, env);
    if (email) {
      response.email = email;
    }
  }

  // Wallet scope (custom FUN-ID claim)
  if (scopes.includes('wallet') && profile) {
    if (profile.wallet_address) {
      response.wallet_address = profile.wallet_address;
    }
    if (profile.camly_balance !== null) {
      response.camly_balance = profile.camly_balance;
    }
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
