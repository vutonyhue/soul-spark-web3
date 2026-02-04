import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Conversation } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
  onClick: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive = false,
  onClick,
}) => {
  const { user } = useAuth();
  
  // Get display info - for direct chats, show the other person
  const otherParticipants = conversation.participants.filter(p => p.id !== user?.id);
  const displayName = conversation.type === 'group' 
    ? conversation.name || 'Nhóm chat'
    : otherParticipants[0]?.display_name || 'Người dùng';
  const displayAvatar = conversation.type === 'group'
    ? conversation.avatar_url
    : otherParticipants[0]?.avatar_url;
  const avatarFallback = displayName.charAt(0).toUpperCase();

  // Format time
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { 
        addSuffix: false, 
        locale: vi 
      })
    : '';

  // Last message preview
  const lastMessagePreview = conversation.last_message?.is_deleted
    ? 'Tin nhắn đã bị xóa'
    : conversation.last_message?.content || '';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors rounded-lg ${
        isActive 
          ? 'bg-primary/10 border-l-2 border-primary' 
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={displayAvatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
        {conversation.type === 'group' && (
          <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-secondary rounded-full flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">
              {conversation.participants.length}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate ${conversation.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {timeAgo}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-sm truncate ${conversation.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {lastMessagePreview || 'Bắt đầu cuộc trò chuyện'}
          </p>
          {conversation.unread_count > 0 && (
            <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center text-xs rounded-full">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationItem;
