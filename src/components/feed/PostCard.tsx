import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface PostCardProps {
  author: {
    name: string;
    avatar?: string;
    verified?: boolean;
  };
  content: string;
  image?: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  coinReward?: number;
}

const PostCard: React.FC<PostCardProps> = ({
  author,
  content,
  image,
  timestamp,
  likes,
  comments,
  shares,
  coinReward,
}) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  return (
    <Card className="mb-4 overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
          <AvatarImage src={author.avatar || '/placeholder.svg'} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {author.name[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold hover:underline cursor-pointer">{author.name}</span>
            {author.verified && (
              <Badge variant="secondary" className="bg-primary/10 text-primary text-xs px-1.5">
                ✓
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{timestamp}</p>
        </div>
        
        {coinReward && (
          <Badge className="gradient-chakra text-primary-foreground gap-1">
            <Coins className="h-3 w-3" />
            +{coinReward} CAMLY
          </Badge>
        )}
        
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </CardHeader>
      
      <CardContent className="pb-3">
        <p className="mb-3 whitespace-pre-wrap">{content}</p>
        
        {image && (
          <div className="relative -mx-6 mb-3">
            <img 
              src={image} 
              alt="Post content" 
              className="w-full object-cover max-h-[500px]"
            />
          </div>
        )}
        
        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground py-2 border-b border-border">
          <div className="flex items-center gap-1">
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Heart className="h-3 w-3 text-primary-foreground fill-current" />
            </div>
            <span>{likeCount.toLocaleString()}</span>
          </div>
          <div className="flex gap-4">
            <span>{comments} bình luận</span>
            <span>{shares} chia sẻ</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-between pt-1">
          <Button
            variant="ghost"
            className={`flex-1 gap-2 ${liked ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={handleLike}
          >
            <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
            Thích
          </Button>
          <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            Bình luận
          </Button>
          <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground">
            <Share2 className="h-5 w-5" />
            Chia sẻ
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={saved ? 'text-primary' : 'text-muted-foreground'}
            onClick={() => setSaved(!saved)}
          >
            <Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostCard;
