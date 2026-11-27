import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { parseVideoSource, resolveChunkedVideoBlobUrl } from '../services/storageService';

interface SmartVideoPlayerProps {
  videoUrl: string;
  title: string;
  compact?: boolean;
  inAppOnly?: boolean;
  enforceNoSeek?: boolean;
  loopUntilComplete?: boolean;
  trackWatchCompletion?: boolean;
  requiredWatchSeconds?: number;
  requiredEmbedWatchSeconds?: number;
  onPlayingStateChange?: (isPlaying: boolean) => void;
  onSeekBlocked?: () => void;
  onWatchCompleteReady?: () => void;
}

export function SmartVideoPlayer({
  videoUrl,
  title,
  compact = false,
  inAppOnly = false,
  enforceNoSeek = false,
  loopUntilComplete = false,
  trackWatchCompletion = false,
  requiredWatchSeconds,
  requiredEmbedWatchSeconds = 15,
  onPlayingStateChange,
  onSeekBlocked,
  onWatchCompleteReady,
}: SmartVideoPlayerProps) {
  const effectiveRequiredSec = Math.max(
    5,
    Math.round(requiredWatchSeconds ?? requiredEmbedWatchSeconds ?? 15),
  );
  const parsed = useMemo(() => parseVideoSource(videoUrl), [videoUrl]);

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [watchPercent, setWatchPercent] = useState(0);
  const [embedElapsed, setEmbedElapsed] = useState(0);
  const [embedPlaying, setEmbedPlaying] = useState(false);

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const maxWatchedTimeRef = useRef(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onWatchCompleteReady);
  onCompleteRef.current = onWatchCompleteReady;
  const onPlayingRef = useRef(onPlayingStateChange);
  onPlayingRef.current = onPlayingStateChange;
  const onSeekBlockedRef = useRef(onSeekBlocked);
  onSeekBlockedRef.current = onSeekBlocked;

  const markCompleted = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setWatchPercent(100);
    onCompleteRef.current?.();
  };

  useEffect(() => {
    completedRef.current = false;
    maxWatchedTimeRef.current = 0;
    setErrorMsg(null);
    setBuffering(false);
    setWatchPercent(0);
    setEmbedElapsed(0);
    setEmbedPlaying(false);
    onPlayingRef.current?.(false);

    if (parsed.kind === 'direct') {
      setResolvedSrc(parsed.src);
      setLoading(false);
      return;
    }

    if (parsed.kind !== 'chunked') {
      setResolvedSrc(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setResolvedSrc(null);

    void resolveChunkedVideoBlobUrl(parsed.videoId)
      .then((res) => {
        if (cancelled) return;
        setResolvedSrc(res.url);
        setErrorMsg(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load uploaded video stream.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      onPlayingRef.current?.(false);
    };
  }, [parsed, retryTick]);

  // YouTube iframe postMessage listener for true active playback vs paused state
  useEffect(() => {
    if (parsed.kind !== 'youtube') return;

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !event.origin.includes('youtube')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || typeof data !== 'object') return;
        const info = (data as { info?: unknown }).info;
        const playerState =
          typeof info === 'number'
            ? info
            : typeof info === 'object' && info !== null
              ? (info as { playerState?: number }).playerState
              : undefined;

        if (playerState === 1) {
          setEmbedPlaying(true);
          onPlayingRef.current?.(true);
        } else if (playerState === 2 || playerState === 3 || playerState === -1 || playerState === 0) {
          if (playerState === 0 && !loopUntilComplete && trackWatchCompletion) {
            markCompleted();
          }
          setEmbedPlaying(false);
          onPlayingRef.current?.(false);
        }
      } catch {
        // Ignore unrelated cross-window messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [parsed.kind, trackWatchCompletion, loopUntilComplete]);

  // Built-in embed countdown when trackWatchCompletion is used standalone (outside modal)
  useEffect(() => {
    if (!trackWatchCompletion || onPlayingStateChange) return;
    if (parsed.kind !== 'youtube' && parsed.kind !== 'vimeo' && parsed.kind !== 'gdrive') return;
    if (!embedPlaying || completedRef.current) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setEmbedElapsed((prev) => {
        const next = prev + 1;
        if (next >= effectiveRequiredSec) {
          markCompleted();
          return effectiveRequiredSec;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [embedPlaying, parsed.kind, effectiveRequiredSec, trackWatchCompletion, onPlayingStateChange]);

  const heightClass = compact ? 'max-h-48' : 'max-h-[380px]';

  if (parsed.kind === 'youtube' || parsed.kind === 'vimeo' || parsed.kind === 'gdrive') {
    const remaining = Math.max(0, effectiveRequiredSec - embedElapsed);
    const pct = Math.min(100, Math.round((embedElapsed / effectiveRequiredSec) * 100));

    return (
      <div className="space-y-2">
        <div
          className={`relative w-full aspect-video ${compact ? 'max-h-52' : 'max-h-[380px]'} bg-slate-950 rounded-xl overflow-hidden border border-slate-800`}
        >
          <iframe
            key={`${parsed.embedUrl}-${retryTick}`}
            src={parsed.embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={(e) => {
              if (parsed.kind === 'youtube') {
                try {
                  e.currentTarget.contentWindow?.postMessage(
                    JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
                    '*',
                  );
                } catch {
                  // ignore
                }
              }
              if (parsed.kind !== 'youtube' && (trackWatchCompletion || onPlayingStateChange)) {
                setEmbedPlaying(true);
                onPlayingRef.current?.(true);
              }
            }}
            className="w-full h-full border-0"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          {trackWatchCompletion && !onPlayingStateChange ? (
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${completedRef.current ? 100 : pct}%` }}
                />
              </div>
              <span className="font-mono tabular-nums shrink-0">
                {completedRef.current || remaining === 0
                  ? 'Watch verified'
                  : embedPlaying
                    ? `Playing (${remaining}s left)`
                    : 'Tap Play inside video'}
              </span>
            </div>
          ) : (
            <span className="font-mono text-slate-500">
              {parsed.kind === 'youtube'
                ? 'In-App YouTube Player'
                : parsed.kind === 'vimeo'
                  ? 'In-App Vimeo Player'
                  : 'In-App Google Drive Player'}
            </span>
          )}
          {!inAppOnly && (
            <a
              href={parsed.watchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-800 hover:underline font-medium shrink-0"
            >
              <span>Source Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[180px] flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-slate-200 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Loading persistent video stream…</span>
          </div>
        )}

        {!loading && buffering && !errorMsg && (
          <div className="pointer-events-none absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/85 text-white text-[11px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Buffering…</span>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="p-5 text-center space-y-2.5 text-slate-200">
            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-xs leading-relaxed max-w-sm">{errorMsg}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRetryTick((t) => t + 1)}
                className="h-8 px-3 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Video</span>
              </button>
              {!inAppOnly && parsed.kind === 'direct' && /^https?:\/\//i.test(parsed.src) && (
                <a
                  href={parsed.src}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Link</span>
                </a>
              )}
            </div>
          </div>
        )}

        {!loading && !errorMsg && resolvedSrc && (
          <video
            ref={videoElRef}
            key={`${resolvedSrc}-${retryTick}`}
            src={resolvedSrc}
            controls
            playsInline
            controlsList="nodownload noplaybackrate"
            loop={loopUntilComplete}
            preload="auto"
            onLoadedData={() => {
              setErrorMsg(null);
              setBuffering(false);
            }}
            onWaiting={() => {
              setBuffering(true);
              onPlayingRef.current?.(false);
            }}
            onCanPlay={() => setBuffering(false)}
            onPlay={() => {
              setBuffering(false);
              onPlayingRef.current?.(true);
            }}
            onPlaying={() => {
              setBuffering(false);
              onPlayingRef.current?.(true);
            }}
            onPause={() => {
              onPlayingRef.current?.(false);
            }}
            onSeeking={(e) => {
              if (!enforceNoSeek) return;
              const v = e.currentTarget;
              if (v.currentTime > maxWatchedTimeRef.current + 1.5) {
                v.currentTime = maxWatchedTimeRef.current;
                onSeekBlockedRef.current?.();
              }
            }}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.currentTime <= maxWatchedTimeRef.current + 2.0) {
                maxWatchedTimeRef.current = Math.max(maxWatchedTimeRef.current, v.currentTime);
              } else if (enforceNoSeek) {
                v.currentTime = maxWatchedTimeRef.current;
                onSeekBlockedRef.current?.();
                return;
              }

              if (!trackWatchCompletion || onPlayingStateChange) return;
              if (Number.isFinite(v.duration) && v.duration > 0) {
                const pct = Math.min(100, Math.round((v.currentTime / v.duration) * 100));
                setWatchPercent(pct);
                if (v.currentTime >= v.duration - 0.6) {
                  markCompleted();
                }
              }
            }}
            onEnded={() => {
              if (loopUntilComplete && videoElRef.current) {
                maxWatchedTimeRef.current = 0;
                videoElRef.current.currentTime = 0;
                void videoElRef.current.play().catch(() => {
                  onPlayingRef.current?.(false);
                });
                return;
              }
              onPlayingRef.current?.(false);
              if (trackWatchCompletion && !onPlayingStateChange) markCompleted();
            }}
            onError={() => {
              setBuffering(false);
              onPlayingRef.current?.(false);
              setErrorMsg(
                'This video could not be played in your browser (unsupported codec or blocked external URL). Tap Retry Video or check your connection.',
              );
            }}
            className={`w-full ${heightClass} bg-black`}
          />
        )}
      </div>

      {trackWatchCompletion && !onPlayingStateChange && !errorMsg && (
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-200"
              style={{ width: `${completedRef.current ? 100 : watchPercent}%` }}
            />
          </div>
          <span className="font-mono tabular-nums shrink-0">
            {completedRef.current ? '100% watched' : `${watchPercent}% watched`}
          </span>
        </div>
      )}
    </div>
  );
}

