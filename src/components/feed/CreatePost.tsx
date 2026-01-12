import React, { useState } from 'react';
import { Image, Video, Smile, MapPin, Send, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { createPost, Post } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreatePostProps {
  onPostCreated?: (post: Post) => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onPostCreated }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, profile } = useAuth();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    if (!user) {
      toast.error('Vui lòng đăng nhập để đăng bài');
      return;
    }

    setSubmitting(true);
    
    const { data, error } = await createPost({ content: content.trim() });
    
    if (error) {
      toast.error('Không thể đăng bài: ' + error);
    } else if (data) {
      toast.success('Đã đăng bài thành công!');
      setContent('');
      onPostCreated?.(data.post);
    }
    
    setSubmitting(false);
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'U';
  const avatarUrl = profile?.avatar_url;

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={avatarUrl || '/placeholder.svg'} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder={user ? "Bạn đang nghĩ gì?" : "Đăng nhập để đăng bài..."}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!user || submitting}
              className="min-h-[80px] resize-none border-0 bg-secondary focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" disabled={!user}>
              <Image className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Ảnh</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-accent hover:bg-accent/10" disabled={!user}>
              <Video className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Video</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-warning hover:bg-warning/10" disabled={!user}>
              <Smile className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Cảm xúc</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={!user}>
              <MapPin className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Vị trí</span>
            </Button>
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={!content.trim() || !user || submitting}
            className="gradient-chakra hover:opacity-90 text-primary-foreground"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Đăng
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreatePost;
