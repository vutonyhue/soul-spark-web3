import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConversations, createConversation, markConversationAsRead, Conversation } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useConversations(limit: number = 20, offset: number = 0) {
  return useQuery({
    queryKey: ['conversations', limit, offset],
    queryFn: async () => {
      const { data, error } = await getConversations(limit, offset);
      if (error) throw new Error(error);
      return data;
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { participant_ids: string[]; type?: 'direct' | 'group'; name?: string }) => {
      const { data: result, error } = await createConversation(data);
      if (error) throw new Error(error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tạo cuộc hội thoại',
        variant: 'destructive',
      });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await markConversationAsRead(conversationId);
      if (error) throw new Error(error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
