/**
 * FUN Profile API Gateway - Cloudflare Worker
 * 
 * This worker acts as a secure API gateway between the frontend and Supabase.
 * - Frontend sends requests with Bearer token (from Supabase Auth)
 * - Worker verifies token and proxies requests to Supabase with Service Role Key
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGIN?: string; // Optional: for production CORS restriction
}

interface SupabaseUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

// CORS headers - adjust ALLOWED_ORIGIN in production
const getCorsHeaders = (env: Env): HeadersInit => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
});

// JSON response helper
const jsonResponse = (data: unknown, status: number, env: Env): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(env),
      'Content-Type': 'application/json',
    },
  });
};

// Error response helper
const errorResponse = (message: string, status: number, env: Env): Response => {
  return jsonResponse({ error: message }, status, env);
};

/**
 * Verify JWT token by calling Supabase Auth API
 * Returns user object if valid, null if invalid
 */
async function verifyToken(token: string, env: Env): Promise<SupabaseUser | null> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json() as SupabaseUser;
    return user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * GET /api/profile/me - Get current user's profile
 */
async function getMyProfile(userId: string, env: Env): Promise<Response> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase error:', errorText);
      return errorResponse('Failed to fetch profile', response.status, env);
    }

    const profiles = await response.json() as unknown[];
    const profile = profiles[0] || null;

    return jsonResponse({ profile }, 200, env);
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse('Internal server error', 500, env);
  }
}

/**
 * PATCH /api/profile/me - Update current user's profile
 */
async function updateMyProfile(userId: string, body: Record<string, unknown>, env: Env): Promise<Response> {
  try {
    // Validate and sanitize input - only allow specific fields
    const allowedFields = ['display_name', 'bio', 'avatar_url'];
    const sanitizedBody: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        // Basic validation
        const value = body[field];
        if (typeof value === 'string' && value.length <= 1000) {
          sanitizedBody[field] = value.trim();
        }
      }
    }

    if (Object.keys(sanitizedBody).length === 0) {
      return errorResponse('No valid fields to update', 400, env);
    }

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(sanitizedBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase update error:', errorText);
      return errorResponse('Failed to update profile', response.status, env);
    }

    const profiles = await response.json() as unknown[];
    const profile = profiles[0] || null;

    return jsonResponse({ profile }, 200, env);
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse('Internal server error', 500, env);
  }
}

/**
 * POST /api/media/presign - Generate presigned upload URL (placeholder)
 */
async function presignMediaUpload(_userId: string, env: Env): Promise<Response> {
  // TODO: Implement when media upload feature is added
  // This could integrate with Cloudflare R2 or Supabase Storage
  return jsonResponse(
    { 
      error: 'Not implemented',
      message: 'Media upload feature coming soon'
    }, 
    501, 
    env
  );
}

/**
 * Middleware to verify authentication
 */
async function withAuth(
  request: Request,
  env: Env,
  handler: (userId: string, env: Env) => Promise<Response>
): Promise<Response> {
  const token = extractToken(request);

  if (!token) {
    return errorResponse('Missing authorization token', 401, env);
  }

  const user = await verifyToken(token, env);

  if (!user) {
    return errorResponse('Invalid or expired token', 401, env);
  }

  return handler(user.id, env);
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders 
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ============== API Routes ==============

      // GET /api/profile/me
      if (path === '/api/profile/me' && request.method === 'GET') {
        return withAuth(request, env, (userId) => getMyProfile(userId, env));
      }

      // PATCH /api/profile/me
      if (path === '/api/profile/me' && request.method === 'PATCH') {
        return withAuth(request, env, async (userId) => {
          const body = await request.json() as Record<string, unknown>;
          return updateMyProfile(userId, body, env);
        });
      }

      // POST /api/media/presign
      if (path === '/api/media/presign' && request.method === 'POST') {
        return withAuth(request, env, (userId) => presignMediaUpload(userId, env));
      }

      // Health check endpoint
      if (path === '/api/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, env);
      }

      // ============== 404 Not Found ==============
      return errorResponse('Not found', 404, env);

    } catch (error) {
      console.error('Unhandled error:', error);
      return errorResponse('Internal server error', 500, env);
    }
  },
};
