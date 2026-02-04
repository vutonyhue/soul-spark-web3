import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from '@/lib/api';

interface RealtimeMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const handleNewMessage = useCallback((payload: { new: RealtimeMessage }) => {
    const newMessage = payload.new;
    
    // Add to messages cache
    queryClient.setQueryData(['messages', newMessage.conversation_id], (old: any) => {
      if (!old) return { messages: [newMessage], total: 1, limit: 50 };
      
      // Check if message already exists
      const exists = old.messages.some((m: Message) => m.id === newMessage.id);
      if (exists) return old;
      
      return {
        ...old,
        messages: [...old.messages, newMessage],
        total: old.total + 1,
      };
    });

    // Invalidate conversations list to update unread counts
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [queryClient]);

  const handleMessageUpdate = useCallback((payload: { new: RealtimeMessage }) => {
    const updatedMessage = payload.new;
    
    queryClient.setQueryData(['messages', updatedMessage.conversation_id], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        messages: old.messages.map((m: Message) => 
          m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m
        ),
      };
    });
  }, [queryClient]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleMessageUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, handleNewMessage, handleMessageUpdate]);
}

// Hook to listen for all user's conversations (for unread badges)
export function useRealtimeConversations(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Invalidate conversations to refresh unread counts
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
