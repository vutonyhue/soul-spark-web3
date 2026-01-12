import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import CreatePost from './CreatePost';
import PostCard from './PostCard';
import { getPosts, Post } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Feed: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: apiError } = await getPosts(20, 0);
    
    if (apiError) {
      setError(apiError);
      toast.error('Không thể tải bài viết');
    } else if (data) {
      setPosts(data.posts);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} phút trước`;
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    } else if (diffDays < 7) {
      return `${diffDays} ngày trước`;
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto">
        <CreatePost onPostCreated={handlePostCreated} />
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto">
        <CreatePost onPostCreated={handlePostCreated} />
        <div className="text-center py-8 text-muted-foreground">
          <p>Đã xảy ra lỗi khi tải bài viết</p>
          <button 
            onClick={fetchPosts}
            className="mt-2 text-primary hover:underline"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <CreatePost onPostCreated={handlePostCreated} />
      
      {posts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Chưa có bài viết nào</p>
          <p className="text-sm mt-1">Hãy là người đầu tiên đăng bài!</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            postId={post.id}
            userId={post.user_id}
            currentUserId={user?.id}
            author={{
              name: post.author?.display_name || 'Người dùng',
              avatar: post.author?.avatar_url || undefined,
              verified: false,
            }}
            content={post.content}
            image={post.image_url || undefined}
            videoUrl={post.video_url || undefined}
            mediaType={(post.media_type as 'image' | 'video' | 'none') || undefined}
            timestamp={formatTimestamp(post.created_at)}
            likes={post.likes_count}
            comments={post.comments_count}
            shares={post.shares_count}
            coinReward={post.coin_reward > 0 ? post.coin_reward : undefined}
            onUpdate={handlePostUpdated}
            onDelete={handlePostDeleted}
          />
        ))
      )}
    </div>
  );
};

export default Feed;
