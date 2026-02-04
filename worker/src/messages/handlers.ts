/**
 * HTTP Request Handlers for Messaging API
 */

import {
  validateCreateConversation,
  getConversationsForUser,
  createConversation,
  isUserParticipant,
  markConversationAsRead,
} from './conversations';

import {
  validateSendMessage,
  validateEditMessage,
  getMessagesForConversation,
  sendMessage,
  getMessageById,
  editMessage,
  deleteMessage,
} from './messages';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGINS?: string;
}

// ========== HELPERS ==========
function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = (env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim());
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  
  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }
  return {};
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

// ========== CONVERSATION HANDLERS ==========

/**
 * GET /api/conversations - List user's conversations
 */
export async function handleGetConversations(
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const result = await getConversationsForUser(userId, env, limit, offset);
  
  if (!result) {
    return errorResponse('Failed to fetch conversations', 500, env, request);
  }

  return jsonResponse({
    conversations: result.conversations,
    total: result.total,
    limit,
    offset,
  }, 200, env, request);
}

/**
 * POST /api/conversations - Create new conversation
 */
export async function handleCreateConversation(
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400, env, request);
  }

  const input = validateCreateConversation(body);
  if (!input) {
    return errorResponse('Invalid input', 400, env, request);
  }

  const conversation = await createConversation(userId, input, env);
  
  if (!conversation) {
    return errorResponse('Failed to create conversation', 500, env, request);
  }

  return jsonResponse({ conversation }, 201, env, request);
}

/**
 * POST /api/conversations/:id/read - Mark as read
 */
export async function handleMarkAsRead(
  userId: string,
  conversationId: string,
  request: Request,
  env: Env
): Promise<Response> {
  // Verify user is participant
  const isParticipant = await isUserParticipant(userId, conversationId, env);
  if (!isParticipant) {
    return errorResponse('Access denied', 403, env, request);
  }

  const success = await markConversationAsRead(userId, conversationId, env);
  
  if (!success) {
    return errorResponse('Failed to mark as read', 500, env, request);
  }

  return jsonResponse({ success: true }, 200, env, request);
}

// ========== MESSAGE HANDLERS ==========

/**
 * GET /api/conversations/:id/messages - Get messages
 */
export async function handleGetMessages(
  userId: string,
  conversationId: string,
  request: Request,
  env: Env
): Promise<Response> {
  // Verify user is participant
  const isParticipant = await isUserParticipant(userId, conversationId, env);
  if (!isParticipant) {
    return errorResponse('Access denied', 403, env, request);
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const before = url.searchParams.get('before') || undefined;

  const result = await getMessagesForConversation(conversationId, env, limit, before);
  
  if (!result) {
    return errorResponse('Failed to fetch messages', 500, env, request);
  }

  return jsonResponse({
    messages: result.messages,
    total: result.total,
    limit,
  }, 200, env, request);
}

/**
 * POST /api/conversations/:id/messages - Send message
 */
export async function handleSendMessage(
  userId: string,
  conversationId: string,
  request: Request,
  env: Env
): Promise<Response> {
  // Verify user is participant
  const isParticipant = await isUserParticipant(userId, conversationId, env);
  if (!isParticipant) {
    return errorResponse('Access denied', 403, env, request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400, env, request);
  }

  const input = validateSendMessage(body);
  if (!input) {
    return errorResponse('Invalid message', 400, env, request);
  }

  const message = await sendMessage(userId, conversationId, input, env);
  
  if (!message) {
    return errorResponse('Failed to send message', 500, env, request);
  }

  // Auto-mark as read for sender
  await markConversationAsRead(userId, conversationId, env);

  return jsonResponse({ message }, 201, env, request);
}

/**
 * PATCH /api/messages/:id - Edit message
 */
export async function handleEditMessage(
  userId: string,
  messageId: string,
  request: Request,
  env: Env
): Promise<Response> {
  // Get message first
  const existingMessage = await getMessageById(messageId, env);
  if (!existingMessage) {
    return errorResponse('Message not found', 404, env, request);
  }

  // Check ownership
  if (existingMessage.sender_id !== userId) {
    return errorResponse('Access denied', 403, env, request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400, env, request);
  }

  const input = validateEditMessage(body);
  if (!input) {
    return errorResponse('Invalid content', 400, env, request);
  }

  const message = await editMessage(messageId, input.content, env);
  
  if (!message) {
    return errorResponse('Failed to edit message', 500, env, request);
  }

  return jsonResponse({ message }, 200, env, request);
}

/**
 * DELETE /api/messages/:id - Delete message
 */
export async function handleDeleteMessage(
  userId: string,
  messageId: string,
  request: Request,
  env: Env
): Promise<Response> {
  // Get message first
  const existingMessage = await getMessageById(messageId, env);
  if (!existingMessage) {
    return errorResponse('Message not found', 404, env, request);
  }

  // Check ownership
  if (existingMessage.sender_id !== userId) {
    return errorResponse('Access denied', 403, env, request);
  }

  const success = await deleteMessage(messageId, env);
  
  if (!success) {
    return errorResponse('Failed to delete message', 500, env, request);
  }

  return jsonResponse({ success: true }, 200, env, request);
}
