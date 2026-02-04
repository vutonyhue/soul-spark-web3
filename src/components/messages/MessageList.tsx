import React, { useRef, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import type { Message } from '@/lib/api';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onEdit,
  onDelete,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <h3 className="font-medium text-foreground mb-1">
          Bắt đầu cuộc trò chuyện
        </h3>
        <p className="text-sm text-muted-foreground">
          Gửi tin nhắn đầu tiên để bắt đầu!
        </p>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';

  messages.forEach((message) => {
    const messageDate = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({
        date: messageDate,
        messages: [message],
      });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message);
    }
  });

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
    >
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-muted px-3 py-1 rounded-full">
              <span className="text-xs text-muted-foreground">
                {isSameDay(new Date(group.date), new Date())
                  ? 'Hôm nay'
                  : format(new Date(group.date), 'dd MMMM, yyyy', { locale: vi })}
              </span>
            </div>
          </div>

          {/* Messages for this date */}
          <div className="space-y-2">
            {group.messages.map((message, index) => {
              // Show avatar if this is first message or different sender
              const prevMessage = index > 0 ? group.messages[index - 1] : null;
              const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showAvatar={showAvatar}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
