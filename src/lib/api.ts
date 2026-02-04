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
  video_url: string | null;
  media_type: string | null;
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
  video_url?: string;
  media_type?: 'image' | 'video' | 'none';
}

interface UpdatePostData {
  content?: string;
  image_url?: string;
  video_url?: string;
  media_type?: 'image' | 'video' | 'none';
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

// ========== MESSAGING API ==========

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  last_message?: Message | null;
  unread_count: number;
  participants: Array<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'file' | 'system';
  media_url: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
}

interface MessagesResponse {
  messages: Message[];
  total: number;
  limit: number;
}

interface CreateConversationData {
  participant_ids: string[];
  type?: 'direct' | 'group';
  name?: string;
}

interface SendMessageData {
  content: string;
  message_type?: 'text' | 'image' | 'video' | 'file';
  media_url?: string;
  reply_to_id?: string;
}

/**
 * Get user's conversations
 */
export async function getConversations(
  limit: number = 20,
  offset: number = 0
): Promise<ApiResponse<ConversationsResponse>> {
  return fetchWithAuth<ConversationsResponse>(`/api/conversations?limit=${limit}&offset=${offset}`, {
    method: 'GET',
  });
}

/**
 * Create a new conversation
 */
export async function createConversation(
  data: CreateConversationData
): Promise<ApiResponse<{ conversation: Conversation }>> {
  return fetchWithAuth<{ conversation: Conversation }>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get messages in a conversation
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  before?: string
): Promise<ApiResponse<MessagesResponse>> {
  let url = `/api/conversations/${conversationId}/messages?limit=${limit}`;
  if (before) {
    url += `&before=${encodeURIComponent(before)}`;
  }
  return fetchWithAuth<MessagesResponse>(url, {
    method: 'GET',
  });
}

/**
 * Send a message
 */
export async function sendMessage(
  conversationId: string,
  data: SendMessageData
): Promise<ApiResponse<{ message: Message }>> {
  return fetchWithAuth<{ message: Message }>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Mark conversation as read
 */
export async function markConversationAsRead(
  conversationId: string
): Promise<ApiResponse<{ success: boolean }>> {
  return fetchWithAuth<{ success: boolean }>(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
  });
}

/**
 * Edit a message
 */
