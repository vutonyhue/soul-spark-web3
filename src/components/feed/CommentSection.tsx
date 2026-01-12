import React, { useState, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Comment, getComments, createComment } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CommentItem from './CommentItem';

interface CommentSectionProps {
  postId: string;
  commentsCount: number;
  onCommentsCountChange?: (newCount: number) => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  commentsCount,
  onCommentsCountChange,
}) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [total, setTotal] = useState(commentsCount);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const fetchComments = useCallback(async (reset = false) => {
    setIsLoading(true);
    const currentOffset = reset ? 0 : offset;
    const { data, error } = await getComments(postId, limit, currentOffset);
    
    if (error) {
      console.error('Failed to fetch comments:', error);
    } else if (data) {
      if (reset) {
        setComments(data.comments);
        setOffset(limit);
      } else {
        setComments(prev => [...prev, ...data.comments]);
        setOffset(currentOffset + limit);
      }
      setTotal(data.total);
      setHasMore(data.comments.length === limit && (currentOffset + limit) < data.total);
    }
    setIsLoading(false);
  }, [postId, offset]);

  useEffect(() => {
    fetchComments(true);
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Vui lòng đăng nhập để bình luận');
      return;
    }

    if (!newComment.trim()) return;

    setIsSubmitting(true);
    const { data, error } = await createComment(postId, newComment.trim());
    
    if (error) {
      toast.error('Không thể gửi bình luận: ' + error);
    } else if (data) {
      setComments(prev => [...prev, data.comment]);
      setNewComment('');
      setTotal(prev => prev + 1);
      onCommentsCountChange?.(total + 1);
    }
    setIsSubmitting(false);
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    setTotal(prev => prev - 1);
    onCommentsCountChange?.(total - 1);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchComments(false);
    }
  };

  return (
    <div className="border-t border-border pt-3 mt-2">
      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={profile?.avatar_url || '/placeholder.svg'} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {profile?.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex gap-2">
            <Textarea
              placeholder="Viết bình luận..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[40px] max-h-[120px] resize-none py-2"
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={isSubmitting || !newComment.trim()}
              className="flex-shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground text-center mb-4">
          Đăng nhập để bình luận
        </p>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={user?.id}
            onDelete={handleDeleteComment}
          />
        ))}

        {isLoading && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {hasMore && !isLoading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadMore}
            className="w-full text-muted-foreground"
          >
            Xem thêm bình luận
          </Button>
        )}

        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Chưa có bình luận nào
          </p>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
