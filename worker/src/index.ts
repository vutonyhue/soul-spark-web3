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

// Posts constants
const ALLOWED_POST_FIELDS = ['content', 'image_url'];
const MAX_POST_CONTENT_LENGTH = 5000;
const DEFAULT_POSTS_LIMIT = 20;
const MAX_POSTS_LIMIT = 100;

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

// ========== POSTS TYPES ==========
interface PostData {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  coin_reward: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface CreatePostInput {
  content: string;
  image_url?: string;
}

// ========== POSTS VALIDATION ==========
function sanitizePostCreate(body: unknown): CreatePostInput | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const data = body as Record<string, unknown>;
  
  // Content is required
  if (typeof data.content !== 'string' || data.content.trim().length === 0) {
    return null;
  }

  const content = data.content.trim();
  if (content.length > MAX_POST_CONTENT_LENGTH) {
    return null;
  }

  const result: CreatePostInput = { content };

  // Optional image_url
  if (data.image_url !== undefined) {
    if (data.image_url !== null && typeof data.image_url !== 'string') {
      return null;
    }
    if (typeof data.image_url === 'string') {
      result.image_url = data.image_url.trim();
    }
  }

  return result;
}

function sanitizePostUpdate(body: unknown): Partial<CreatePostInput> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const data = body as Record<string, unknown>;
  const sanitized: Partial<CreatePostInput> = {};

  // Check for allowed fields only
  for (const key of Object.keys(data)) {
    if (!ALLOWED_POST_FIELDS.includes(key)) {
      console.warn(`Blocked attempt to update protected field: ${key}`);
      return null;
    }
  }

  if (data.content !== undefined) {
    if (typeof data.content !== 'string' || data.content.trim().length === 0) {
      return null;
    }
    if (data.content.length > MAX_POST_CONTENT_LENGTH) {
      return null;
    }
    sanitized.content = data.content.trim();
  }

  if (data.image_url !== undefined) {
    if (data.image_url !== null && typeof data.image_url !== 'string') {
      return null;
    }
    sanitized.image_url = typeof data.image_url === 'string' ? data.image_url.trim() : undefined;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

// ========== POSTS SUPABASE HELPERS ==========
async function getPostsFromSupabase(
  env: Env,
  limit: number = DEFAULT_POSTS_LIMIT,
  offset: number = 0
): Promise<{ posts: PostData[]; total: number } | null> {
  // Get posts with author info
  const url = `${env.SUPABASE_URL}/rest/v1/posts?select=*,author:profiles!user_id(id,display_name,avatar_url)&order=created_at.desc&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact',
    },
  });

  if (!response.ok) {
    console.error('Supabase GET posts error:', response.status);
    return null;
  }

  const posts = await response.json() as PostData[];
  const total = parseInt(response.headers.get('content-range')?.split('/')[1] || '0', 10);
  
  return { posts, total };
}

async function getPostById(postId: string, env: Env): Promise<PostData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=*,author:profiles!user_id(id,display_name,avatar_url)`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const posts = await response.json() as PostData[];
  return posts[0] || null;
}

async function createPostInSupabase(
  userId: string,
  data: CreatePostInput,
  env: Env
): Promise<PostData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/posts`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      content: data.content,
      image_url: data.image_url || null,
    }),
  });

  if (!response.ok) {
    console.error('Supabase POST error:', response.status);
    return null;
  }

  const posts = await response.json() as PostData[];
  const post = posts[0];
  
  // Fetch author info
  if (post) {
    const author = await getProfileFromSupabase(userId, env);
    if (author) {
      post.author = {
        id: author.id,
        display_name: author.display_name,
        avatar_url: author.avatar_url,
      };
    }
  }
  
  return post || null;
}

async function updatePostInSupabase(
  postId: string,
  data: Partial<CreatePostInput>,
  env: Env
): Promise<PostData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=*,author:profiles!user_id(id,display_name,avatar_url)`;
  
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
    console.error('Supabase PATCH post error:', response.status);
    return null;
  }

  const posts = await response.json() as PostData[];
  return posts[0] || null;
}

