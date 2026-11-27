import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Lock,
  PhoneCall,
  Play,
  Plus,
  ShieldCheck,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { MAX_LOCAL_VIDEO_FILE_BYTES } from '../../services/storageService';
import {
  CustomTask,
  RegisteredUser,
  ShortVideoCampaign,
  SystemSettings,
  TaskSubmission,
  VideoWatchSessionRecord,
} from '../../types/finance';
import {
  buildUssdFullCode,
  buildUssdTelHref,
  formatBytes,
  formatRwf,
} from '../../utils/formatters';
import { InAppVideoTaskModal } from '../InAppVideoTaskModal';
import { StatusLabel } from '../StatusLabel';

interface UserVideosViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  campaigns: ShortVideoCampaign[];
  videoWatchSessions: VideoWatchSessionRecord[];
  getAuthToken: () => Promise<string | null>;
  onWatchComplete: (campaignId: string, verificationSignature?: string) => Promise<string | null>;
  onCreateVideoCampaign: (payload: {
    title: string;
    description: string;
    videoUrl: string;
    videoFile?: File | null;
    requiredWatchSeconds: number;
    rewardPerViewRwf: number;
    targetViewers: number;
    paymentRef: string;
    onUploadProgress?: (percent: number, stage: string) => void;
  }) => Promise<string | null>;
}

