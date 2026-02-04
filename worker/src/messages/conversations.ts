/**
 * Conversation Handlers for Messaging
 */

import type {
  ConversationData,
  ConversationWithDetails,
  CreateConversationInput,
  MAX_CONVERSATION_NAME_LENGTH,
} from './types';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ========== VALIDATION ==========
export function validateCreateConversation(body: unknown): CreateConversationInput | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const data = body as Record<string, unknown>;

  // participant_ids is required and must be array with at least 1 member
  if (!Array.isArray(data.participant_ids) || data.participant_ids.length === 0) {
    return null;
  }

  // Validate all participant_ids are valid UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of data.participant_ids) {
    if (typeof id !== 'string' || !uuidRegex.test(id)) {
      return null;
    }
  }

  const result: CreateConversationInput = {
    participant_ids: data.participant_ids as string[],
  };

  // Optional type
  if (data.type !== undefined) {
    if (!['direct', 'group'].includes(data.type as string)) {
      return null;
    }
    result.type = data.type as 'direct' | 'group';
  }

  // Optional name (for groups)
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.length > 100) {
      return null;
    }
    result.name = data.name.trim();
  }

  return result;
}

// ========== SUPABASE HELPERS ==========

/**
 * Get user's conversations with participants and last message
 */
export async function getConversationsForUser(
  userId: string,
  env: Env,
  limit: number = 20,
  offset: number = 0
): Promise<{ conversations: ConversationWithDetails[]; total: number } | null> {
  // Step 1: Get conversation IDs the user participates in
  const participantUrl = `${env.SUPABASE_URL}/rest/v1/conversation_participants?user_id=eq.${userId}&left_at=is.null&select=conversation_id`;
  
  const participantRes = await fetch(participantUrl, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!participantRes.ok) {
    console.error('Failed to get user conversation IDs:', participantRes.status);
    return null;
  }

  const participations = await participantRes.json() as Array<{ conversation_id: string }>;
  
  if (participations.length === 0) {
    return { conversations: [], total: 0 };
  }

  const conversationIds = participations.map(p => p.conversation_id);
  const idsFilter = conversationIds.map(id => `"${id}"`).join(',');

  // Step 2: Get conversations with pagination
  const convoUrl = `${env.SUPABASE_URL}/rest/v1/conversations?id=in.(${idsFilter})&order=last_message_at.desc.nullsfirst,created_at.desc&limit=${limit}&offset=${offset}`;
  
  const convoRes = await fetch(convoUrl, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'count=exact',
    },
  });

  if (!convoRes.ok) {
    console.error('Failed to get conversations:', convoRes.status);
    return null;
  }

  const conversations = await convoRes.json() as ConversationData[];
  const total = parseInt(convoRes.headers.get('content-range')?.split('/')[1] || '0', 10);

  // Step 3: Get participants for each conversation
  const result: ConversationWithDetails[] = [];

  for (const convo of conversations) {
    // Get participants
    const participantsUrl = `${env.SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${convo.id}&left_at=is.null&select=user_id,profiles:user_id(id,display_name,avatar_url)`;
    
    const participantsRes = await fetch(participantsUrl, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    let participants: Array<{ id: string; display_name: string | null; avatar_url: string | null }> = [];
    if (participantsRes.ok) {
      const rawParticipants = await participantsRes.json() as Array<{
        user_id: string;
        profiles: { id: string; display_name: string | null; avatar_url: string | null } | null;
      }>;
      participants = rawParticipants
        .filter(p => p.profiles)
        .map(p => ({
          id: p.profiles!.id,
          display_name: p.profiles!.display_name,
          avatar_url: p.profiles!.avatar_url,
        }));
    }

    // Get last message if exists
    let lastMessage = null;
    if (convo.last_message_id) {
      const msgUrl = `${env.SUPABASE_URL}/rest/v1/messages?id=eq.${convo.last_message_id}&select=*,sender:sender_id(id,display_name,avatar_url)`;
      const msgRes = await fetch(msgUrl, {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (msgRes.ok) {
        const msgs = await msgRes.json() as any[];
        lastMessage = msgs[0] || null;
      }
    }

    // Calculate unread count
    const userParticipantUrl = `${env.SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${convo.id}&user_id=eq.${userId}&select=last_read_at`;
    const userParticipantRes = await fetch(userParticipantUrl, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    let unreadCount = 0;
    if (userParticipantRes.ok) {
      const userPart = await userParticipantRes.json() as Array<{ last_read_at: string | null }>;
      if (userPart[0]) {
        const lastRead = userPart[0].last_read_at;
        if (lastRead) {
          // Count messages after last_read_at
          const countUrl = `${env.SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convo.id}&created_at=gt.${lastRead}&sender_id=neq.${userId}&select=id`;
          const countRes = await fetch(countUrl, {
            headers: {
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'count=exact',
            },
          });
          if (countRes.ok) {
            unreadCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);
          }
        } else {
          // Never read - count all messages not from user
          const countUrl = `${env.SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convo.id}&sender_id=neq.${userId}&select=id`;
          const countRes = await fetch(countUrl, {
            headers: {
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'count=exact',
            },
          });
          if (countRes.ok) {
            unreadCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);
          }
        }
      }
    }

    result.push({
      ...convo,
      participants,
      last_message: lastMessage,
      unread_count: unreadCount,
    });
  }

  return { conversations: result, total };
}

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  input: CreateConversationInput,
  env: Env
): Promise<ConversationWithDetails | null> {
  // For direct conversations, check if one already exists between these users
  if (input.type === 'direct' || (!input.type && input.participant_ids.length === 1)) {
    const otherUserId = input.participant_ids[0];
    
    // Find existing direct conversation
    const existingUrl = `${env.SUPABASE_URL}/rest/v1/rpc/find_direct_conversation`;
    // We'll handle this without RPC - just create new for now
    // TODO: Add RPC function to find existing direct conversations
  }

  // Step 1: Create conversation
  const convoUrl = `${env.SUPABASE_URL}/rest/v1/conversations`;
  const convoBody: Record<string, unknown> = {
    type: input.type || (input.participant_ids.length === 1 ? 'direct' : 'group'),
  };
  
  if (input.name) {
    convoBody.name = input.name;
  }

  const convoRes = await fetch(convoUrl, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(convoBody),
  });

  if (!convoRes.ok) {
    console.error('Failed to create conversation:', convoRes.status);
    return null;
  }

  const convos = await convoRes.json() as ConversationData[];
  const conversation = convos[0];

  // Step 2: Add all participants (including creator)
  const allParticipants = [userId, ...input.participant_ids.filter(id => id !== userId)];
  
  for (let i = 0; i < allParticipants.length; i++) {
    const participantId = allParticipants[i];
    const role = i === 0 ? 'owner' : 'member';
    
    const partUrl = `${env.SUPABASE_URL}/rest/v1/conversation_participants`;
    await fetch(partUrl, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversation.id,
        user_id: participantId,
        role,
      }),
    });
  }

  // Return with participants
  return {
    ...conversation,
    participants: [], // Will be populated by frontend
    unread_count: 0,
  };
}

/**
 * Check if user is participant of conversation
 */
export async function isUserParticipant(
  userId: string,
  conversationId: string,
  env: Env
): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${conversationId}&user_id=eq.${userId}&left_at=is.null&select=id`;
  
  const res = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) return false;
  
  const data = await res.json() as any[];
  return data.length > 0;
}

/**
 * Mark conversation as read
 */
export async function markConversationAsRead(
  userId: string,
  conversationId: string,
  env: Env
): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${conversationId}&user_id=eq.${userId}`;
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      last_read_at: new Date().toISOString(),
    }),
  });

  return res.ok;
}