async function deletePostFromSupabase(postId: string, env: Env): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  return response.ok;
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
    version: '2.1.0',
    features: ['jwks-verification', 'cors-whitelist', 'input-validation', 'posts-api']
  }, 200, env, request);
}

// ========== POSTS API HANDLERS ==========
async function handleGetPosts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_POSTS_LIMIT), 10),
    MAX_POSTS_LIMIT
  );
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const result = await getPostsFromSupabase(env, limit, offset);
  
  if (!result) {
    return errorResponse('Failed to fetch posts', 500, env, request);
  }

  return jsonResponse({
    success: true,
    posts: result.posts,
    total: result.total,
    limit,
    offset,
  }, 200, env, request);
}

async function handleCreatePost(userId: string, request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, env, request);
  }

  const sanitizedData = sanitizePostCreate(body);
  if (!sanitizedData) {
    return errorResponse(
      `Invalid post data. Content is required and must be under ${MAX_POST_CONTENT_LENGTH} characters.`,
      400,
      env,
      request
    );
  }

  const post = await createPostInSupabase(userId, sanitizedData, env);
  
  if (!post) {
    return errorResponse('Failed to create post', 500, env, request);
  }

  return jsonResponse({ success: true, post }, 201, env, request);
}

async function handleUpdatePost(userId: string, postId: string, request: Request, env: Env): Promise<Response> {
  // First check if post exists and belongs to user
  const existingPost = await getPostById(postId, env);
  
  if (!existingPost) {
    return errorResponse('Post not found', 404, env, request);
  }

  if (existingPost.user_id !== userId) {
    return errorResponse('Access denied', 403, env, request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, env, request);
  }

  const sanitizedData = sanitizePostUpdate(body);
  if (!sanitizedData) {
    return errorResponse(
      `Invalid update data. Allowed fields: ${ALLOWED_POST_FIELDS.join(', ')}`,
      400,
      env,
      request
    );
  }

  const post = await updatePostInSupabase(postId, sanitizedData, env);
  
  if (!post) {
    return errorResponse('Failed to update post', 500, env, request);
  }

  return jsonResponse({ success: true, post }, 200, env, request);
}

async function handleDeletePost(userId: string, postId: string, request: Request, env: Env): Promise<Response> {
  // First check if post exists and belongs to user
  const existingPost = await getPostById(postId, env);
  
  if (!existingPost) {
    return errorResponse('Post not found', 404, env, request);
  }

  if (existingPost.user_id !== userId) {
    return errorResponse('Access denied', 403, env, request);
  }

  const success = await deletePostFromSupabase(postId, env);
  
  if (!success) {
    return errorResponse('Failed to delete post', 500, env, request);
  }

  return jsonResponse({ success: true }, 200, env, request);
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

    // ===== POSTS ROUTES =====
    // GET /api/posts - Public: list posts with pagination
    if (path === '/api/posts' && method === 'GET') {
      return handleGetPosts(request, env);
    }

    // POST /api/posts - Protected: create new post
    if (path === '/api/posts' && method === 'POST') {
      return withAuth(request, env, handleCreatePost);
    }

    // PATCH/DELETE /api/posts/:id - Protected: update/delete post
    const postMatch = path.match(/^\/api\/posts\/([a-f0-9-]+)$/);
    if (postMatch) {
      const postId = postMatch[1];
      
      if (method === 'PATCH') {
        return withAuth(request, env, (userId, req, e) => 
          handleUpdatePost(userId, postId, req, e)
        );
      }
      
      if (method === 'DELETE') {
        return withAuth(request, env, (userId, req, e) => 
          handleDeletePost(userId, postId, req, e)
        );
      }
    }

    // ===== 404 =====
    return errorResponse('Not Found', 404, env, request);
  },
};
