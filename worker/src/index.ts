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

// Comments constants
const MAX_COMMENT_LENGTH = 2000;
const DEFAULT_COMMENTS_LIMIT = 20;
const MAX_COMMENTS_LIMIT = 50;

// Media constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MEDIA_PURPOSES = ['avatar', 'post'] as const;

interface PresignRequest {
  filename: string;
  contentType: string;
  purpose: 'avatar' | 'post';
}

interface PresignResponse {
  signedUrl: string;
  token: string;
  publicUrl: string;
  path: string;
}

// ========== LIKES & COMMENTS TYPES ==========
interface LikeData {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

interface CommentData {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

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

// ========== LIKES SUPABASE HELPERS ==========
async function getLikeByUserAndPost(userId: string, postId: string, env: Env): Promise<LikeData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/likes?user_id=eq.${userId}&post_id=eq.${postId}&select=*`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return null;
  const likes = await response.json() as LikeData[];
  return likes[0] || null;
}

async function createLikeInSupabase(userId: string, postId: string, env: Env): Promise<LikeData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/likes`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, post_id: postId }),
  });

  if (!response.ok) {
    console.error('Supabase create like error:', response.status);
    return null;
  }

  const likes = await response.json() as LikeData[];
  return likes[0] || null;
}

async function deleteLikeFromSupabase(userId: string, postId: string, env: Env): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/likes?user_id=eq.${userId}&post_id=eq.${postId}`;
  
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

async function updatePostLikesCount(postId: string, delta: number, env: Env): Promise<boolean> {
  // Get current likes_count
  const post = await getPostById(postId, env);
  if (!post) return false;
  
  const newCount = Math.max(0, (post.likes_count || 0) + delta);
  
  const url = `${env.SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ likes_count: newCount }),
  });

  return response.ok;
}

// ========== COMMENTS SUPABASE HELPERS ==========
async function getCommentsFromSupabase(
  postId: string,
  env: Env,
  limit: number = DEFAULT_COMMENTS_LIMIT,
  offset: number = 0
): Promise<{ comments: CommentData[]; total: number } | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/comments?post_id=eq.${postId}&select=*,author:profiles!user_id(id,display_name,avatar_url)&order=created_at.asc&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact',
    },
  });

  if (!response.ok) {
    console.error('Supabase GET comments error:', response.status);
    return null;
  }

  const comments = await response.json() as CommentData[];
  const total = parseInt(response.headers.get('content-range')?.split('/')[1] || '0', 10);
  
  return { comments, total };
}

async function getCommentById(commentId: string, env: Env): Promise<CommentData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}&select=*`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return null;
  const comments = await response.json() as CommentData[];
  return comments[0] || null;
}

async function createCommentInSupabase(
  userId: string,
  postId: string,
  content: string,
  env: Env
): Promise<CommentData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/comments`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, post_id: postId, content }),
  });

  if (!response.ok) {
    console.error('Supabase create comment error:', response.status);
    return null;
  }

  const comments = await response.json() as CommentData[];
  const comment = comments[0];
  
  // Fetch author info
  if (comment) {
    const author = await getProfileFromSupabase(userId, env);
    if (author) {
      comment.author = {
        id: author.id,
        display_name: author.display_name,
        avatar_url: author.avatar_url,
      };
    }
  }
  
  return comment || null;
}

async function deleteCommentFromSupabase(commentId: string, env: Env): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}`;
  
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

async function updatePostCommentsCount(postId: string, delta: number, env: Env): Promise<boolean> {
  const post = await getPostById(postId, env);
  if (!post) return false;
  
  const newCount = Math.max(0, (post.comments_count || 0) + delta);
  
  const url = `${env.SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comments_count: newCount }),
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, env, request);
  }

  // Validate request
  const validated = validatePresignRequest(body);
  if (!validated) {
    return errorResponse(
      `Invalid request. Required: filename, contentType (${ALLOWED_MEDIA_TYPES.join(', ')}), purpose (avatar|post)`,
      400, env, request
    );
  }

  const { filename, contentType, purpose } = validated;

  // Generate unique file path
  const timestamp = Date.now();
  const ext = filename.split('.').pop() || 'jpg';
  const uniqueFilename = purpose === 'avatar' 
    ? `avatar-${timestamp}.${ext}`
    : `post-${timestamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  
  const filePath = `${userId}/${purpose}s/${uniqueFilename}`;

  // Create signed upload URL using Supabase Storage API
  const signedUrlResponse = await createSignedUploadUrl(filePath, env);
  
  if (!signedUrlResponse) {
    return errorResponse('Failed to create upload URL', 500, env, request);
  }

  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/media/${filePath}`;

  return jsonResponse({
    success: true,
    signedUrl: signedUrlResponse.signedUrl,
    token: signedUrlResponse.token,
    publicUrl,
    path: filePath,
  }, 200, env, request);
}

