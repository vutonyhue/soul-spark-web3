import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
import { Comment, deleteComment } from '@/lib/api';
import { toast } from 'sonner';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const authorName = comment.author?.display_name || 'Người dùng';
  const avatarUrl = comment.author?.avatar_url || '/placeholder.svg';

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const { error } = await deleteComment(comment.id);
    
    if (error) {
      toast.error('Không thể xóa bình luận: ' + error);
    } else {
      toast.success('Đã xóa bình luận');
      onDelete?.(comment.id);
    }
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="flex gap-2 group">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {authorName[0]}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-2xl px-3 py-2 inline-block max-w-full">
            <p className="font-semibold text-sm">{authorName}</p>
            <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-3">
            <span className="text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setShowDeleteDialog(true)}
              >
                Xóa
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bình luận?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa bình luận này?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
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

export default CommentItem;
