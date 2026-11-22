import React, { useState } from 'react';
import { CheckCircle2, Copy, Lock, Play, Plus, Upload, Video } from 'lucide-react';
import {
  CustomTask,
  RegisteredUser,
  ShortVideoCampaign,
  SystemSettings,
  TaskSubmission,
} from '../../types/finance';
import { buildMomoPayCode, formatRwf, readFileAsDataUrl } from '../../utils/formatters';
import { StatusLabel } from '../StatusLabel';

interface UserVideosViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  campaigns: ShortVideoCampaign[];
  onWatchComplete: (campaignId: string) => void;
  onCreateVideoCampaign: (payload: {
    title: string;
    description: string;
    videoUrl: string;
    rewardPerViewRwf: number;
    targetViewers: number;
    paymentRef: string;
  }) => void;
}

export function UserVideosView({
  user,
  settings,
  campaigns,
  onWatchComplete,
  onCreateVideoCampaign,
}: UserVideosViewProps) {
  const [tab, setTab] = useState<'watch' | 'upload'>('watch');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [videoWatchedReady, setVideoWatchedReady] = useState(false);

  // Upload campaign form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [rewardPerView, setRewardPerView] = useState(String(settings.minVideoRewardRwf));
  const [targetViewers, setTargetViewers] = useState('20');
  const [paymentRef, setPaymentRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const activeCampaigns = campaigns.filter(
    (c) => c.status === 'active' && c.watchedByUserIds.length < c.targetViewers,
  );
  const myCampaigns = campaigns.filter((c) => c.creatorId === user.id);

  const numericReward = Math.max(0, Number(rewardPerView) || 0);
  const numericViewers = Math.max(0, Number(targetViewers) || 0);
  const totalCost = numericReward * numericViewers;
  const payCode = buildMomoPayCode(settings.momoPayCode, totalCost || settings.minVideoRewardRwf);

  const activeVideo = activeCampaigns.find((c) => c.id === activeVideoId) ?? null;

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Select a valid short video file (MP4, WebM, MOV).');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file, 4);
      setVideoUrl(dataUrl);
      setVideoFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video file must be under 4 MB or use a direct video URL.');
    }
  };

  const handleSubmitCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (title.trim().length < 3) {
      setError('Enter a clear video campaign title.');
      return;
    }
    if (!videoUrl.trim()) {
      setError('Upload a short video file or provide a direct video URL.');
      return;
    }
    if (numericReward < settings.minVideoRewardRwf) {
      setError(
        `Reward per view cannot be less than ${formatRwf(settings.minVideoRewardRwf)}.`,
      );
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

    onCreateVideoCampaign({
      title: title.trim(),
      description: description.trim(),
      videoUrl: videoUrl.trim(),
      rewardPerViewRwf: Math.round(numericReward),
      targetViewers: Math.round(numericViewers),
      paymentRef: paymentRef.trim(),
    });

    setTitle('');
    setDescription('');
    setVideoUrl('');
    setVideoFileName('');
    setPaymentRef('');
    setNotice(
      `Video campaign submitted with payment reference. E-Finance Admin will verify your ${formatRwf(totalCost)} transfer and publish it.`,
    );
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
          Each video can only be watched once per member · Min upload rate {formatRwf(settings.minVideoRewardRwf)}/view
        </p>
      </div>

      {notice && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}

      {tab === 'watch' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Video List */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Available short videos</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Watch a video to completion to credit your wallet balance. Repeat views on the same video are blocked.
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
                return (
                  <div key={camp.id} className="p-5 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{camp.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          By {camp.creatorName} · {viewsLeft} views remaining
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-emerald-700 tabular-nums shrink-0">
                        +{formatRwf(camp.rewardPerViewRwf)}
                      </span>
                    </div>
                    {camp.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{camp.description}</p>
                    )}
                    <div className="pt-1">
                      {alreadyWatched ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Already watched &amp; credited (1 view limit per user)</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveVideoId(camp.id);
                            setVideoWatchedReady(false);
                          }}
                          className="h-9 px-3.5 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Watch Video</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Video Player Verification Box */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 h-fit">
            {activeVideo ? (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{activeVideo.title}</h3>
                    <p className="text-xs text-slate-500">
                      Reward: {formatRwf(activeVideo.rewardPerViewRwf)} · Watch until the end to claim
                    </p>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                  <video
                    key={activeVideo.id}
                    src={activeVideo.videoUrl}
                    controls
                    onEnded={() => setVideoWatchedReady(true)}
                    className="w-full max-h-[300px] bg-black"
                  />
                </div>

                {activeVideo.watchedByUserIds.includes(user.id) ? (
                  <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    Reward credited to your balance! You cannot watch this video a second time.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-600">
                      {videoWatchedReady
                        ? 'Video completed! Claim your reward now.'
                        : 'Play the video to completion to unlock the claim button.'}
                    </p>
                    <button
                      type="button"
                      disabled={!videoWatchedReady}
                      onClick={() => {
                        onWatchComplete(activeVideo.id);
                        setNotice(
                          `Earned ${formatRwf(activeVideo.rewardPerViewRwf)} from "${activeVideo.title}".`,
                        );
                      }}
                      className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Claim {formatRwf(activeVideo.rewardPerViewRwf)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <Video className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-700">Select a short video to watch</p>
                <p className="text-xs text-slate-500">
                  Your balance updates automatically once the video finishes playing.
                </p>
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
                Set reward per view (not less than {formatRwf(settings.minVideoRewardRwf)}), target viewers, and pay via {settings.momoPayCode}*amount#.
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
                    <span>{videoFileName ? 'Replace Video File' : 'Upload Video (max 4MB)'}</span>
                    <input type="file" accept="video/*" onChange={handleVideoFile} className="sr-only" />
                  </label>
                </div>
                {videoFileName && (
                  <p className="text-xs text-emerald-700 font-medium">Loaded file: {videoFileName}</p>
                )}
                <div>
                  <label htmlFor="vid-url" className="block text-[11px] text-slate-500 mb-1">
                    Or paste direct MP4 / WebM video URL
                  </label>
                  <input
                    id="vid-url"
                    type="text"
                    value={videoUrl.startsWith('data:') ? '(Uploaded local video file)' : videoUrl}
                    onChange={(e) => {
                      setVideoFileName('');
                      setVideoUrl(e.target.value);
                    }}
                    placeholder="https://..."
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vid-reward" className="block text-xs font-medium text-slate-700 mb-1">
                    Amount per view (min {settings.minVideoRewardRwf} RWF) *
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
                    Number of viewers wanted *
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
              <div className="bg-[#071B38] text-white rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Total Campaign Cost</span>
                  <span className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                    {formatRwf(totalCost)}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-300">Pay to E-Finance Rwanda MoMo Code:</p>
                    <p className="font-mono text-base font-bold text-white tabular-nums">{payCode}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="h-8 px-3 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
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

              {error && (
                <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Video &amp; Payment for Admin Approval</span>
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
                          {camp.watchedByUserIds.length}/{camp.targetViewers} views · {formatRwf(camp.rewardPerViewRwf)}/view · Paid {camp.paymentCode}
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
    </div>
  );
}

interface UserTasksViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  tasks: CustomTask[];
  submissions: TaskSubmission[];
  onSubmitTaskProof: (payload: {
    taskId: string;
    proofText: string;
    proofUrl?: string;
  }) => void;
  onCreateCustomTask: (payload: {
    title: string;
    requirements: string;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
  }) => void;
}

export function UserTasksView({
  user,
  settings,
  tasks,
  submissions,
  onSubmitTaskProof,
  onCreateCustomTask,
}: UserTasksViewProps) {
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [proofText, setProofText] = useState('');
  const [proofUrl, setProofUrl] = useState('');

  // Create Task state
  const [title, setTitle] = useState('');
  const [requirements, setRequirements] = useState('');
  const [reward, setReward] = useState('100');
  const [participants, setParticipants] = useState('25');
  const [paymentRef, setPaymentRef] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTasks = tasks.filter(
    (t) => t.status === 'active' && t.approvedWorkerIds.length < t.targetCompletions,
  );
  const selectedTask = activeTasks.find((t) => t.id === selectedTaskId) ?? activeTasks[0] ?? null;

  const mySubmissions = submissions.filter((s) => s.workerId === user.id);
  const myCreatedTasks = tasks.filter((t) => t.creatorId === user.id);

  const hasSubmittedTask = (taskId: string) =>
    submissions.some((s) => s.taskId === taskId && s.workerId === user.id);

  const totalTaskBudget = (Number(reward) || 0) * (Number(participants) || 0);
  const payCode = buildMomoPayCode(settings.momoPayCode, totalTaskBudget || 100);

  const handleSubmitProof = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!selectedTask) return;
    if (hasSubmittedTask(selectedTask.id)) {
      setError('You have already submitted this task. One submission per user.');
      return;
    }
    if (proofText.trim().length < 5) {
      setError('Describe how you fulfilled the task requirements.');
      return;
    }

    onSubmitTaskProof({
      taskId: selectedTask.id,
      proofText: proofText.trim(),
      proofUrl: proofUrl.trim() || undefined,
    });
    setProofText('');
    setProofUrl('');
    setNotice(
      `Proof submitted for "${selectedTask.title}". E-Finance Admin will check the requirements and approve your reward.`,
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const rewardNum = Number(reward);
    const countNum = Number(participants);

    if (title.trim().length < 3 || requirements.trim().length < 10) {
      setError('Provide a task title and clear requirements for workers.');
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

    onCreateCustomTask({
      title: title.trim(),
      requirements: requirements.trim(),
      rewardPerCompletionRwf: Math.round(rewardNum),
      targetCompletions: Math.round(countNum),
      paymentRef: paymentRef.trim(),
    });
    setTitle('');
    setRequirements('');
    setPaymentRef('');
    setNotice(
      `Task created and sent to E-Finance Admin for payment verification (${formatRwf(totalTaskBudget)}).`,
    );
  };

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
          Admin verifies task requirements before approving rewards · 1 completion per user
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
                return (
                  <div key={task.id} className="p-5 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
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
                    <div className="pt-1">
                      {submitted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Submitted (repeat participation disabled)</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className="h-9 px-3.5 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg"
                        >
                          Submit Task Proof
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
                Submit task completion
              </h2>
              {selectedTask && !hasSubmittedTask(selectedTask.id) ? (
                <form onSubmit={handleSubmitProof} className="mt-4 space-y-4">
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">{selectedTask.title}</p>
                    <p className="mt-1">{selectedTask.requirements}</p>
                  </div>
                  <div>
                    <label htmlFor="task-proof-text" className="block text-xs font-medium text-slate-700 mb-1">
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
                    <label htmlFor="task-proof-url" className="block text-xs font-medium text-slate-700 mb-1">
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
                    className="w-full h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
                  >
                    Send to E-Finance Admin for Approval
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-xs text-slate-500">
                  Select an eligible task on the left to submit proof for Admin review.
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

              <div className="bg-[#071B38] text-white rounded-xl p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Total Task Budget</span>
                  <span className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                    {formatRwf(totalTaskBudget)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  MoMo Payment Code: <strong className="font-mono text-white">{payCode}</strong>
                </p>
              </div>

              <div>
                <label htmlFor="ct-ref" className="block text-xs font-medium text-slate-700 mb-1">
                  MoMo Payment Reference *
                </label>
                <input
                  id="ct-ref"
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Enter MoMo Transaction ID"
                  required
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
              >
                Publish Task for Admin Verification
              </button>
            </form>
          </section>

          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden h-fit">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Tasks you created</h2>
            </div>
            {myCreatedTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No custom tasks created yet.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {myCreatedTasks.map((task) => (
                  <div key={task.id} className="p-5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                      <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                        {task.approvedWorkerIds.length}/{task.targetCompletions} approved · {formatRwf(task.rewardPerCompletionRwf)} each
                      </p>
                    </div>
                    <StatusLabel
                      label={task.status === 'active' ? 'Live' : task.status === 'completed' ? 'Completed' : 'Pending Admin'}
                      tone={task.status === 'active' || task.status === 'completed' ? 'success' : 'warning'}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