export function UserVideosView({
  user,
  settings,
  campaigns,
  videoWatchSessions,
  getAuthToken,
  onWatchComplete,
  onCreateVideoCampaign,
}: UserVideosViewProps) {
  const [tab, setTab] = useState<'watch' | 'upload'>('watch');
  const [modalVideo, setModalVideo] = useState<ShortVideoCampaign | null>(null);
  const [verifiedSignatures, setVerifiedSignatures] = useState<Record<string, string>>({});
  const [highlightedVideoId, setHighlightedVideoId] = useState<string | null>(null);
  const [claimingCampaignId, setClaimingCampaignId] = useState<string | null>(null);

  // Upload campaign form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [requiredWatchSeconds, setRequiredWatchSeconds] = useState('15');
  const [rewardPerView, setRewardPerView] = useState(String(settings.minVideoRewardRwf));
  const [targetViewers, setTargetViewers] = useState('20');
  const [paymentRef, setPaymentRef] = useState('');
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ percent: number; stage: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const activeCampaigns = campaigns.filter(
    (c) => c.status === 'active' && c.watchedByUserIds.length < c.targetViewers,
  );
  const myCampaigns = campaigns.filter((c) => c.creatorId === user.id);

  const numericReward = Math.max(0, Number(rewardPerView) || 0);
  const numericViewers = Math.max(0, Number(targetViewers) || 0);
  const totalCost = numericReward * numericViewers;
  const effectiveVideoAmount = totalCost || settings.minVideoRewardRwf;
  const payCode = buildUssdFullCode(settings.momoPayCode, effectiveVideoAmount);
  const payHref = buildUssdTelHref(settings.momoPayCode, effectiveVideoAmount);

  const getVerifiedSig = (campId: string): string | undefined => {
    if (verifiedSignatures[campId]) return verifiedSignatures[campId];
    const sess = videoWatchSessions.find(
      (s) =>
        s.targetType === 'video' &&
        s.targetId === campId &&
        s.status === 'completed' &&
        Boolean(s.verificationSignature),
    );
    return sess?.verificationSignature;
  };

  const clearSelectedFile = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setVideoFile(null);
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(file.name);
    if (!isVideo) {
      setError('Select a valid short video file (MP4, WebM, MOV, or OGG).');
      return;
    }
    if (file.size > MAX_LOCAL_VIDEO_FILE_BYTES) {
      setError(
        `Selected video (${formatBytes(file.size)}) exceeds the 6 MB upload limit. Compress it under 6 MB or paste a YouTube / Vimeo / direct MP4 URL below.`,
      );
      return;
    }
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setVideoFile(file);
    setVideoUrl('');
    setLocalPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleClaimReward = async (camp: ShortVideoCampaign, sig: string) => {
    setError(null);
    setNotice(null);
    setClaimingCampaignId(camp.id);
    try {
      const errMsg = await onWatchComplete(camp.id, sig);
      if (errMsg) {
        setError(errMsg);
      } else {
        setNotice(`Reward claimed! +${formatRwf(camp.rewardPerViewRwf)} credited for "${camp.title}".`);
        setVerifiedSignatures((prev) => {
          const next = { ...prev };
          delete next[camp.id];
          return next;
        });
        if (highlightedVideoId === camp.id) setHighlightedVideoId(null);
      }
    } finally {
      setClaimingCampaignId(null);
    }
  };

  const handleSubmitCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (title.trim().length < 3) {
      setError('Enter a clear video campaign title.');
      return;
    }
    if (!videoFile && !videoUrl.trim()) {
      setError(
        'Upload a short video file (up to 6 MB) or paste a video URL (MP4, YouTube, Vimeo, Google Drive).',
      );
      return;
    }
    const reqSec = Math.round(Number(requiredWatchSeconds));
    if (!Number.isFinite(reqSec) || reqSec < 5 || reqSec > 600) {
      setError('Required viewing duration must be between 5 and 600 seconds.');
      return;
    }
    if (numericReward < settings.minVideoRewardRwf) {
      setError(`Reward per view cannot be less than ${formatRwf(settings.minVideoRewardRwf)}.`);
      return;
    }
    if (numericViewers < 1) {
      setError('Specify at least 1 viewer.');
      return;
    }
    if (paymentRef.trim().length < 4) {
      setError(`Pay ${formatRwf(totalCost)} using ${payCode} and enter your MoMo payment reference.`);
      return;
    }

    setSubmittingVideo(true);
    setUploadProgress(videoFile ? { percent: 5, stage: 'Starting video upload…' } : null);
    try {
      const errMsg = await onCreateVideoCampaign({
        title: title.trim(),
        description: description.trim(),
        videoUrl: videoUrl.trim(),
        videoFile,
        requiredWatchSeconds: reqSec,
        rewardPerViewRwf: Math.round(numericReward),
        targetViewers: Math.round(numericViewers),
        paymentRef: paymentRef.trim(),
        onUploadProgress: (percent, stage) => setUploadProgress({ percent, stage }),
      });

      if (errMsg) {
        setError(errMsg);
        return;
      }

      setTitle('');
      setDescription('');
      setVideoUrl('');
      clearSelectedFile();
      setRequiredWatchSeconds('15');
      setPaymentRef('');
      setNotice(
        `Video campaign submitted with payment reference. E-Finance Admin will verify your ${formatRwf(totalCost)} transfer and publish it.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload video campaign.');
    } finally {
      setSubmittingVideo(false);
      setUploadProgress(null);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(payCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const highlightedCamp =
    activeCampaigns.find((c) => c.id === highlightedVideoId) ??
    activeCampaigns.find((c) => !c.watchedByUserIds.includes(user.id) && Boolean(getVerifiedSig(c.id))) ??
    null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('watch')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'watch' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Watch Short Videos &amp; Earn
          </button>
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'upload' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upload Video Campaign
          </button>
        </div>
        <p className="text-xs text-slate-500">
          In-app verified player · One claim per user · Min rate {formatRwf(settings.minVideoRewardRwf)}/view
        </p>
      </div>

      {notice && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {tab === 'watch' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Video List */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Available short videos</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click Watch Video to open the in-app player. Complete the required seconds to return automatically and unlock Claim Reward.
              </p>
            </div>

            {activeCampaigns.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No active video campaigns are published right now. Upload a video campaign or wait for Admin approvals.
              </div>
            ) : (
              activeCampaigns.map((camp) => {
                const alreadyWatched = camp.watchedByUserIds.includes(user.id);
                const viewsLeft = camp.targetViewers - camp.watchedByUserIds.length;
                const reqSec = camp.requiredWatchSeconds ?? 15;
                const verifiedSig = getVerifiedSig(camp.id);
                const isClaimingThis = claimingCampaignId === camp.id;

                return (
                  <div
                    key={camp.id}
                    className={`p-5 space-y-3 transition-colors ${
                      highlightedVideoId === camp.id && !alreadyWatched ? 'bg-emerald-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{camp.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>By {camp.creatorName}</span>
                          <span>·</span>
                          <span>{viewsLeft} views remaining</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[#071B38] font-medium">
                            <Clock className="w-3 h-3" />
                            {reqSec}s required
                          </span>
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-emerald-700 tabular-nums shrink-0">
                        +{formatRwf(camp.rewardPerViewRwf)}
                      </span>
                    </div>
                    {camp.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{camp.description}</p>
                    )}

                    <div className="pt-1 flex flex-wrap items-center gap-2.5">
                      {alreadyWatched ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Claimed &amp; credited (1 view limit per user)</span>
                        </span>
                      ) : verifiedSig ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                            <ShieldCheck className="w-4 h-4 text-emerald-700" />
                            <span>{reqSec}s verified!</span>
                          </span>
                          <button
                            type="button"
                            disabled={isClaimingThis}
                            onClick={() => void handleClaimReward(camp, verifiedSig)}
                            className="h-9 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
                          >
                            {isClaimingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isClaimingThis
                                ? 'Crediting…'
                                : `Claim ${formatRwf(camp.rewardPerViewRwf)} Reward`}
                            </span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setNotice(null);
                            setModalVideo(camp);
                          }}
                          className="h-9 px-3.5 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Watch Video Inside App ({reqSec}s)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Right Status & Claim Panel */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 h-fit space-y-4">
            {highlightedCamp && !highlightedCamp.watchedByUserIds.includes(user.id) && getVerifiedSig(highlightedCamp.id) ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Viewing Completed &amp; Verified!</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{highlightedCamp.title}</h3>
                  <p className="text-xs text-slate-600">
                    You completed the full {highlightedCamp.requiredWatchSeconds ?? 15}s required playback inside E-Finance. Claim your reward below.
                  </p>
                  <button
                    type="button"
                    disabled={claimingCampaignId === highlightedCamp.id}
                    onClick={() => {
                      const sig = getVerifiedSig(highlightedCamp.id);
                      if (sig) void handleClaimReward(highlightedCamp, sig);
                    }}
                    className="w-full h-10 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 mt-1"
                  >
                    {claimingCampaignId === highlightedCamp.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>
                      {claimingCampaignId === highlightedCamp.id
                        ? 'Crediting Reward…'
                        : `Claim ${formatRwf(highlightedCamp.rewardPerViewRwf)} Reward`}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2.5">
                <Video className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">How Verified Video Rewards Work</p>
                <ol className="text-xs text-slate-500 text-left space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <li>1. Tap <strong>Watch Video Inside App</strong> on any active campaign.</li>
                  <li>2. Watch the full required seconds inside E-Finance without leaving or skipping ahead.</li>
                  <li>3. When the countdown reaches 0s, you return automatically and the <strong>Claim Reward</strong> button unlocks.</li>
                </ol>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload Video Form */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
            <div className="pb-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Upload short video campaign</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set reward per view (min {formatRwf(settings.minVideoRewardRwf)}), required watch seconds, target viewers, and pay via {settings.momoPayCode}*amount#.
              </p>
            </div>

            <form onSubmit={handleSubmitCampaign} className="mt-4 space-y-4">
              <div>
                <label htmlFor="vid-title" className="block text-xs font-medium text-slate-700 mb-1">
                  Video title *
                </label>
                <input
                  id="vid-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="vid-desc" className="block text-xs font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  id="vid-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">Short video source *</span>
                  <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 hover:bg-slate-100">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{videoFile ? 'Replace Video File' : 'Upload Video (max 6 MB)'}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/ogg,video/*"
                      onChange={handleVideoFile}
                      className="sr-only"
                    />
                  </label>
                </div>
                {videoFile && (
                  <div className="flex items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="truncate font-medium">
                      Ready: {videoFile.name} ({formatBytes(videoFile.size)})
                    </span>
                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      className="text-slate-600 hover:text-red-700 shrink-0"
                      title="Remove selected file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {localPreviewUrl && (
                  <video
                    src={localPreviewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-40 rounded-lg bg-black border border-slate-200"
                  />
                )}
                <div>
                  <label htmlFor="vid-url" className="block text-[11px] text-slate-500 mb-1">
                    Or paste YouTube, Vimeo, Google Drive, or direct MP4/WebM video URL
                  </label>
                  <input
                    id="vid-url"
                    type="text"
                    value={videoFile ? '' : videoUrl}
                    onChange={(e) => {
                      clearSelectedFile();
                      setVideoUrl(e.target.value);
                    }}
                    placeholder="https://youtube.com/... or https://.../video.mp4"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="vid-req-sec" className="block text-xs font-medium text-slate-700 mb-1">
                    Required seconds *
                  </label>
                  <input
                    id="vid-req-sec"
                    type="number"
                    min={5}
                    max={600}
                    value={requiredWatchSeconds}
                    onChange={(e) => setRequiredWatchSeconds(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="vid-reward" className="block text-xs font-medium text-slate-700 mb-1">
                    Reward / view (RWF) *
                  </label>
                  <input
                    id="vid-reward"
                    type="number"
                    min={settings.minVideoRewardRwf}
                    step={10}
                    value={rewardPerView}
                    onChange={(e) => setRewardPerView(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="vid-viewers" className="block text-xs font-medium text-slate-700 mb-1">
                    Target viewers *
                  </label>
                  <input
                    id="vid-viewers"
                    type="number"
                    min={1}
                    value={targetViewers}
                    onChange={(e) => setTargetViewers(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Payment Code Instruction */}
              <div className="bg-[#071B38] text-white rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Total Campaign Cost</span>
                  <span className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                    {formatRwf(totalCost)}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-300">Tap USSD or Copy Code to Pay:</p>
                    <a
                      href={payHref}
                      className="font-mono text-base font-bold text-emerald-300 hover:underline inline-flex items-center gap-1.5 tabular-nums mt-0.5"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>{payCode}</span>
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={payHref}
                      className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Dial USSD</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="h-8 px-3 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="vid-payref" className="block text-xs font-medium text-slate-700 mb-1">
                  MoMo Payment Reference / Sender Phone *
                </label>
                <input
                  id="vid-payref"
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Enter MoMo Transaction ID after dialing payment code"
                  required
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {uploadProgress && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>{uploadProgress.stage}</span>
                    <span className="font-mono">{uploadProgress.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#071B38] transition-all duration-300"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingVideo}
                className="w-full h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
              >
                {submittingVideo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>
                  {submittingVideo
                    ? 'Uploading Video & Submitting…'
                    : 'Submit Video & Payment for Admin Approval'}
                </span>
              </button>
            </form>
          </section>

          {/* My Uploaded Video Campaigns */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden h-fit">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Your uploaded video campaigns</h2>
            </div>
            {myCampaigns.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                You have not uploaded any short video campaigns yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {myCampaigns.map((camp) => (
                  <div key={camp.id} className="p-5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{camp.title}</h3>
                        <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                          {camp.watchedByUserIds.length}/{camp.targetViewers} views ·{' '}
                          {camp.requiredWatchSeconds ?? 15}s req · {formatRwf(camp.rewardPerViewRwf)}
                          /view
                        </p>
                      </div>
                      <StatusLabel
                        label={
                          camp.status === 'active'
                            ? 'Live'
                            : camp.status === 'completed'
                              ? 'Completed'
                              : camp.status === 'rejected'
                                ? 'Rejected'
                                : 'Pending Admin'
                        }
                        tone={
                          camp.status === 'active' || camp.status === 'completed'
                            ? 'success'
                            : camp.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {modalVideo && (
        <InAppVideoTaskModal
          isOpen
          uid={user.id}
          targetType="video"
          targetId={modalVideo.id}
          title={modalVideo.title}
          subtitle={`Reward: ${formatRwf(modalVideo.rewardPerViewRwf)} · Required watch: ${modalVideo.requiredWatchSeconds ?? 15}s`}
          videoUrl={modalVideo.videoUrl}
          requiredWatchSeconds={modalVideo.requiredWatchSeconds ?? 15}
          getAuthToken={getAuthToken}
          onVerifiedComplete={({ targetId, verificationSignature }) => {
            setVerifiedSignatures((prev) => ({ ...prev, [targetId]: verificationSignature }));
            setHighlightedVideoId(targetId);
            setNotice(
              `Watched full ${modalVideo.requiredWatchSeconds ?? 15}s! Click Claim ${formatRwf(modalVideo.rewardPerViewRwf)} Reward to credit your wallet.`,
            );
          }}
          onClose={() => setModalVideo(null)}
        />
      )}
    </div>
  );
}

interface UserTasksViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  tasks: CustomTask[];
  submissions: TaskSubmission[];
  videoWatchSessions: VideoWatchSessionRecord[];
  getAuthToken: () => Promise<string | null>;
  onSubmitTaskProof: (payload: {
    taskId: string;
    proofText: string;
    proofUrl?: string;
    verificationSignature?: string;
  }) => Promise<string | null>;
  onCreateCustomTask: (payload: {
    title: string;
    requirements: string;
    videoUrl?: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
    onUploadProgress?: (percent: number, stage: string) => void;
  }) => Promise<string | null>;
}

export function UserTasksView({
  user,
  settings,
  tasks,
  submissions,
  videoWatchSessions,
  getAuthToken,
  onSubmitTaskProof,
  onCreateCustomTask,
}: UserTasksViewProps) {
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [proofText, setProofText] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);

  // In-app task video verification state
  const [modalTask, setModalTask] = useState<CustomTask | null>(null);
  const [verifiedTaskSigs, setVerifiedTaskSigs] = useState<Record<string, string>>({});
  const submitPanelRef = useRef<HTMLElement | null>(null);

  // Create Task state
  const [title, setTitle] = useState('');
  const [requirements, setRequirements] = useState('');
  const [taskVideoUrl, setTaskVideoUrl] = useState('');
  const [taskVideoFile, setTaskVideoFile] = useState<File | null>(null);
  const [taskVideoPreviewUrl, setTaskVideoPreviewUrl] = useState<string | null>(null);
  const [taskRequiredWatchSec, setTaskRequiredWatchSec] = useState('15');
  const [reward, setReward] = useState('100');
  const [participants, setParticipants] = useState('25');
  const [paymentRef, setPaymentRef] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskUploadProgress, setTaskUploadProgress] = useState<{
    percent: number;
    stage: string;
  } | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (taskVideoPreviewUrl) URL.revokeObjectURL(taskVideoPreviewUrl);
    };
  }, [taskVideoPreviewUrl]);

  const activeTasks = tasks.filter(
    (t) => t.status === 'active' && t.approvedWorkerIds.length < t.targetCompletions,
  );
  const selectedTask = activeTasks.find((t) => t.id === selectedTaskId) ?? activeTasks[0] ?? null;

  const mySubmissions = submissions.filter((s) => s.workerId === user.id);
  const myCreatedTasks = tasks.filter((t) => t.creatorId === user.id);

  const hasSubmittedTask = (taskId: string) =>
    submissions.some((s) => s.taskId === taskId && s.workerId === user.id);

  const getTaskVerifiedSig = (taskId: string): string | undefined => {
    if (verifiedTaskSigs[taskId]) return verifiedTaskSigs[taskId];
    const sess = videoWatchSessions.find(
      (s) =>
        s.targetType === 'task' &&
        s.targetId === taskId &&
        (s.status === 'completed' || s.status === 'claimed') &&
        Boolean(s.verificationSignature),
    );
    return sess?.verificationSignature;
  };

  const clearTaskVideoFile = () => {
    if (taskVideoPreviewUrl) URL.revokeObjectURL(taskVideoPreviewUrl);
    setTaskVideoPreviewUrl(null);
    setTaskVideoFile(null);
  };

  const handleTaskVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(file.name);
    if (!isVideo) {
      setError('Select a valid task video file (MP4, WebM, MOV, or OGG).');
      return;
    }
    if (file.size > MAX_LOCAL_VIDEO_FILE_BYTES) {
      setError(
        `Selected task video (${formatBytes(file.size)}) exceeds the 6 MB upload limit. Compress it under 6 MB or paste a video URL instead.`,
      );
      return;
    }
    if (taskVideoPreviewUrl) URL.revokeObjectURL(taskVideoPreviewUrl);
    setTaskVideoFile(file);
    setTaskVideoUrl('');
    setTaskVideoPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const totalTaskBudget = (Number(reward) || 0) * (Number(participants) || 0);
  const payCode = buildUssdFullCode(settings.momoPayCode, totalTaskBudget || 100);
  const taskPayHref = buildUssdTelHref(settings.momoPayCode, totalTaskBudget || 100);

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!selectedTask) return;
    if (hasSubmittedTask(selectedTask.id)) {
      setError('You have already submitted this task. One submission per user.');
      return;
    }

    const requiresVideo = Boolean(selectedTask.videoUrl && selectedTask.videoUrl.trim().length > 0);
    const sig = requiresVideo ? getTaskVerifiedSig(selectedTask.id) : undefined;
    if (requiresVideo && !sig) {
      setError(
        `Watch the task video inside E-Finance for ${selectedTask.requiredWatchSeconds ?? 15}s before submitting & claiming this reward.`,
      );
      return;
    }

    if (proofText.trim().length < 5) {
      setError('Describe how you fulfilled the task requirements.');
      return;
    }

    setSubmittingProof(true);
    try {
      const errMsg = await onSubmitTaskProof({
        taskId: selectedTask.id,
        proofText: proofText.trim(),
        proofUrl: proofUrl.trim() || undefined,
        verificationSignature: sig,
      });
      if (errMsg) {
        setError(errMsg);
        return;
      }
      setProofText('');
      setProofUrl('');
      setNotice(
        `Claim & proof submitted for "${selectedTask.title}". E-Finance Admin will approve your ${formatRwf(selectedTask.rewardPerCompletionRwf)} reward shortly.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit task claim.');
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const rewardNum = Number(reward);
    const countNum = Number(participants);
    const reqSec = Math.round(Number(taskRequiredWatchSec));

    if (title.trim().length < 3 || requirements.trim().length < 10) {
      setError('Provide a task title and clear requirements for workers.');
      return;
    }
    if ((taskVideoFile || taskVideoUrl.trim()) && (!Number.isFinite(reqSec) || reqSec < 5 || reqSec > 600)) {
      setError('Required task video viewing duration must be between 5 and 600 seconds.');
      return;
    }
    if (!Number.isFinite(rewardNum) || rewardNum < 20) {
      setError('Reward per completion must be at least 20 RWF.');
      return;
    }
    if (!Number.isFinite(countNum) || countNum < 1) {
      setError('Target participants must be at least 1.');
      return;
    }
    if (paymentRef.trim().length < 4) {
      setError(`Pay ${formatRwf(totalTaskBudget)} using ${payCode} and enter your MoMo reference.`);
      return;
    }

    setCreatingTask(true);
    setTaskUploadProgress(
      taskVideoFile ? { percent: 5, stage: 'Uploading task video to Firestore…' } : null,
    );
    try {
      const errMsg = await onCreateCustomTask({
        title: title.trim(),
        requirements: requirements.trim(),
        videoUrl: taskVideoUrl.trim() || undefined,
        videoFile: taskVideoFile,
        requiredWatchSeconds: taskVideoFile || taskVideoUrl.trim() ? reqSec : undefined,
        rewardPerCompletionRwf: Math.round(rewardNum),
        targetCompletions: Math.round(countNum),
        paymentRef: paymentRef.trim(),
        onUploadProgress: (percent, stage) => setTaskUploadProgress({ percent, stage }),
      });

      if (errMsg) {
        setError(errMsg);
        return;
      }

      setTitle('');
      setRequirements('');
      setTaskVideoUrl('');
      clearTaskVideoFile();
      setTaskRequiredWatchSec('15');
      setPaymentRef('');
      setNotice(
        `Task created and sent to E-Finance Admin for payment verification (${formatRwf(totalTaskBudget)}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create task.');
    } finally {
      setCreatingTask(false);
      setTaskUploadProgress(null);
    }
  };

  const selectedTaskRequiresVideo = Boolean(
    selectedTask?.videoUrl && selectedTask.videoUrl.trim().length > 0,
  );
  const selectedTaskVerifiedSig = selectedTask ? getTaskVerifiedSig(selectedTask.id) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('browse')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'browse' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available Tasks
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'create' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create &amp; Fund a Task
          </button>
        </div>
        <p className="text-xs text-slate-500">
          In-app video verification &amp; Admin requirement review · 1 claim per user
        </p>
      </div>

      {notice && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {tab === 'browse' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Active tasks from creators</h2>
            </div>

            {activeTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No active tasks available right now.
              </div>
            ) : (
              activeTasks.map((task) => {
                const submitted = hasSubmittedTask(task.id);
                const spotsLeft = task.targetCompletions - task.approvedWorkerIds.length;
                const hasVideo = Boolean(task.videoUrl && task.videoUrl.trim().length > 0);
                const reqSec = task.requiredWatchSeconds ?? 15;
                const taskSig = hasVideo ? getTaskVerifiedSig(task.id) : undefined;

                return (
                  <div
                    key={task.id}
                    className={`p-5 space-y-2.5 transition-colors ${
                      selectedTask?.id === task.id && !submitted ? 'bg-slate-50/80' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                          {hasVideo && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-mono font-semibold text-blue-900">
                              <Video className="w-3 h-3" />
                              In-App Video ({reqSec}s)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Posted by {task.creatorName} · {spotsLeft} spots left
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-emerald-700 tabular-nums shrink-0">
                        +{formatRwf(task.rewardPerCompletionRwf)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                      <strong>Requirements:</strong> {task.requirements}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-2.5">
                      {submitted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Submitted (repeat participation disabled)</span>
                        </span>
                      ) : hasVideo && !taskSig ? (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setNotice(null);
                            setSelectedTaskId(task.id);
                            setModalTask(task);
                          }}
                          className="h-9 px-3.5 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Watch Task Video ({reqSec}s)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            submitPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }}
                          className={`h-9 px-3.5 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 ${
                            hasVideo && taskSig
                              ? 'bg-emerald-700 hover:bg-emerald-800'
                              : 'bg-[#071B38] hover:bg-[#0c2954]'
                          }`}
                        >
                          {hasVideo && taskSig && <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>
                            {hasVideo && taskSig
                              ? `Video Watched — Claim ${formatRwf(task.rewardPerCompletionRwf)}`
                              : 'Submit Task Proof'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <div className="lg:col-span-5 space-y-6">
            <section
              ref={submitPanelRef}
              className="bg-white border border-slate-200 rounded-xl p-6"
            >
              <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
                Submit &amp; claim task reward
              </h2>
              {selectedTask && !hasSubmittedTask(selectedTask.id) ? (
                <form onSubmit={handleSubmitProof} className="mt-4 space-y-4">
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">{selectedTask.title}</p>
                    <p className="mt-1">{selectedTask.requirements}</p>
                  </div>

                  {selectedTaskRequiresVideo && (
                    <div
                      className={`rounded-xl p-3.5 border text-xs space-y-2 ${
                        selectedTaskVerifiedSig
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {selectedTaskVerifiedSig ? (
                        <div className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            Required {selectedTask.requiredWatchSeconds ?? 15}s task video watched &amp; verified! You can now claim your reward below.
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 font-semibold">
                            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              Step 1: Watch the required task video ({selectedTask.requiredWatchSeconds ?? 15}s) inside E-Finance to unlock Claim Reward.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setModalTask(selectedTask);
                            }}
                            className="h-9 px-3.5 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>
                              Watch Task Video Inside App ({selectedTask.requiredWatchSeconds ?? 15}s)
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="task-proof-text"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Completion proof details *
                    </label>
                    <textarea
                      id="task-proof-text"
                      rows={3}
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                      placeholder="Explain what you completed according to the requirements..."
                      required
                      className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="task-proof-url"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Proof link (Optional)
                    </label>
                    <input
                      id="task-proof-url"
                      type="url"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      submittingProof || (selectedTaskRequiresVideo && !selectedTaskVerifiedSig)
                    }
                    className={`w-full h-10 px-4 disabled:opacity-45 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 ${
                      selectedTaskRequiresVideo && selectedTaskVerifiedSig
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : 'bg-[#071B38] hover:bg-[#0c2954]'
                    }`}
                  >
                    {submittingProof && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>
                      {submittingProof
                        ? 'Submitting Claim…'
                        : selectedTaskRequiresVideo && selectedTaskVerifiedSig
                          ? `Claim ${formatRwf(selectedTask.rewardPerCompletionRwf)} Reward`
                          : 'Send to E-Finance Admin for Approval'}
                    </span>
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-xs text-slate-500">
                  Select an eligible task on the left to watch its video or submit proof for Admin review.
                </p>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Your task submissions</h3>
              </div>
              {mySubmissions.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">No submissions yet.</p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {mySubmissions.map((sub) => (
                    <div key={sub.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{sub.taskTitle}</p>
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {formatRwf(sub.rewardRwf)}
                        </p>
                      </div>
                      <StatusLabel
                        label={
                          sub.status === 'approved'
                            ? 'Approved'
                            : sub.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending Admin'
                        }
                        tone={
                          sub.status === 'approved'
                            ? 'success'
                            : sub.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
              Create custom task &amp; requirements
            </h2>
            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label htmlFor="ct-title" className="block text-xs font-medium text-slate-700 mb-1">
                  Task title *
                </label>
                <input
                  id="ct-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="ct-req" className="block text-xs font-medium text-slate-700 mb-1">
                  Task requirements (Admin checks these before approving workers) *
                </label>
                <textarea
                  id="ct-req"
                  rows={3}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="List exact steps and proof required from every participant..."
                  required
                  className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {/* Optional Task Video Upload or URL */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Optional task video (played inside E-Finance)
                  </span>
                  <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 hover:bg-slate-100">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{taskVideoFile ? 'Replace Video' : 'Upload Video (max 6 MB)'}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/ogg,video/*"
                      onChange={handleTaskVideoFile}
                      className="sr-only"
                    />
                  </label>
                </div>

                {taskVideoFile && (
                  <div className="flex items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="truncate font-medium">
                      Ready: {taskVideoFile.name} ({formatBytes(taskVideoFile.size)})
                    </span>
                    <button
                      type="button"
                      onClick={clearTaskVideoFile}
                      className="text-slate-600 hover:text-red-700 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {taskVideoPreviewUrl && (
                  <video
                    src={taskVideoPreviewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-36 rounded-lg bg-black border border-slate-200"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="ct-vid-url" className="block text-[11px] text-slate-500 mb-1">
                      Or paste YouTube / Vimeo / Google Drive / MP4 URL
                    </label>
                    <input
                      id="ct-vid-url"
                      type="text"
                      value={taskVideoFile ? '' : taskVideoUrl}
                      onChange={(e) => {
                        clearTaskVideoFile();
                        setTaskVideoUrl(e.target.value);
                      }}
                      placeholder="https://youtube.com/... or https://.../video.mp4"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="ct-req-sec" className="block text-[11px] text-slate-500 mb-1">
                      Required watch (sec)
                    </label>
                    <input
                      id="ct-req-sec"
                      type="number"
                      min={5}
                      max={600}
                      value={taskRequiredWatchSec}
                      onChange={(e) => setTaskRequiredWatchSec(e.target.value)}
                      className="w-full h-9 px-3 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ct-reward" className="block text-xs font-medium text-slate-700 mb-1">
                    Reward per person (RWF) *
                  </label>
                  <input
                    id="ct-reward"
                    type="number"
                    min={20}
                    value={reward}
                    onChange={(e) => setReward(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ct-count" className="block text-xs font-medium text-slate-700 mb-1">
                    Number of participants *
                  </label>
                  <input
                    id="ct-count"
                    type="number"
                    min={1}
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-[#071B38] text-white rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Total Task Budget</span>
                  <span className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                    {formatRwf(totalTaskBudget)}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-300">
                    USSD Code: <strong className="font-mono text-white">{payCode}</strong>
                  </span>
                  <a
                    href={taskPayHref}
                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Dial USSD</span>
                  </a>
                </div>
              </div>

              <div>
                <label htmlFor="ct-payref" className="block text-xs font-medium text-slate-700 mb-1">
                  MoMo Payment Reference *
                </label>
                <input
                  id="ct-payref"
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Enter MoMo Transaction ID..."
                  required
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {taskUploadProgress && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>{taskUploadProgress.stage}</span>
                    <span className="font-mono">{taskUploadProgress.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#071B38] transition-all duration-300"
                      style={{ width: `${taskUploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={creatingTask}
                className="w-full h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
              >
                {creatingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {creatingTask
                    ? 'Uploading Task & Video…'
                    : 'Submit Task & Payment for Admin Review'}
                </span>
              </button>
            </form>
          </section>

          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden h-fit">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Your created tasks</h2>
            </div>
            {myCreatedTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                You have not created any custom tasks yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {myCreatedTasks.map((task) => (
                  <div key={task.id} className="p-5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                      <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                        {task.approvedWorkerIds.length}/{task.targetCompletions} approved ·{' '}
                        {formatRwf(task.rewardPerCompletionRwf)}/person
                        {task.videoUrl ? ` · ${task.requiredWatchSeconds ?? 15}s video` : ''}
                      </p>
                    </div>
                    <StatusLabel
                      label={
                        task.status === 'active'
                          ? 'Live'
                          : task.status === 'completed'
                            ? 'Completed'
                            : 'Pending Admin'
                      }
                      tone={
                        task.status === 'active' || task.status === 'completed'
                          ? 'success'
                          : 'warning'
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {modalTask && modalTask.videoUrl && (
        <InAppVideoTaskModal
          isOpen
          uid={user.id}
          targetType="task"
          targetId={modalTask.id}
          title={modalTask.title}
          subtitle={`Task Reward: ${formatRwf(modalTask.rewardPerCompletionRwf)} · Required watch: ${modalTask.requiredWatchSeconds ?? 15}s`}
          videoUrl={modalTask.videoUrl}
          requiredWatchSeconds={modalTask.requiredWatchSeconds ?? 15}
          getAuthToken={getAuthToken}
          onVerifiedComplete={({ targetId, verificationSignature }) => {
            setVerifiedTaskSigs((prev) => ({ ...prev, [targetId]: verificationSignature }));
            setSelectedTaskId(targetId);
            setNotice(
              `Required ${modalTask.requiredWatchSeconds ?? 15}s video completed! Fill your task proof and click Claim Reward below.`,
            );
            window.setTimeout(() => {
              submitPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
          }}
          onClose={() => setModalTask(null)}
        />
      )}
    </div>
  );
}
