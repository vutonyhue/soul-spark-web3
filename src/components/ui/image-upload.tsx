import React, { useRef, useState } from 'react';
import { Image, Loader2, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadMedia } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  purpose: 'avatar' | 'post';
  onUploadComplete: (url: string) => void;
  className?: string;
  currentImageUrl?: string;
  maxSizeMB?: number;
  variant?: 'button' | 'dropzone';
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  purpose,
  onUploadComplete,
  className,
  currentImageUrl,
  maxSizeMB = 5,
  variant = 'button',
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File quá lớn. Tối đa ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    const { data, error } = await uploadMedia(file, purpose);
    setUploading(false);

    if (error) {
      toast.error('Upload thất bại: ' + error);
      setPreviewUrl(currentImageUrl);
      return;
    }

    if (data) {
      toast.success('Upload thành công!');
      setPreviewUrl(data.publicUrl);
      onUploadComplete(data.publicUrl);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(undefined);
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {previewUrl ? (
        <div className="relative inline-block">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className={cn(
              "object-cover rounded-lg",
              purpose === 'avatar' ? "w-24 h-24" : "max-h-60 w-auto"
            )}
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : variant === 'dropzone' ? (
        <div
          onClick={triggerFileSelect}
          className={cn(
            "border-2 border-dashed border-muted-foreground/25 rounded-lg p-6",
            "flex flex-col items-center justify-center gap-2 cursor-pointer",
            "hover:border-primary/50 hover:bg-primary/5 transition-colors",
            uploading && "opacity-50 pointer-events-none"
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading ? 'Đang tải lên...' : 'Nhấn để chọn ảnh'}
          </span>
          <span className="text-xs text-muted-foreground/60">
            JPEG, PNG, GIF, WebP (tối đa {maxSizeMB}MB)
          </span>
        </div>
      ) : (
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
            <Image className="h-4 w-4 mr-2" />
          )}
          {uploading ? 'Đang tải...' : 'Chọn ảnh'}
        </Button>
      )}
    </div>
  );
};

export default ImageUpload;
