/**
 * Message Handlers for Messaging
 */

import type {
  MessageData,
  SendMessageInput,
  MAX_MESSAGE_LENGTH,
  DEFAULT_MESSAGES_LIMIT,
  MAX_MESSAGES_LIMIT,
} from './types';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ========== VALIDATION ==========
export function validateSendMessage(body: unknown): SendMessageInput | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const data = body as Record<string, unknown>;

  // Content is required for text messages
  if (typeof data.content !== 'string') {
    return null;
  }

  const content = data.content.trim();
  if (content.length === 0 || content.length > 5000) {
    return null;
  }

  const result: SendMessageInput = { content };

  // Optional message_type
  if (data.message_type !== undefined) {
    if (!['text', 'image', 'video', 'file'].includes(data.message_type as string)) {
      return null;
    }
    result.message_type = data.message_type as 'text' | 'image' | 'video' | 'file';
  }

  // Optional media_url
  if (data.media_url !== undefined) {
    if (typeof data.media_url !== 'string') {
      return null;
    }
    result.media_url = data.media_url;
  }

  // Optional reply_to_id
  if (data.reply_to_id !== undefined) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof data.reply_to_id !== 'string' || !uuidRegex.test(data.reply_to_id)) {
      return null;
    }
    result.reply_to_id = data.reply_to_id;
  }

  return result;
}

export function validateEditMessage(body: unknown): { content: string } | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const data = body as Record<string, unknown>;

  if (typeof data.content !== 'string') {
    return null;
  }

  const content = data.content.trim();
  if (content.length === 0 || content.length > 5000) {
    return null;
  }

  return { content };
}

// ========== SUPABASE HELPERS ==========

/**
 * Get messages for a conversation
 */
export async function getMessagesForConversation(
  conversationId: string,
  env: Env,
  limit: number = 50,
  before?: string
): Promise<{ messages: MessageData[]; total: number } | null> {
  let url = `${env.SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&is_deleted=eq.false&select=*,sender:sender_id(id,display_name,avatar_url)&order=created_at.desc&limit=${limit}`;
  
  if (before) {
    url += `&created_at=lt.${before}`;
  }

  const res = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'count=exact',
    },
  });

  if (!res.ok) {
    console.error('Failed to get messages:', res.status);
    return null;
  }

  const messages = await res.json() as MessageData[];
  const total = parseInt(res.headers.get('content-range')?.split('/')[1] || '0', 10);

  // Reverse to show oldest first
  messages.reverse();

  return { messages, total };
}

/**
 * Send a message
 */
export async function sendMessage(
  userId: string,
  conversationId: string,
  input: SendMessageInput,
  env: Env
): Promise<MessageData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/messages`;
  
  const body: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: userId,
    content: input.content,
    message_type: input.message_type || 'text',
  };

  if (input.media_url) {
    body.media_url = input.media_url;
  }

  if (input.reply_to_id) {
    body.reply_to_id = input.reply_to_id;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('Failed to send message:', res.status);
    return null;
  }

  const messages = await res.json() as MessageData[];
  const message = messages[0];

  // Get sender info
  const senderUrl = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,display_name,avatar_url`;
  const senderRes = await fetch(senderUrl, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (senderRes.ok) {
    const senders = await senderRes.json() as any[];
    if (senders[0]) {
      message.sender = senders[0];
    }
  }

  return message;
}

/**
 * Get a single message by ID
 */
export async function getMessageById(
  messageId: string,
  env: Env
): Promise<MessageData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}&select=*`;
  
  const res = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) return null;

  const messages = await res.json() as MessageData[];
  return messages[0] || null;
}

/**
 * Edit a message
 */
export async function editMessage(
  messageId: string,
  content: string,
  env: Env
): Promise<MessageData | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}`;
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      content,
      is_edited: true,
    }),
  });

  if (!res.ok) {
    console.error('Failed to edit message:', res.status);
    return null;
  }

  const messages = await res.json() as MessageData[];
  return messages[0] || null;
}

/**
 * Soft delete a message
 */
export async function deleteMessage(
  messageId: string,
  env: Env
): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}`;
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      is_deleted: true,
      content: null,
      media_url: null,
    }),
  });

  return res.ok;
}
