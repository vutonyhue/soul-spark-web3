import React, { useRef, useState } from 'react';
import { Video, Loader2, X, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { uploadVideo } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VideoUploadProps {
  purpose: 'post' | 'story';
  onUploadComplete: (url: string) => void;
  className?: string;
  currentVideoUrl?: string;
  maxSizeMB?: number;
  variant?: 'button' | 'dropzone';
}

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_EXTENSIONS = '.mp4,.webm,.mov,.avi';

const VideoUpload: React.FC<VideoUploadProps> = ({
  purpose,
  onUploadComplete,
  className,
  currentVideoUrl,
  maxSizeMB = 100,
  variant = 'button',
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentVideoUrl);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      const errorMsg = `Video quá lớn. Tối đa ${maxSizeMB}MB`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      const errorMsg = 'Chỉ chấp nhận file video (MP4, WebM, MOV, AVI)';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload
    setUploading(true);
    setProgress(0);

    const { data, error: uploadError } = await uploadVideo(
      file,
      purpose,
      (p) => setProgress(p)
    );

    setUploading(false);

    if (uploadError) {
      setError(uploadError);
      toast.error('Upload thất bại: ' + uploadError);
      setPreviewUrl(currentVideoUrl);
      URL.revokeObjectURL(objectUrl);
      return;
    }

    if (data) {
      toast.success('Upload video thành công!');
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(data.publicUrl);
      onUploadComplete(data.publicUrl);
    }
  };

  const handleRemove = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(undefined);
    setError(null);
    setProgress(0);
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {previewUrl ? (
        <div className="relative">
          <video 
            src={previewUrl}
            controls
            className="rounded-lg max-h-60 w-full object-contain bg-black/5"
          />
          {!uploading && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
              <span className="text-white text-sm font-medium">{progress}%</span>
              <Progress value={progress} className="w-3/4 h-2" />
            </div>
          )}
        </div>
      ) : variant === 'dropzone' ? (
        <div
          onClick={triggerFileSelect}
          className={cn(
            "border-2 border-dashed rounded-lg p-6",
            "flex flex-col items-center justify-center gap-2 cursor-pointer",
            "transition-colors",
            error 
              ? "border-destructive/50 bg-destructive/5" 
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5",
            uploading && "opacity-50 pointer-events-none"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Đang tải lên... {progress}%</span>
              <Progress value={progress} className="w-full max-w-xs h-2" />
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-8 w-8 text-destructive" />
              <span className="text-sm text-destructive text-center">{error}</span>
              <span className="text-xs text-muted-foreground">Nhấn để thử lại</span>
            </>
          ) : (
            <>
              <Video className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Nhấn để chọn video
              </span>
              <span className="text-xs text-muted-foreground/60">
                MP4, WebM, MOV, AVI (tối đa {maxSizeMB}MB)
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={triggerFileSelect}
            disabled={uploading}
            size="sm"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Video className="h-4 w-4 mr-2" />
            )}
            {uploading ? `Đang tải... ${progress}%` : 'Chọn video'}
          </Button>
          {uploading && (
            <Progress value={progress} className="h-1" />
          )}
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUpload;