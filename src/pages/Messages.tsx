import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, PenSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConversationList from '@/components/messages/ConversationList';
import { useConversations } from '@/hooks/useConversations';
import { useRealtimeConversations } from '@/hooks/useRealtimeMessages';
import { useAuth } from '@/contexts/AuthContext';
import type { Conversation } from '@/lib/api';

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useConversations();

  // Enable realtime updates
  useRealtimeConversations(user?.id || null);

  const handleSelectConversation = (conversation: Conversation) => {
    navigate(`/messages/${conversation.id}`);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Tin nhắn</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <PenSquare className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm tin nhắn..."
              className="pl-10 bg-muted border-0 rounded-full"
            />
          </div>
        </div>
      </header>

      {/* Conversations list */}
      <main className="pb-20">
        <ConversationList
          conversations={data?.conversations || []}
          isLoading={isLoading}
          onSelectConversation={handleSelectConversation}
        />
      </main>
    </div>
  );
};

export default Messages;
