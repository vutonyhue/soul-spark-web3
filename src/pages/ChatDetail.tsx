import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Video, MoreVertical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MessageList from '@/components/messages/MessageList';
import MessageInput from '@/components/messages/MessageInput';
import { useMessages, useSendMessage, useDeleteMessage } from '@/hooks/useMessages';
import { useMarkAsRead, useConversations } from '@/hooks/useConversations';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { useAuth } from '@/contexts/AuthContext';
import type { Message, Conversation } from '@/lib/api';

const ChatDetail: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const { data: messagesData, isLoading: messagesLoading } = useMessages(conversationId || '');
  const { data: conversationsData } = useConversations();
  const sendMessageMutation = useSendMessage(conversationId || '');
  const deleteMessageMutation = useDeleteMessage();
  const markAsReadMutation = useMarkAsRead();

  // Find current conversation
  const conversation = conversationsData?.conversations.find(c => c.id === conversationId);

  // Enable realtime updates
  useRealtimeMessages(conversationId || null);

  // Mark as read when viewing
  useEffect(() => {
    if (conversationId && conversation?.unread_count && conversation.unread_count > 0) {
      markAsReadMutation.mutate(conversationId);
    }
  }, [conversationId, conversation?.unread_count]);

  // Get display info
  const otherParticipants = conversation?.participants.filter(p => p.id !== user?.id) || [];
  const displayName = conversation?.type === 'group'
    ? conversation.name || 'Nhóm chat'
    : otherParticipants[0]?.display_name || 'Đang tải...';
  const displayAvatar = conversation?.type === 'group'
    ? conversation.avatar_url
    : otherParticipants[0]?.avatar_url;

  const handleSend = (content: string) => {
    if (!conversationId) return;
    sendMessageMutation.mutate({ content });
  };

  const handleDeleteMessage = (message: Message) => {
    if (confirm('Bạn có chắc muốn xóa tin nhắn này?')) {
      deleteMessageMutation.mutate(message.id);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/messages')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={displayAvatar || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-sm">{displayName}</h1>
                <p className="text-xs text-muted-foreground">
                  {conversation?.type === 'group' 
                    ? `${conversation.participants.length} thành viên`
                    : 'Đang hoạt động'
                  }
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon">
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Video className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Thông tin</DropdownMenuItem>
                <DropdownMenuItem>Tìm kiếm tin nhắn</DropdownMenuItem>
                <DropdownMenuItem>Tắt thông báo</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  Xóa cuộc trò chuyện
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Messages */}
      <MessageList
        messages={messagesData?.messages || []}
        isLoading={messagesLoading}
        onDelete={handleDeleteMessage}
      />

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        isLoading={sendMessageMutation.isPending}
      />
    </div>
  );
};

export default ChatDetail;
