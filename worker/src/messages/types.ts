/**
 * Messaging Types for Cloudflare Worker
 */

export interface ConversationData {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipantData {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  left_at: string | null;
  last_read_at: string | null;
  is_muted: boolean;
}

export interface MessageData {
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
  reply_to?: MessageData | null;
}

export interface ConversationWithDetails extends ConversationData {
  participants: Array<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  last_message?: MessageData | null;
  unread_count: number;
}

export interface CreateConversationInput {
  type?: 'direct' | 'group';
  name?: string;
  participant_ids: string[];
}

export interface SendMessageInput {
  content: string;
  message_type?: 'text' | 'image' | 'video' | 'file';
  media_url?: string;
  reply_to_id?: string;
}

// Constants
export const MAX_MESSAGE_LENGTH = 5000;
export const DEFAULT_MESSAGES_LIMIT = 50;
export const MAX_MESSAGES_LIMIT = 100;
export const MAX_CONVERSATION_NAME_LENGTH = 100;
