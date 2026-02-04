import React from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Check, CheckCheck, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Message } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showAvatar = true,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const isOwn = message.sender_id === user?.id;
  const senderName = message.sender?.display_name || 'Người dùng';
  const senderAvatar = message.sender?.avatar_url;

  // Format time
  const formattedTime = format(new Date(message.created_at), 'HH:mm', { locale: vi });

  if (message.is_deleted) {
    return (
      <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {showAvatar && !isOwn && (
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={senderAvatar || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {senderName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
          <div className="px-4 py-2 rounded-2xl bg-muted/50 text-muted-foreground italic text-sm">
            Tin nhắn đã bị xóa
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {showAvatar && !isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={senderAvatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {senderName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      {!showAvatar && !isOwn && <div className="w-8" />}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* Message content */}
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md'
          }`}
        >
          {/* Media preview */}
          {message.media_url && message.message_type === 'image' && (
            <img
              src={message.media_url}
              alt="Hình ảnh"
              className="max-w-full rounded-lg mb-2"
            />
          )}
          {message.media_url && message.message_type === 'video' && (
            <video
              src={message.media_url}
              controls
              className="max-w-full rounded-lg mb-2"
            />
          )}
          
          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {/* Metadata row */}
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-muted-foreground">{formattedTime}</span>
          {message.is_edited && (
            <span className="text-[10px] text-muted-foreground">(đã chỉnh sửa)</span>
          )}
          {isOwn && (
            <CheckCheck className="h-3 w-3 text-primary" />
          )}
        </div>
      </div>

      {/* Actions menu - only for own messages */}
      {isOwn && (onEdit || onDelete) && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(message)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Chỉnh sửa
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(message)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Xóa
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
