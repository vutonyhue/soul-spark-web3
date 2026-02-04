import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { getMessages, sendMessage, editMessage, deleteMessageById, Message } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useMessages(conversationId: string, limit: number = 50) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data, error } = await getMessages(conversationId, limit);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!conversationId,
  });
}

export function useInfiniteMessages(conversationId: string, limit: number = 50) {
  return useInfiniteQuery({
    queryKey: ['messages-infinite', conversationId],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getMessages(conversationId, limit, pageParam);
      if (error) throw new Error(error);
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.messages?.length || lastPage.messages.length < limit) {
        return undefined;
      }
      return lastPage.messages[0]?.created_at;
    },
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { content: string; message_type?: 'text' | 'image' | 'video' | 'file'; media_url?: string; reply_to_id?: string }) => {
      const { data: result, error } = await sendMessage(conversationId, data);
      if (error) throw new Error(error);
      return result;
    },
    onSuccess: (data) => {
      // Add message to cache
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return { messages: [data?.message], total: 1, limit: 50 };
        return {
          ...old,
          messages: [...old.messages, data?.message],
          total: old.total + 1,
        };
      });
      // Invalidate conversations to update last_message
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể gửi tin nhắn',
        variant: 'destructive',
      });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { data, error } = await editMessage(messageId, content);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể chỉnh sửa tin nhắn',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await deleteMessageById(messageId);
      if (error) throw new Error(error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa tin nhắn',
        variant: 'destructive',
      });
    },
  });
}
