import React, { useState } from 'react';
import { Image, Video, Smile, MapPin, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';

const CreatePost: React.FC = () => {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      console.log('Post submitted:', content);
      setContent('');
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src="/placeholder.svg" />
            <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="Bạn đang nghĩ gì?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none border-0 bg-secondary focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
              <Image className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Ảnh</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-accent hover:bg-accent/10">
              <Video className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Video</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-warning hover:bg-warning/10">
              <Smile className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Cảm xúc</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
              <MapPin className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Vị trí</span>
            </Button>
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="gradient-chakra hover:opacity-90 text-primary-foreground"
          >
            <Send className="h-4 w-4 mr-1" />
            Đăng
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreatePost;
