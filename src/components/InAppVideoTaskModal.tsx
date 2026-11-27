import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  PauseCircle,
  ShieldCheck,
} from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { SmartVideoPlayer } from './SmartVideoPlayer';

interface InAppVideoTaskModalProps {
  isOpen: boolean;
  uid: string;
  targetType: 'video' | 'task';
  targetId: string;
  title: string;
  subtitle?: string;
  videoUrl: string;
  requiredWatchSeconds: number;
  getAuthToken: () => Promise<string | null>;
  onVerifiedComplete: (payload: {
    targetId: string;
    verificationSignature: string;
  }) => void;
  onClose: () => void;
}

export function InAppVideoTaskModal({
  isOpen,
  uid,
  targetType,
  targetId,
  title,
  subtitle,
  videoUrl,
  requiredWatchSeconds,
  getAuthToken,
  onVerifiedComplete,
  onClose,
}: InAppVideoTaskModalProps) {
  const safeReqSec = Math.max(5, Math.min(600, Math.round(requiredWatchSeconds || 15)));

  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [seekWarning, setSeekWarning] = useState(false);
  const [verifyingCompletion, setVerifyingCompletion] = useState(false);
  const [completedBanner, setCompletedBanner] = useState(false);

  const sessionRef = useRef<{
    sessionId: string;
    sessionToken: string;
    requiredSeconds: number;
  } | null>(null);
  const lastFirestoreSyncRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isVisibleRef = useRef(true);
  const finishedRef = useRef(false);
  const getAuthTokenRef = useRef(getAuthToken);
  const onVerifiedCompleteRef = useRef(onVerifiedComplete);
  const onCloseRef = useRef(onClose);

  isPlayingRef.current = isPlaying;
  isVisibleRef.current = isTabVisible;
  getAuthTokenRef.current = getAuthToken;
  onVerifiedCompleteRef.current = onVerifiedComplete;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    finishedRef.current = false;
    sessionRef.current = null;
    lastFirestoreSyncRef.current = 0;

    setInitializing(true);
    setInitError(null);
    setWatchedSeconds(0);
    setSeekWarning(false);
    setVerifyingCompletion(false);
    setCompletedBanner(false);
    setIsPlaying(false);

    void (async () => {
      try {
        const token = await getAuthTokenRef.current();
        if (!token) throw new Error('Authentication required before watching video.');
        const started = await firestoreService.startWatchSession({
          uid,
          targetType,
          targetId,
          requiredSeconds: safeReqSec,
          authToken: token,
        });
        if (cancelled) return;
        sessionRef.current = started;
        setInitError(null);
      } catch (err) {
        if (cancelled) return;
        setInitError(err instanceof Error ? err.message : 'Unable to start verified watch timer.');
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, uid, targetType, targetId, safeReqSec]);

  // Server + Firestore heartbeat timer (only advances while video is playing AND tab visible)
  useEffect(() => {
    if (!isOpen || initializing || initError || finishedRef.current) return;

    const timer = window.setInterval(() => {
      const sess = sessionRef.current;
      if (!sess || finishedRef.current) return;

      void (async () => {
        try {
          const token = await getAuthTokenRef.current();
          if (!token || finishedRef.current) return;

          const hb = await firestoreService.heartbeatWatchSession({
            sessionId: sess.sessionId,
            sessionToken: sess.sessionToken,
            isPlaying: isPlayingRef.current,
            isVisible: isVisibleRef.current,
            authToken: token,
            lastFirestoreSyncSec: lastFirestoreSyncRef.current,
          });
          lastFirestoreSyncRef.current = hb.syncedSec;
          setWatchedSeconds(hb.accumulatedSeconds);

          if (hb.completed && !finishedRef.current) {
            finishedRef.current = true;
            setVerifyingCompletion(true);
            try {
              const comp = await firestoreService.completeWatchSession({
                sessionId: sess.sessionId,
                sessionToken: sess.sessionToken,
                authToken: token,
              });
              setWatchedSeconds(sess.requiredSeconds);
              setCompletedBanner(true);
              setVerifyingCompletion(false);

              window.setTimeout(() => {
                onVerifiedCompleteRef.current({
                  targetId,
                  verificationSignature: comp.verificationSignature,
                });
                onCloseRef.current();
              }, 1100);
            } catch (compErr) {
              // Not yet ready on server clock -> allow next heartbeat
              finishedRef.current = false;
              setVerifyingCompletion(false);
              if (compErr instanceof Error && !compErr.message.includes('more second')) {
                setInitError(compErr.message);
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('interrupted')) {
            setInitError(err.message);
          }
        }
      })();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, initializing, initError, targetId]);

  if (!isOpen) return null;

  const displayedRequired = sessionRef.current?.requiredSeconds ?? safeReqSec;
  const clampedWatched = Math.min(displayedRequired, Math.floor(watchedSeconds));
  const remaining = Math.max(0, displayedRequired - clampedWatched);
  const progressPct = Math.min(100, Math.round((watchedSeconds / displayedRequired) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`In-app video player: ${title}`}
    >
      <div className="w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-[#071B38] text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>E-Finance In-App Verified Player · No External Redirect</span>
            </div>
            <h2 className="font-display text-base sm:text-lg font-bold truncate mt-0.5">{title}</h2>
            {subtitle && <p className="text-xs text-slate-300 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {initializing ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-600 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-[#071B38]" />
              <span>Preparing secure viewing timer ({safeReqSec}s required)…</span>
            </div>
          ) : initError ? (
            <div className="p-5 bg-red-50 border border-red-200 rounded-xl space-y-3 text-xs text-red-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{initError}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 bg-[#071B38] text-white rounded-lg text-xs font-semibold"
              >
                Return to Previous Page
              </button>
            </div>
          ) : (
            <>
              <SmartVideoPlayer
                videoUrl={videoUrl}
                title={title}
                inAppOnly
                enforceNoSeek
                loopUntilComplete
                trackWatchCompletion={false}
                requiredWatchSeconds={displayedRequired}
                onPlayingStateChange={(playing) => setIsPlaying(playing)}
                onSeekBlocked={() => {
                  setSeekWarning(true);
                  window.setTimeout(() => setSeekWarning(false), 3000);
                }}
              />

              {/* Live Watch Timer Progress Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    {completedBanner ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span className="text-emerald-800">
                          Required {displayedRequired}s completed! Returning to claim reward…
                        </span>
                      </>
                    ) : verifyingCompletion ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#071B38]" />
                        <span>Verifying watch session with E-Finance server…</span>
                      </>
                    ) : !isTabVisible ? (
                      <>
                        <PauseCircle className="w-4 h-4 text-amber-700" />
                        <span className="text-amber-800">
                          Tab inactive — keep this page visible to count watch time
                        </span>
                      </>
                    ) : !isPlaying ? (
                      <>
                        <Clock className="w-4 h-4 text-amber-700" />
                        <span className="text-amber-800">
                          Press Play on the video ({remaining}s remaining)
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-emerald-700 animate-pulse" />
                        <span className="text-emerald-800">
                          Counting active playback · {remaining}s remaining before auto-return
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-mono font-bold text-[#071B38] tabular-nums">
                    {clampedWatched}s / {displayedRequired}s
                  </span>
                </div>

                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      completedBanner ? 'bg-emerald-600' : 'bg-[#071B38]'
                    }`}
                    style={{ width: `${completedBanner ? 100 : progressPct}%` }}
                  />
                </div>

                {seekWarning && (
                  <p className="text-[11px] font-medium text-amber-800">
                    Skipping forward is disabled while the required viewing countdown is active.
                  </p>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Refreshing, pausing, or leaving before {displayedRequired}s completes will not unlock the Claim Reward button. Once {displayedRequired}s finishes, this player returns you automatically to the task page.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
