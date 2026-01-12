import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  Volume1, 
  VolumeX, 
  Maximize2, 
  Minimize2 
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  onError?: () => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  className,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Reset hide controls timer
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    setShowControls(true);
    
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    resetHideTimer();
  }, [isPlaying, resetHideTimer]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // Handle seek
  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, [isFullscreen]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
    };
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };
    const handleError = () => onError?.();

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('error', handleError);
    };
  }, [onError]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this video player is focused or in fullscreen
      if (!containerRef.current?.contains(document.activeElement) && !isFullscreen) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'arrowleft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          resetHideTimer();
          break;
        case 'arrowright':
          e.preventDefault();
          video.currentTime = Math.min(duration, video.currentTime + 5);
          resetHideTimer();
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange([Math.min(1, volume + 0.1)]);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange([Math.max(0, volume - 0.1)]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, duration, volume, handleVolumeChange, resetHideTimer, isFullscreen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative group bg-black overflow-hidden',
        isFullscreen ? 'fixed inset-0 z-50' : 'rounded-lg',
        className
      )}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain"
        onClick={togglePlay}
      />

      {/* Center Play Button (when paused) */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-primary/80 hover:scale-110 transition-all">
            <Play className="h-8 w-8 text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-2 px-3 transition-opacity duration-300',
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Progress Bar */}
        <div className="relative w-full h-1.5 mb-3 group/progress cursor-pointer hover:h-2 transition-all">
          {/* Buffered Progress */}
          <div
            className="absolute inset-0 bg-white/30 rounded-full"
          >
            <div
              className="h-full bg-white/50 rounded-full transition-all"
              style={{ width: `${buffered}%` }}
            />
          </div>
          
          {/* Seekable Slider */}
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="absolute inset-0 [&>span:first-child]:h-full [&>span:first-child]:bg-transparent [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:opacity-0 group-hover/progress:[&_[role=slider]]:opacity-100 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:bg-primary [&>span:first-child>span]:bg-primary"
          />
          
          {/* Played Progress (visual overlay) */}
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Controls Bar */}
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-primary transition-colors p-1"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play className="h-5 w-5" fill="currentColor" />
            )}
          </button>

          {/* Volume Control */}
          <div 
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={toggleMute}
              className="text-white hover:text-primary transition-colors p-1"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              <VolumeIcon className="h-5 w-5" />
            </button>
            
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                showVolumeSlider ? 'w-20 opacity-100 ml-1' : 'w-0 opacity-0'
              )}
            >
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-full [&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:bg-primary [&>span:first-child>span]:bg-white"
              />
            </div>
          </div>

          {/* Time Display */}
          <span className="text-xs text-white/90 font-medium tabular-nums ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-primary transition-colors p-1"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
