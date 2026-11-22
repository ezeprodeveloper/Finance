import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  GitCommit,
  Globe,
  RefreshCw,
  Smartphone,
  Unlink,
} from 'lucide-react';
import {
  fetchGitHubHostBundle,
  GITHUB_PAGES_WORKFLOW_YAML,
  parseGitHubRepoInput,
} from '../../services/githubService';
import { GitHubConfig, GitHubHostBundle } from '../../types/finance';
import { formatBytes, formatDateTime } from '../../utils/formatters';
import { StatusLabel } from '../StatusLabel';

interface GitHubHostModuleProps {
  config: GitHubConfig | null;
  onSaveConfig: (next: GitHubConfig | null) => void;
}

export function GitHubHostModule({ config, onSaveConfig }: GitHubHostModuleProps) {
  const [repoInput, setRepoInput] = useState(
    config ? `${config.owner}/${config.repo}` : '',
  );
  const [tokenInput, setTokenInput] = useState(config?.token ?? '');
  const [bundle, setBundle] = useState<GitHubHostBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedYaml, setCopiedYaml] = useState(false);

  const loadRepo = async (owner: string, repo: string, token?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGitHubHostBundle(owner, repo, token);
      setBundle(data);
    } catch (err) {
      setBundle(null);
      setError(err instanceof Error ? err.message : 'Unable to reach GitHub API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (config) {
      setRepoInput(`${config.owner}/${config.repo}`);
      void loadRepo(config.owner, config.repo, config.token);
    }
  }, [config]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseGitHubRepoInput(repoInput);
    if (!parsed) {
      setError('Enter a valid GitHub repository as owner/repo or https://github.com/owner/repo.');
      return;
    }
    const nextConfig: GitHubConfig = {
      owner: parsed.owner,
      repo: parsed.repo,
      token: tokenInput.trim() || undefined,
    };
    onSaveConfig(nextConfig);
    await loadRepo(nextConfig.owner, nextConfig.repo, nextConfig.token);
  };

  const handleDisconnect = () => {
    onSaveConfig(null);
    setBundle(null);
    setRepoInput('');
    setTokenInput('');
    setError(null);
  };

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(GITHUB_PAGES_WORKFLOW_YAML);
      setCopiedYaml(true);
      setTimeout(() => setCopiedYaml(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownloadWorkflow = () => {
    const blob = new Blob([GITHUB_PAGES_WORKFLOW_YAML], { type: 'text/yaml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'deploy.yml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Connection Form */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Connect GitHub repository host</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect any public or private GitHub repository to monitor GitHub Pages hosting, Actions CI runs, and Android APK releases.
            </p>
          </div>
          {config && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void loadRepo(config.owner, config.repo, config.token)}
                disabled={loading}
                className="h-9 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="h-9 px-3 border border-slate-300 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleConnect} className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label htmlFor="gh-repo" className="block text-xs font-medium text-slate-700 mb-1.5">
              GitHub repository (owner/repo or URL)
            </label>
            <input
              id="gh-repo"
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="e.g. octocat/Hello-World or https://github.com/org/efinance"
              required
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="md:col-span-5">
            <label htmlFor="gh-token" className="block text-xs font-medium text-slate-700 mb-1.5">
              Personal Access Token (optional, stored locally for private repos)
            </label>
            <input
              id="gh-token"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_... (optional for public repos)"
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              {loading ? 'Connecting...' : 'Connect Repo'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
            {error}
          </div>
        )}
      </section>

      {/* Live Repo State */}
      {loading && !bundle && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-2/3 bg-slate-100 rounded" />
        </div>
      )}

      {bundle && (
        <div className="space-y-6">
          {/* Repo Overview Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                  <span>{bundle.repo.visibility}</span>
                  <span aria-hidden="true">·</span>
                  <span>Branch {bundle.repo.defaultBranch}</span>
                  {bundle.repo.licenseName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{bundle.repo.licenseName}</span>
                    </>
                  )}
                </div>
                <h3 className="font-display text-xl font-bold text-[#071B38] mt-1">
                  {bundle.repo.fullName}
                </h3>
                {bundle.repo.description && (
                  <p className="text-sm text-slate-600 mt-1">{bundle.repo.description}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <a
                  href={bundle.repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-3.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Open on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                {bundle.pagesUrl && (
                  <a
                    href={bundle.pagesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3.5 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Visit GitHub Pages</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">GitHub Pages Host</span>
                <span className="font-medium text-slate-900 mt-0.5 block truncate">
                  {bundle.pagesUrl ? bundle.pagesUrl : 'Not enabled on repo yet'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Stars / Forks</span>
                <span className="font-mono font-medium text-slate-900 mt-0.5 block tabular-nums">
                  {bundle.repo.stars.toLocaleString()} / {bundle.repo.forks.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Open Issues</span>
                <span className="font-mono font-medium text-slate-900 mt-0.5 block tabular-nums">
                  {bundle.repo.openIssues.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Push</span>
                <span className="font-mono text-slate-900 mt-0.5 block tabular-nums">
                  {formatDateTime(bundle.repo.pushedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* GitHub Actions Workflows (Web & Android APK CI) */}
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">GitHub Actions CI &amp; Deploy Runs</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any completed Android CI or Pages deploy run to download artifacts
                  </p>
                </div>
                <Smartphone className="w-4 h-4 text-slate-400" />
              </div>

              {bundle.runs.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No GitHub Actions workflow runs found on this repository.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {bundle.runs.map((run) => {
                    const tone =
                      run.conclusion === 'success'
                        ? 'success'
                        : run.conclusion === 'failure' || run.conclusion === 'cancelled'
                          ? 'danger'
                          : 'warning';
                    const statusText = run.conclusion
                      ? `${run.conclusion}`
                      : run.status;

                    return (
                      <div key={run.id} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {run.name} <span className="font-mono text-xs text-slate-500">#{run.runNumber}</span>
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5 tabular-nums">
                            {run.headBranch} · {run.headSha} · {formatDateTime(run.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <StatusLabel label={statusText} tone={tone} />
                          <a
                            href={run.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-blue-800 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Artifacts</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Releases & Recent Commits */}
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Releases &amp; APK Packages</h3>
                </div>
                {bundle.releases.length === 0 ? (
                  <div className="p-5 text-xs text-slate-500">
                    No published GitHub Releases yet. Android builds may still appear in Actions artifacts.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {bundle.releases.map((rel) => (
                      <div key={rel.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={rel.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-slate-900 hover:text-blue-800"
                          >
                            {rel.name} ({rel.tagName})
                          </a>
                          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {formatDateTime(rel.publishedAt)}
                          </span>
                        </div>
                        {rel.assets.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {rel.assets.map((asset) => (
                              <a
                                key={asset.id}
                                href={asset.browserDownloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 hover:bg-slate-100"
                              >
                                <span className="font-mono truncate">{asset.name}</span>
                                <span className="font-mono text-slate-500 shrink-0 ml-2">
                                  {formatBytes(asset.sizeBytes)}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Recent commits</h3>
                  <GitCommit className="w-4 h-4 text-slate-400" />
                </div>
                {bundle.commits.length === 0 ? (
                  <div className="p-5 text-xs text-slate-500">No commit history available.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {bundle.commits.slice(0, 4).map((c) => (
                      <a
                        key={c.sha}
                        href={c.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <p className="text-xs font-medium text-slate-900 truncate">{c.message}</p>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
                          {c.sha} · {c.authorName} · {formatDateTime(c.date)}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Pages Deployment Configuration Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              GitHub Pages automated deployment workflow
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Included in this project at <span className="font-mono">.github/workflows/deploy.yml</span>. Enable Settings → Pages → Source: GitHub Actions in your repository.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyYaml}
              className="h-9 px-3.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedYaml ? 'Copied YAML' : 'Copy Workflow'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadWorkflow}
              className="h-9 px-3.5 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download deploy.yml</span>
            </button>
          </div>
        </div>

        <pre className="mt-4 p-4 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
          {GITHUB_PAGES_WORKFLOW_YAML}
        </pre>
      </section>
    </div>
  );
}
