-- Fix existing posts where video URLs were incorrectly stored in image_url
UPDATE posts 
SET 
  video_url = image_url,
  media_type = 'video',
  image_url = NULL
WHERE 
  image_url LIKE '%.mp4' 
  OR image_url LIKE '%.mov' 
  OR image_url LIKE '%.webm'
  OR image_url LIKE '%.MOV';