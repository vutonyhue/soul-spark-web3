-- Tạo bảng posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  coin_reward INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index cho query nhanh
CREATE INDEX posts_user_id_idx ON public.posts(user_id);
CREATE INDEX posts_created_at_idx ON public.posts(created_at DESC);

-- Trigger cập nhật updated_at
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Ai cũng có thể xem posts
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (true);

-- User chỉ có thể insert post của mình
CREATE POLICY "Users can insert their own posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User chỉ có thể update post của mình
CREATE POLICY "Users can update their own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id);

-- User chỉ có thể delete post của mình
CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);