export async function editMessage(
  messageId: string,
  content: string
): Promise<ApiResponse<{ message: Message }>> {
  return fetchWithAuth<{ message: Message }>(`/api/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

/**
 * Delete a message
 */
export async function deleteMessageById(
  messageId: string
): Promise<ApiResponse<{ success: boolean }>> {
  return fetchWithAuth<{ success: boolean }>(`/api/messages/${messageId}`, {
    method: 'DELETE',
  });
}

// ========== VIDEO UPLOAD API (R2) ==========

interface VideoPresignResponse {
  uploadId?: string;
  key: string;
  isMultipart: boolean;
  chunkSize?: number;
  publicUrl?: string;
}

interface VideoPartResponse {
  etag: string;
  partNumber: number;
}

interface VideoCompleteResponse {
  publicUrl: string;
  key: string;
}

/**
 * Request presigned URL for video upload
 */
export async function getVideoPresignUrl(
  filename: string,
  contentType: string,
  purpose: 'post' | 'story',
  fileSize: number
): Promise<ApiResponse<VideoPresignResponse>> {
  return fetchWithAuth<VideoPresignResponse>('/api/video/presign', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType, purpose, fileSize }),
  });
}

/**
 * Upload video part (chunk) for multipart upload
 */
export async function uploadVideoPart(
  uploadId: string,
  key: string,
  partNumber: number,
  chunk: ArrayBuffer
): Promise<ApiResponse<VideoPartResponse>> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      return { data: null, error: 'Not authenticated' };
    }

    const url = `${API_BASE_URL}/api/video/part?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: chunk,
    });

    const json = await response.json();

    if (!response.ok) {
      return { 
        data: null, 
        error: json.error || `Request failed with status ${response.status}` 
      };
    }

    return { data: json as VideoPartResponse, error: null };
  } catch (error) {
    console.error('Video part upload failed:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * Complete multipart video upload
 */
export async function completeVideoUpload(
  uploadId: string,
  key: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<ApiResponse<VideoCompleteResponse>> {
  return fetchWithAuth<VideoCompleteResponse>('/api/video/complete', {
    method: 'POST',
    body: JSON.stringify({ uploadId, key, parts }),
  });
}

/**
 * Direct upload for small videos (under 5MB)
 */
export async function uploadVideoDirectly(
  key: string,
  contentType: string,
  videoData: ArrayBuffer
): Promise<ApiResponse<VideoCompleteResponse>> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      return { data: null, error: 'Not authenticated' };
    }

    const url = `${API_BASE_URL}/api/video/direct?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: videoData,
    });

    const json = await response.json();

    if (!response.ok) {
      return { 
        data: null, 
        error: json.error || `Request failed with status ${response.status}` 
      };
    }

    return { data: json as VideoCompleteResponse, error: null };
  } catch (error) {
    console.error('Video direct upload failed:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * Abort multipart video upload
 */
export async function abortVideoUpload(
  uploadId: string,
  key: string
): Promise<ApiResponse<{ success: boolean }>> {
  return fetchWithAuth<{ success: boolean }>('/api/video/abort', {
    method: 'POST',
    body: JSON.stringify({ uploadId, key }),
  });
}

/**
 * Complete video upload handler
 * Handles both small files (direct upload) and large files (multipart)
 */
export async function uploadVideo(
  file: File,
  purpose: 'post' | 'story',
  onProgress?: (progress: number) => void
): Promise<ApiResponse<{ publicUrl: string }>> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  // Step 1: Get presign info
  const { data: presignData, error: presignError } = await getVideoPresignUrl(
    file.name,
    file.type,
    purpose,
    file.size
  );

  if (presignError || !presignData) {
    return { data: null, error: presignError || 'Failed to initiate upload' };
  }

  try {
    // Step 2: Handle based on multipart or direct
    if (!presignData.isMultipart) {
      // Direct upload for small files
      onProgress?.(10);
      const arrayBuffer = await file.arrayBuffer();
      onProgress?.(50);
      
      const { data, error } = await uploadVideoDirectly(
        presignData.key,
        file.type,
        arrayBuffer
      );

      if (error || !data) {
        return { data: null, error: error || 'Direct upload failed' };
      }

      onProgress?.(100);
      return { data: { publicUrl: data.publicUrl }, error: null };
    }

    // Multipart upload for large files
    const { uploadId, key, chunkSize = CHUNK_SIZE } = presignData;
    
    if (!uploadId) {
      return { data: null, error: 'Missing uploadId for multipart upload' };
    }

    const totalParts = Math.ceil(file.size / chunkSize);
    const parts: Array<{ partNumber: number; etag: string }> = [];

    for (let i = 0; i < totalParts; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = await file.slice(start, end).arrayBuffer();
      const partNumber = i + 1;

      const { data: partData, error: partError } = await uploadVideoPart(
        uploadId,
        key,
        partNumber,
        chunk
      );

      if (partError || !partData) {
        // Abort on failure
        await abortVideoUpload(uploadId, key);
        return { data: null, error: partError || `Failed to upload part ${partNumber}` };
      }

      parts.push({ partNumber: partData.partNumber, etag: partData.etag });
      onProgress?.(Math.round(((i + 1) / totalParts) * 90));
    }

    // Step 3: Complete multipart upload
    const { data: completeData, error: completeError } = await completeVideoUpload(
      uploadId,
      key,
      parts
    );

    if (completeError || !completeData) {
      return { data: null, error: completeError || 'Failed to complete upload' };
    }

    onProgress?.(100);
    return { data: { publicUrl: completeData.publicUrl }, error: null };
  } catch (error) {
    console.error('Video upload failed:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}
