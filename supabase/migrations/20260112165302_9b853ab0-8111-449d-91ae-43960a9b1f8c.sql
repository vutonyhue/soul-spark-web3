-- Normalize video URLs: fix double slash issue
UPDATE posts 
SET video_url = REPLACE(video_url, 'https://funprofile-media.funecosystem.org//', 'https://funprofile-media.funecosystem.org/')
WHERE video_url LIKE '%funprofile-media.funecosystem.org//%';