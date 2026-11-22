import {
  GitHubCommitSummary,
  GitHubHostBundle,
  GitHubReleaseSummary,
  GitHubWorkflowRunSummary,
} from '../types/finance';

export function parseGitHubRepoInput(raw: string): { owner: string; repo: string } | null {
  const trimmed = raw.trim().replace(/\.git$/i, '').replace(/\/+$/, '');
  if (!trimmed) return null;

  // Match full URL like https://github.com/owner/repo
  const urlMatch = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // Match owner/repo
  const slashMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slashMatch) {
    return { owner: slashMatch[1], repo: slashMatch[2] };
  }

  return null;
}

function buildHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

async function fetchJsonOrThrow<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: buildHeaders(token) });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Repository not found or private (add a GitHub token for private repositories).');
    }
    if (res.status === 403) {
      throw new Error('GitHub API rate limit reached or access denied. Add a Personal Access Token to continue.');
    }
    if (res.status === 401) {
      throw new Error('Invalid GitHub Personal Access Token.');
    }
    throw new Error(`GitHub API returned HTTP ${res.status}.`);
  }
  return (await res.json()) as T;
}

async function fetchJsonOptional<T>(url: string, token?: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: buildHeaders(token) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface RawRepoResponse {
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  default_branch: string;
  visibility?: string;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  has_pages: boolean;
  license?: { name?: string } | null;
}

interface RawRunsResponse {
  workflow_runs?: Array<{
    id: number;
    name: string;
    head_branch: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    created_at: string;
    run_number: number;
  }>;
}

interface RawReleaseResponse {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string;
  html_url: string;
  body: string | null;
  assets?: Array<{
    id: number;
    name: string;
    size: number;
    download_count: number;
    browser_download_url: string;
  }>;
}

interface RawCommitResponse {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

interface RawPagesResponse {
  html_url?: string;
}

export async function fetchGitHubHostBundle(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubHostBundle> {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const rawRepo = await fetchJsonOrThrow<RawRepoResponse>(base, token);

  const [rawRuns, rawReleases, rawCommits, rawPages] = await Promise.all([
    fetchJsonOptional<RawRunsResponse>(`${base}/actions/runs?per_page=8`, token),
    fetchJsonOptional<RawReleaseResponse[]>(`${base}/releases?per_page=5`, token),
    fetchJsonOptional<RawCommitResponse[]>(`${base}/commits?per_page=6`, token),
    rawRepo.has_pages ? fetchJsonOptional<RawPagesResponse>(`${base}/pages`, token) : Promise.resolve(null),
  ]);

  const runs: GitHubWorkflowRunSummary[] = (rawRuns?.workflow_runs ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    headBranch: r.head_branch,
    headSha: r.head_sha.slice(0, 7),
    status: r.status,
    conclusion: r.conclusion,
    htmlUrl: r.html_url,
    createdAt: r.created_at,
    runNumber: r.run_number,
  }));

  const releases: GitHubReleaseSummary[] = (rawReleases ?? []).map((rel) => ({
    id: rel.id,
    tagName: rel.tag_name,
    name: rel.name || rel.tag_name,
    publishedAt: rel.published_at,
    htmlUrl: rel.html_url,
    body: rel.body || '',
    assets: (rel.assets ?? []).map((asset) => ({
      id: asset.id,
      name: asset.name,
      sizeBytes: asset.size,
      downloadCount: asset.download_count,
      browserDownloadUrl: asset.browser_download_url,
    })),
  }));

  const commits: GitHubCommitSummary[] = (rawCommits ?? []).map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    authorName: c.commit.author.name,
    date: c.commit.author.date,
    htmlUrl: c.html_url,
  }));

  let pagesUrl: string | null = rawPages?.html_url ?? null;
  if (!pagesUrl && rawRepo.has_pages) {
    pagesUrl =
      repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
        ? `https://${owner}.github.io/`
        : `https://${owner}.github.io/${repo}/`;
  }

  return {
    repo: {
      fullName: rawRepo.full_name,
      description: rawRepo.description,
      htmlUrl: rawRepo.html_url,
      homepage: rawRepo.homepage || null,
      defaultBranch: rawRepo.default_branch,
      visibility: rawRepo.visibility || (rawRepo.private ? 'private' : 'public'),
      stars: rawRepo.stargazers_count,
      forks: rawRepo.forks_count,
      openIssues: rawRepo.open_issues_count,
      pushedAt: rawRepo.pushed_at,
      hasPages: rawRepo.has_pages,
      licenseName: rawRepo.license?.name ?? null,
    },
    runs,
    releases,
    commits,
    pagesUrl,
    fetchedAt: new Date().toISOString(),
  };
}

export const GITHUB_PAGES_WORKFLOW_YAML = `name: Deploy E-Finance Rwanda to GitHub Pages

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - id: pages
        uses: actions/configure-pages@v5
      - run: npm install --legacy-peer-deps
      - run: npm run build
        env:
          GITHUB_PAGES: "true"
          VITE_BASE_PATH: "\${{ steps.pages.outputs.base_path }}"
      - run: |
          touch dist/.nojekyll
          cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4`;