function validatePresignRequest(body: unknown): PresignRequest | null {
  if (!body || typeof body !== 'object') return null;
  
  const data = body as Record<string, unknown>;
  
  if (typeof data.filename !== 'string' || data.filename.length === 0) return null;
  if (typeof data.contentType !== 'string') return null;
  if (!ALLOWED_MEDIA_TYPES.includes(data.contentType)) return null;
  if (typeof data.purpose !== 'string') return null;
  if (!MEDIA_PURPOSES.includes(data.purpose as 'avatar' | 'post')) return null;
  
  return {
    filename: data.filename,
    contentType: data.contentType,
    purpose: data.purpose as 'avatar' | 'post',
  };
}

async function createSignedUploadUrl(
  path: string,
  env: Env
): Promise<{ signedUrl: string; token: string } | null> {
  const url = `${env.SUPABASE_URL}/storage/v1/object/upload/sign/media/${path}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expiresIn: 600, // 10 minutes
      }),
    });

    if (!response.ok) {
      console.error('Supabase signed URL error:', response.status, await response.text());
      return null;
    }

    const data = await response.json() as { url: string; token: string };
    return {
      signedUrl: `${env.SUPABASE_URL}/storage/v1${data.url}`,
      token: data.token,
    };
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
}

async function handleHealthCheck(request: Request, env: Env): Response {
  return jsonResponse({
    success: true,
    status: 'healthy',
    version: '2.2.0',
    features: ['jwks-verification', 'cors-whitelist', 'input-validation', 'posts-api', 'media-upload']
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

// ========== LIKES API HANDLERS ==========
async function handleLikePost(userId: string, postId: string, request: Request, env: Env): Promise<Response> {
  // Check if post exists
  const post = await getPostById(postId, env);
  if (!post) {
    return errorResponse('Post not found', 404, env, request);
  }

  // Check if already liked
  const existingLike = await getLikeByUserAndPost(userId, postId, env);
  if (existingLike) {
    return jsonResponse({ success: true, liked: true, message: 'Already liked' }, 200, env, request);
  }

  // Create like
  const like = await createLikeInSupabase(userId, postId, env);
  if (!like) {
    return errorResponse('Failed to like post', 500, env, request);
  }

  // Update likes count
  await updatePostLikesCount(postId, 1, env);

  return jsonResponse({ success: true, liked: true }, 201, env, request);
}

async function handleUnlikePost(userId: string, postId: string, request: Request, env: Env): Promise<Response> {
  // Check if post exists
  const post = await getPostById(postId, env);
  if (!post) {
    return errorResponse('Post not found', 404, env, request);
  }

  // Check if like exists
  const existingLike = await getLikeByUserAndPost(userId, postId, env);
  if (!existingLike) {
    return jsonResponse({ success: true, liked: false, message: 'Not liked' }, 200, env, request);
  }

  // Delete like
  const success = await deleteLikeFromSupabase(userId, postId, env);
  if (!success) {
    return errorResponse('Failed to unlike post', 500, env, request);
  }

  // Update likes count
  await updatePostLikesCount(postId, -1, env);

  return jsonResponse({ success: true, liked: false }, 200, env, request);
}

async function handleGetLikeStatus(userId: string, postId: string, request: Request, env: Env): Promise<Response> {
  const like = await getLikeByUserAndPost(userId, postId, env);
  return jsonResponse({ success: true, liked: !!like }, 200, env, request);
}

// ========== COMMENTS API HANDLERS ==========
async function handleGetComments(postId: string, request: Request, env: Env): Promise<Response> {
  // Check if post exists
  const post = await getPostById(postId, env);
  if (!post) {
    return errorResponse('Post not found', 404, env, request);
  }

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_COMMENTS_LIMIT), 10),
    MAX_COMMENTS_LIMIT
  );
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const result = await getCommentsFromSupabase(postId, env, limit, offset);
  
  if (!result) {
    return errorResponse('Failed to fetch comments', 500, env, request);
  }

  return jsonResponse({
    success: true,
    comments: result.comments,
    total: result.total,
    limit,
    offset,
  }, 200, env, request);
}

async function handleCreateComment(userId: string, postId: string, request: Request, env: Env): Promise<Response> {
  // Check if post exists
  const post = await getPostById(postId, env);
  if (!post) {
    return errorResponse('Post not found', 404, env, request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, env, request);
  }

  // Validate content
  if (!body || typeof body !== 'object') {
    return errorResponse('Invalid request body', 400, env, request);
  }

  const data = body as Record<string, unknown>;
  if (typeof data.content !== 'string' || data.content.trim().length === 0) {
    return errorResponse('Content is required', 400, env, request);
  }

  const content = data.content.trim();
  if (content.length > MAX_COMMENT_LENGTH) {
    return errorResponse(`Content must be under ${MAX_COMMENT_LENGTH} characters`, 400, env, request);
  }

  const comment = await createCommentInSupabase(userId, postId, content, env);
  
  if (!comment) {
    return errorResponse('Failed to create comment', 500, env, request);
  }

  // Update comments count
  await updatePostCommentsCount(postId, 1, env);

  return jsonResponse({ success: true, comment }, 201, env, request);
}

async function handleDeleteComment(userId: string, commentId: string, request: Request, env: Env): Promise<Response> {
  // Check if comment exists
  const comment = await getCommentById(commentId, env);
  if (!comment) {
    return errorResponse('Comment not found', 404, env, request);
  }

  // Check ownership
  if (comment.user_id !== userId) {
    return errorResponse('Access denied', 403, env, request);
  }

  const postId = comment.post_id;

  const success = await deleteCommentFromSupabase(commentId, env);
  if (!success) {
    return errorResponse('Failed to delete comment', 500, env, request);
  }

  // Update comments count
  await updatePostCommentsCount(postId, -1, env);

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

    // ===== LIKES ROUTES =====
    // POST /api/posts/:id/like - Protected: like post
    const likeMatch = path.match(/^\/api\/posts\/([a-f0-9-]+)\/like$/);
    if (likeMatch) {
      const postId = likeMatch[1];
      
      if (method === 'POST') {
        return withAuth(request, env, (userId, req, e) => 
          handleLikePost(userId, postId, req, e)
        );
      }
      
      if (method === 'DELETE') {
        return withAuth(request, env, (userId, req, e) => 
          handleUnlikePost(userId, postId, req, e)
        );
      }
    }

    // GET /api/posts/:id/like/status - Protected: check like status
    const likeStatusMatch = path.match(/^\/api\/posts\/([a-f0-9-]+)\/like\/status$/);
    if (likeStatusMatch && method === 'GET') {
      const postId = likeStatusMatch[1];
      return withAuth(request, env, (userId, req, e) => 
        handleGetLikeStatus(userId, postId, req, e)
      );
    }

    // ===== COMMENTS ROUTES =====
    // GET/POST /api/posts/:id/comments
    const commentsMatch = path.match(/^\/api\/posts\/([a-f0-9-]+)\/comments$/);
    if (commentsMatch) {
      const postId = commentsMatch[1];
      
      if (method === 'GET') {
        // Public endpoint
        return handleGetComments(postId, request, env);
      }
      
      if (method === 'POST') {
        return withAuth(request, env, (userId, req, e) => 
          handleCreateComment(userId, postId, req, e)
        );
      }
    }

    // DELETE /api/comments/:id - Protected: delete comment
    const commentDeleteMatch = path.match(/^\/api\/comments\/([a-f0-9-]+)$/);
    if (commentDeleteMatch && method === 'DELETE') {
      const commentId = commentDeleteMatch[1];
      return withAuth(request, env, (userId, req, e) => 
        handleDeleteComment(userId, commentId, req, e)
      );
    }

    // ===== 404 =====
    return errorResponse('Not Found', 404, env, request);
  },
};
