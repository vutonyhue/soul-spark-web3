/**
 * API Helper Functions
 * 
 * All data operations go through the Cloudflare Worker API Gateway.
 * Authentication is handled via Bearer token from Supabase Auth.
 */

import { supabase } from '@/integrations/supabase/client';

// Worker API base URL - change this after deploying your worker
const API_BASE_URL = import.meta.env.VITE_WORKER_API_BASE_URL || 'http://localhost:8787';

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  wallet_address: string | null;
  camly_balance: number | null;
  created_at: string;
  updated_at: string;
}

interface ProfileUpdateData {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

/**
 * Fetch with authentication
 * Automatically includes Bearer token from current Supabase session
 */
async function fetchWithAuth<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      return { data: null, error: 'Not authenticated' };
    }

    // Build request
    const url = `${API_BASE_URL}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      return { 
        data: null, 
        error: json.error || `Request failed with status ${response.status}` 
      };
    }

    return { data: json as T, error: null };
  } catch (error) {
    console.error('API request failed:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * Get current user's profile
 */
export async function getMyProfile(): Promise<ApiResponse<{ profile: Profile | null }>> {
  return fetchWithAuth<{ profile: Profile | null }>('/api/profile/me', {
    method: 'GET',
  });
}

/**
 * Update current user's profile
 */
export async function updateMyProfile(
  data: ProfileUpdateData
): Promise<ApiResponse<{ profile: Profile }>> {
  return fetchWithAuth<{ profile: Profile }>('/api/profile/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ========== MEDIA UPLOAD API ==========

interface PresignUrlResponse {
  signedUrl: string;
  token: string;
  publicUrl: string;
  path: string;
}

/**
 * Request presigned URL for media upload
 */
export async function getMediaPresignUrl(
  filename: string,
  contentType: string,
  purpose: 'avatar' | 'post'
): Promise<ApiResponse<PresignUrlResponse>> {
  return fetchWithAuth<PresignUrlResponse>('/api/media/presign', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType, purpose }),
  });
}

/**
 * Upload file to Supabase Storage using signed URL
 */
export async function uploadMedia(
  file: File,
  purpose: 'avatar' | 'post'
): Promise<ApiResponse<{ publicUrl: string }>> {
  // Step 1: Get presigned URL
  const { data: presignData, error: presignError } = await getMediaPresignUrl(
    file.name,
    file.type,
    purpose
  );

  if (presignError || !presignData) {
    return { data: null, error: presignError || 'Failed to get upload URL' };
  }

  // Step 2: Upload file directly to storage using signed URL
  try {
    const uploadResponse = await fetch(presignData.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload error:', errorText);
      return { data: null, error: 'Failed to upload file' };
    }

    return { 
      data: { publicUrl: presignData.publicUrl }, 
      error: null 
    };
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

/**
 * Health check
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ========== POSTS API ==========

export interface Post {
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

interface PostsResponse {
  posts: Post[];
  total: number;
  limit: number;
  offset: number;
}

interface CreatePostData {
  content: string;
  image_url?: string;
}

interface UpdatePostData {
  content?: string;
  image_url?: string;
}

/**
 * Fetch public posts (no auth required)
 */
export async function getPosts(
  limit: number = 20,
  offset: number = 0
): Promise<ApiResponse<PostsResponse>> {
  try {
    const url = `${API_BASE_URL}/api/posts?limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      return { 
        data: null, 
        error: json.error || `Request failed with status ${response.status}` 
      };
    }

    return { data: json as PostsResponse, error: null };
  } catch (error) {
    console.error('API request failed:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * Create a new post (requires auth)
 */
export async function createPost(
  data: CreatePostData
): Promise<ApiResponse<{ post: Post }>> {
  return fetchWithAuth<{ post: Post }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update a post (requires auth, owner only)
 */
export async function updatePost(
  postId: string,
  data: UpdatePostData
): Promise<ApiResponse<{ post: Post }>> {
  return fetchWithAuth<{ post: Post }>(`/api/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a post (requires auth, owner only)
 */
export async function deletePost(
  postId: string
): Promise<ApiResponse<{ success: boolean }>> {
  return fetchWithAuth<{ success: boolean }>(`/api/posts/${postId}`, {
    method: 'DELETE',
  });
}

// ========== LIKES API ==========

/**
 * Like a post (requires auth)
 */
export async function likePost(
  postId: string
): Promise<ApiResponse<{ liked: boolean }>> {
  return fetchWithAuth<{ liked: boolean }>(`/api/posts/${postId}/like`, {
    method: 'POST',
  });
}

/**
 * Unlike a post (requires auth)
 */
export async function unlikePost(
  postId: string
): Promise<ApiResponse<{ liked: boolean }>> {
  return fetchWithAuth<{ liked: boolean }>(`/api/posts/${postId}/like`, {
    method: 'DELETE',
  });
}

/**
 * Get like status for a post (requires auth)
 */
export async function getLikeStatus(
  postId: string
): Promise<ApiResponse<{ liked: boolean }>> {
  return fetchWithAuth<{ liked: boolean }>(`/api/posts/${postId}/like/status`, {
    method: 'GET',
  });
}

// ========== COMMENTS API ==========

export interface Comment {
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

interface CommentsResponse {
  comments: Comment[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get comments for a post (public)
 */
export async function getComments(
  postId: string,
  limit: number = 20,
  offset: number = 0
): Promise<ApiResponse<CommentsResponse>> {
  try {
    const url = `${API_BASE_URL}/api/posts/${postId}/comments?limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      return { 
        data: null, 
        error: json.error || `Request failed with status ${response.status}` 
      };
    }

    return { data: json as CommentsResponse, error: null };
  } catch (error) {
    console.error('API request failed:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * Create a comment (requires auth)
 */
export async function createComment(
  postId: string,
  content: string
): Promise<ApiResponse<{ comment: Comment }>> {
  return fetchWithAuth<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

/**
 * Delete a comment (requires auth, owner only)
 */
export async function deleteComment(
  commentId: string
): Promise<ApiResponse<{ success: boolean }>> {
  return fetchWithAuth<{ success: boolean }>(`/api/comments/${commentId}`, {
    method: 'DELETE',
  });
}
