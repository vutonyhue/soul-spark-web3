import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Coins, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { updatePost, deletePost, likePost, unlikePost, getLikeStatus, Post } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CommentSection from './CommentSection';

interface PostCardProps {
  postId: string;
  userId: string;
  currentUserId?: string;
  author: {
    name: string;
    avatar?: string;
    verified?: boolean;
  };
  content: string;
  image?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video' | 'none';
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  coinReward?: number;
  onUpdate?: (post: Post) => void;
  onDelete?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  postId,
  userId,
  currentUserId,
  author,
  content,
  image,
  videoUrl,
  mediaType,
  timestamp,
  likes,
  comments,
  shares,
  coinReward,
  onUpdate,
  onDelete,
}) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);
  const [commentsCount, setCommentsCount] = useState(comments);
  const [showComments, setShowComments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isOwner = currentUserId === userId;

  // Fetch like status on mount if user is logged in
  useEffect(() => {
    if (user) {
      getLikeStatus(postId).then(({ data }) => {
        if (data) {
          setLiked(data.liked);
        }
      });
    }
  }, [postId, user]);

  const handleLike = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để thích bài viết');
      return;
    }

    if (isLiking) return;

    setIsLiking(true);
    
    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? likeCount - 1 : likeCount + 1);

    const { error } = wasLiked 
      ? await unlikePost(postId)
      : await likePost(postId);
    
    if (error) {
      // Revert on error
      setLiked(wasLiked);
      setLikeCount(wasLiked ? likeCount : likeCount - 1);
      toast.error('Không thể thực hiện: ' + error);
    }
    
    setIsLiking(false);
  };

  const handleEdit = () => {
    setEditContent(content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      toast.error('Nội dung không được để trống');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await updatePost(postId, { content: editContent.trim() });
    
    if (error) {
      toast.error('Không thể cập nhật: ' + error);
    } else if (data) {
      toast.success('Đã cập nhật bài viết');
      setIsEditing(false);
      onUpdate?.(data.post);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    const { error } = await deletePost(postId);
    
    if (error) {
      toast.error('Không thể xóa: ' + error);
    } else {
      toast.success('Đã xóa bài viết');
      onDelete?.(postId);
    }
    setIsSubmitting(false);
    setShowDeleteDialog(false);
  };

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  return (
    <>
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Chỉnh sửa
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Xóa bài viết
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem>
                Báo cáo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        
        <CardContent className="pb-3">
          {isEditing ? (
            <div className="mb-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[100px] mb-2"
                disabled={isSubmitting}
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  Hủy
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveEdit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Lưu
                </Button>
              </div>
            </div>
          ) : (
            <p className="mb-3 whitespace-pre-wrap">{content}</p>
          )}
          
          {/* Media Section - Video or Image */}
          {mediaType === 'video' && videoUrl && (
            <div className="relative -mx-6 mb-3">
              {videoError ? (
                <div className="w-full h-[300px] bg-muted flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <p className="text-sm font-medium">Không thể phát video</p>
                  <p className="text-xs text-center px-4">
                    Video có thể sử dụng codec không được hỗ trợ (HEVC/H.265).<br/>
                    Thử xuất video ở định dạng MP4 H.264/AAC.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(videoUrl, '_blank')}
                  >
                    Mở video trong tab mới
                  </Button>
                </div>
              ) : (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-[500px] bg-black object-contain"
                  poster={image || undefined}
                  onError={(e) => {
                    console.error('Video load error:', e, videoUrl);
                    setVideoError(true);
                  }}
                  onLoadedMetadata={() => {
                    setVideoError(false);
                  }}
                >
                  Trình duyệt của bạn không hỗ trợ video.
                </video>
              )}
            </div>
          )}

          {mediaType === 'image' && image && (
            <div className="relative -mx-6 mb-3">
              <img 
                src={image} 
                alt="Post content" 
                className="w-full object-cover max-h-[500px]"
              />
            </div>
          )}

          {/* Fallback for posts without mediaType (backward compatibility) */}
          {(!mediaType || mediaType === 'none') && image && (
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
              <button 
                className="hover:underline cursor-pointer"
                onClick={toggleComments}
              >
                {commentsCount} bình luận
              </button>
              <span>{shares} chia sẻ</span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-between pt-1">
            <Button
              variant="ghost"
              className={`flex-1 gap-2 ${liked ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={handleLike}
              disabled={isLiking}
            >
              <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
              Thích
            </Button>
            <Button 
              variant="ghost" 
              className={`flex-1 gap-2 ${showComments ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={toggleComments}
            >
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

          {/* Comments Section */}
          {showComments && (
            <CommentSection 
              postId={postId}
              commentsCount={commentsCount}
              onCommentsCountChange={setCommentsCount}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bài viết?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PostCard;
