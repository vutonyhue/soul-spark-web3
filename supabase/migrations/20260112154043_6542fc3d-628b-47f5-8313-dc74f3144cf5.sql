-- Add video support to posts table
-- Add media_type column to track whether post contains image, video, or no media
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'none' 
  CHECK (media_type IN ('none', 'image', 'video'));

-- Update existing posts to set media_type based on current data
UPDATE public.posts SET media_type = 
  CASE 
    WHEN image_url IS NOT NULL AND image_url != '' THEN 'image'
    ELSE 'none'
  END
WHERE media_type IS NULL OR media_type = 'none';

-- Add index for filtering by media type
CREATE INDEX IF NOT EXISTS idx_posts_media_type ON public.posts(media_type);