-- Add foreign key constraint from posts.user_id to profiles.id
-- This enables PostgREST to join posts with profiles for author info
ALTER TABLE posts
ADD CONSTRAINT fk_posts_user_id 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;