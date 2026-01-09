/**
 * FUN Profile API Gateway - Cloudflare Worker
 * 
 * SECURITY ARCHITECTURE (Big Tech Style):
 * - JWT verification using JWKS (jose library) - NO network call per request
 * - userId extracted from JWT payload.sub (NEVER trust client)
 * - Service Role Key for Supabase queries (server-side only)
 * - Strict CORS with allowed origins whitelist
 * - Input validation with allowlist/blocklist pattern
 */

import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

// ========== TYPES ==========
interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGINS?: string;
}

interface ProfileData {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  camly_balance: number;
  created_at: string;
  updated_at: string;
}

// ========== CONSTANTS ==========
const ALLOWED_PROFILE_FIELDS = ['display_name', 'bio', 'avatar_url', 'website'];
const BLOCKED_PROFILE_FIELDS = ['id', 'camly_balance', 'wallet_address', 'created_at', 'updated_at'];

// ========== JWKS SINGLETON (Cached in Worker memory) ==========
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', supabaseUrl);
    jwks = createRemoteJWKSet(jwksUrl);
  }
  return jwks;
}

// ========== JWT VERIFICATION (JWKS - No network call per request) ==========
async function verifyJWT(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(env.SUPABASE_URL), {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      // Note: Supabase JWT doesn't have audience claim by default
      // audience: 'authenticated',
    });
    return payload;
  } catch (error) {
    // Security: Don't log the token itself
    console.error('JWT verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// ========== CORS HELPERS ==========
function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = (env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim());
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  
  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }
  
  // Origin not allowed - return empty headers (browser will block)
  console.warn(`CORS blocked origin: ${origin}`);
  return {
    'Access-Control-Allow-Origin': '',
    'Access-Control-Allow-Methods': '',
    'Access-Control-Allow-Headers': '',
  };
}

function jsonResponse(data: unknown, status: number, env: Env, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(request, env),
      'Content-Type': 'application/json',
    },
  });
}

function errorResponse(message: string, status: number, env: Env, request: Request): Response {
  return jsonResponse({ error: message, success: false }, status, env, request);
}

// ========== TOKEN EXTRACTION ==========
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}

// ========== AUTH MIDDLEWARE ==========
async function withAuth(
  request: Request,
  env: Env,
  handler: (userId: string, request: Request, env: Env) => Promise<Response>
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return errorResponse('Missing authorization token', 401, env, request);
  }

  const payload = await verifyJWT(token, env);
  if (!payload?.sub) {
    return errorResponse('Invalid or expired token', 401, env, request);
  }

  // CRITICAL: userId comes from JWT payload.sub, NEVER from client
  return handler(payload.sub, request, env);
}

// ========== INPUT VALIDATION ==========
function sanitizeProfileUpdate(body: unknown): Record<string, string | null> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const data = body as Record<string, unknown>;
  const sanitized: Record<string, string | null> = {};

  // Check for blocked fields first - reject entire request if found
  for (const blocked of BLOCKED_PROFILE_FIELDS) {
    if (blocked in data) {
      console.warn(`Blocked attempt to update protected field: ${blocked}`);
      return null;
    }
  }

  // Only allow whitelisted fields
  for (const field of ALLOWED_PROFILE_FIELDS) {
    if (field in data) {
      const value = data[field];
      if (value === null) {
        // Allow null values for clearing fields
        sanitized[field] = null;
      } else if (typeof value === 'string') {
        // Validate string length
        if (value.length > 1000) {
          console.warn(`Field ${field} exceeds max length`);
          return null;
        }
        sanitized[field] = value.trim();
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

// ========== SUPABASE API HELPERS ==========
async function getProfileFromSupabase(userId: string, env: Env): Promise<ProfileData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Supabase GET error:', response.status);
    return null;
  }

  const profiles = await response.json() as ProfileData[];
  return profiles[0] || null;
}

async function updateProfileInSupabase(
  userId: string, 
  data: Record<string, string | null>, 
  env: Env
): Promise<ProfileData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    console.error('Supabase PATCH error:', response.status);
    return null;
  }

  const profiles = await response.json() as ProfileData[];
  return profiles[0] || null;
}

// ========== API HANDLERS ==========
async function handleGetProfile(userId: string, request: Request, env: Env): Promise<Response> {
  const profile = await getProfileFromSupabase(userId, env);
  
  if (!profile) {
    return errorResponse('Profile not found', 404, env, request);
  }

  return jsonResponse({ success: true, profile }, 200, env, request);
}

async function handleUpdateProfile(userId: string, request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, env, request);
  }

  const sanitizedData = sanitizeProfileUpdate(body);
  if (!sanitizedData) {
    return errorResponse('Invalid or empty update data. Allowed fields: display_name, bio, avatar_url, website', 400, env, request);
  }

  const profile = await updateProfileInSupabase(userId, sanitizedData, env);
  
  if (!profile) {
    return errorResponse('Failed to update profile', 500, env, request);
  }

  return jsonResponse({ success: true, profile }, 200, env, request);
}

async function handleMediaPresign(userId: string, request: Request, env: Env): Promise<Response> {
  // TODO: Implement R2/Storage presigned URL generation
  return jsonResponse({
    success: false,
    error: 'Media upload not yet implemented',
    todo: 'Integrate with Cloudflare R2 or Supabase Storage'
  }, 501, env, request);
}

async function handleHealthCheck(request: Request, env: Env): Response {
  return jsonResponse({
    success: true,
    status: 'healthy',
    version: '2.0.0',
    features: ['jwks-verification', 'cors-whitelist', 'input-validation']
  }, 200, env, request);
}

// ========== MAIN ROUTER ==========
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env),
      });
    }

    // ===== PUBLIC ROUTES =====
    if (path === '/api/health' && method === 'GET') {
      return handleHealthCheck(request, env);
    }

    // ===== PROTECTED ROUTES =====
    if (path === '/api/profile/me') {
      if (method === 'GET') {
        return withAuth(request, env, handleGetProfile);
      }
      if (method === 'PATCH') {
        return withAuth(request, env, handleUpdateProfile);
      }
    }

    if (path === '/api/media/presign' && method === 'POST') {
      return withAuth(request, env, handleMediaPresign);
    }

    // ===== 404 =====
    return errorResponse('Not Found', 404, env, request);
  },
};
