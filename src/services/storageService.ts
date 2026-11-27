import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { StoredMediaMetadata } from '../types/finance';

export const MAX_LOCAL_VIDEO_FILE_BYTES = 6 * 1024 * 1024; // 6 MB local video support
const INLINE_VIDEO_DATA_URL_MAX = 360_000;
const VIDEO_CHUNK_BASE64_CHARS = 320_000;
const MAX_VIDEO_CHUNKS = 30;

export interface PersistentUploadResult {
  url: string;
  metadata: StoredMediaMetadata;
}

export interface VideoChunkDoc {
  id: string;
  videoId: string;
  ownerUid: string;
  chunkIndex: number;
  totalChunks: number;
  contentType: string;
  data: string;
  createdAt: string;
}

export type ParsedVideoSource =
  | { kind: 'chunked'; videoId: string; originalUrl: string }
  | { kind: 'youtube'; videoId: string; embedUrl: string; watchUrl: string }
  | { kind: 'vimeo'; videoId: string; embedUrl: string; watchUrl: string }
  | { kind: 'gdrive'; fileId: string; embedUrl: string; watchUrl: string }
  | { kind: 'direct'; src: string };

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function dataUrlToBlob(dataUrl: string): {
  blob: Blob;
  contentType: string;
  extension: string;
  base64: string;
} {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid media data URL.');
  }
  const contentType = match[1] || 'application/octet-stream';
  const base64 = match[2];
  const bytes = base64ToUint8Array(base64);
  const subtype = contentType.split('/')[1]?.split('+')[0]?.toLowerCase() || 'bin';
  const extension = subtype === 'jpeg' ? 'jpg' : subtype.replace(/[^a-z0-9]/g, '') || 'bin';
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: contentType }),
    contentType,
    extension,
    base64,
  };
}

function inferVideoContentType(file: File): string {
  if (file.type && file.type.startsWith('video/')) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.ogg') || lower.endsWith('.ogv')) return 'video/ogg';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  return 'video/mp4';
}

function isStorageBucketUnavailable(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const status =
    typeof err === 'object' && err !== null && 'status_' in err
      ? Number((err as { status_: unknown }).status_)
      : 0;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 404 ||
    code === 'storage/unknown' ||
    code === 'storage/bucket-not-found' ||
    code === 'storage/project-not-found' ||
    code === 'storage/unauthenticated' ||
    code === 'storage/unauthorized' ||
    msg.includes('storage/unknown') ||
    msg.includes('404')
  );
}

export async function uploadPersistentDataUrl(params: {
  ownerUid: string;
  folder: 'users' | 'campaigns';
  filePrefix: string;
  dataUrlOrHttpUrl: string;
}): Promise<PersistentUploadResult> {
  const trimmed = params.dataUrlOrHttpUrl.trim();
  const nowIso = new Date().toISOString();

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      url: trimmed,
      metadata: {
        backend: 'firebase_storage',
        contentType: 'text/uri-list',
        sizeBytes: trimmed.length,
        uploadedAt: nowIso,
      },
    };
  }

  const { blob, contentType, extension } = dataUrlToBlob(trimmed);
  const safePrefix = params.filePrefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
  const storagePath = `${params.folder}/${params.ownerUid}/${safePrefix}-${Date.now()}.${extension}`;

  try {
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, blob, {
      contentType,
      customMetadata: {
        uploadedBy: params.ownerUid,
        uploadedAt: nowIso,
      },
    });
    const downloadUrl = await getDownloadURL(fileRef);
    return {
      url: downloadUrl,
      metadata: {
        backend: 'firebase_storage',
        storagePath,
        contentType,
        sizeBytes: blob.size,
        uploadedAt: nowIso,
      },
    };
  } catch (err) {
    if (!isStorageBucketUnavailable(err)) {
      throw err;
    }
    return {
      url: trimmed,
      metadata: {
        backend: 'firestore_inline',
        contentType,
        sizeBytes: blob.size,
        uploadedAt: nowIso,
      },
    };
  }
}

async function saveChunkedVideoToFirestore(params: {
  ownerUid: string;
  videoId: string;
  contentType: string;
  base64: string;
  sizeBytes: number;
  onProgress?: (percent: number, stage: string) => void;
}): Promise<PersistentUploadResult> {
  const nowIso = new Date().toISOString();
  const inlineUrl = `data:${params.contentType};base64,${params.base64}`;
  if (inlineUrl.length <= INLINE_VIDEO_DATA_URL_MAX) {
    params.onProgress?.(100, 'Prepared compact video clip');
    return {
      url: inlineUrl,
      metadata: {
        backend: 'firestore_inline',
        contentType: params.contentType,
        sizeBytes: params.sizeBytes,
        uploadedAt: nowIso,
      },
    };
  }

  const totalChunks = Math.ceil(params.base64.length / VIDEO_CHUNK_BASE64_CHARS);
  if (totalChunks > MAX_VIDEO_CHUNKS) {
    throw new Error(
      'Video file exceeds the 6 MB upload limit. Please compress the video under 6 MB or paste a YouTube / Vimeo / direct MP4 URL.',
    );
  }

  const batchSize = 8;
  for (let start = 0; start < totalChunks; start += batchSize) {
    const batch = writeBatch(db);
    const end = Math.min(totalChunks, start + batchSize);
    for (let idx = start; idx < end; idx += 1) {
      const slice = params.base64.slice(
        idx * VIDEO_CHUNK_BASE64_CHARS,
        (idx + 1) * VIDEO_CHUNK_BASE64_CHARS,
      );
      const chunkId = `${params.videoId}-c${idx}`;
      const chunkDoc: VideoChunkDoc = {
        id: chunkId,
        videoId: params.videoId,
        ownerUid: params.ownerUid,
        chunkIndex: idx,
        totalChunks,
        contentType: params.contentType,
        data: slice,
        createdAt: nowIso,
      };
      batch.set(doc(db, 'videoChunks', chunkId), chunkDoc);
    }
    await batch.commit();
    const pct = Math.min(95, Math.round((end / totalChunks) * 90) + 5);
    params.onProgress?.(pct, `Saving video segment ${end} of ${totalChunks} to Firestore…`);
  }

  params.onProgress?.(100, 'Video upload complete');
  return {
    url: `efinance-video://${params.videoId}`,
    metadata: {
      backend: 'firestore_chunked',
      contentType: params.contentType,
      sizeBytes: params.sizeBytes,
      uploadedAt: nowIso,
    },
  };
}

export async function uploadPersistentVideo(params: {
  ownerUid: string;
  videoId: string;
  file?: File | null;
  videoUrl?: string;
  onProgress?: (percent: number, stage: string) => void;
}): Promise<PersistentUploadResult> {
  const nowIso = new Date().toISOString();

  if (params.file) {
    const file = params.file;
    const isVideoMime =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(file.name);
    if (!isVideoMime) {
      throw new Error('Select a valid video file (MP4, WebM, MOV, or OGG).');
    }
    if (file.size <= 0) {
      throw new Error('Selected video file is empty.');
    }
    if (file.size > MAX_LOCAL_VIDEO_FILE_BYTES) {
      throw new Error(
        `Video file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 6 MB local upload limit. Compress it under 6 MB or paste a direct MP4 / YouTube / Vimeo link.`,
      );
    }

    const contentType = inferVideoContentType(file);
    const ext = contentType.split('/')[1]?.split(';')[0]?.replace(/[^a-z0-9]/g, '') || 'mp4';
    const storagePath = `campaigns/${params.ownerUid}/${params.videoId}.${ext}`;
    params.onProgress?.(10, 'Preparing video upload…');

    try {
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file, {
        contentType,
        customMetadata: {
          uploadedBy: params.ownerUid,
          videoId: params.videoId,
          uploadedAt: nowIso,
        },
      });
      const downloadUrl = await getDownloadURL(fileRef);
      params.onProgress?.(100, 'Video uploaded to cloud storage');
      return {
        url: downloadUrl,
        metadata: {
          backend: 'firebase_storage',
          storagePath,
          contentType,
          sizeBytes: file.size,
          uploadedAt: nowIso,
        },
      };
    } catch (err) {
      if (!isStorageBucketUnavailable(err)) {
        throw err;
      }
      params.onProgress?.(15, 'Encoding video for Cloud Firestore storage…');
      const buffer = await file.arrayBuffer();
      const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
      return saveChunkedVideoToFirestore({
        ownerUid: params.ownerUid,
        videoId: params.videoId,
        contentType,
        base64,
        sizeBytes: file.size,
        onProgress: params.onProgress,
      });
    }
  }

  const trimmed = (params.videoUrl ?? '').trim();
  if (!trimmed) {
    throw new Error('Provide a video URL or upload a local video file.');
  }

  if (/^efinance-video:\/\/[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      url: trimmed,
      metadata: {
        backend: 'firestore_chunked',
        contentType: 'video/mp4',
        sizeBytes: trimmed.length,
        uploadedAt: nowIso,
      },
    };
  }

  if (/^https?:\/\/.+/i.test(trimmed)) {
    if (trimmed.length > 2000) {
      throw new Error('Video URL must be 2000 characters or shorter.');
    }
    return {
      url: trimmed,
      metadata: {
        backend: 'firebase_storage',
        contentType: 'text/uri-list',
        sizeBytes: trimmed.length,
        uploadedAt: nowIso,
      },
    };
  }

  if (/^data:video\/.+/.test(trimmed)) {
    const { blob, contentType, extension, base64 } = dataUrlToBlob(trimmed);
    if (blob.size > MAX_LOCAL_VIDEO_FILE_BYTES) {
      throw new Error('Video file exceeds the 6 MB upload limit.');
    }
    const storagePath = `campaigns/${params.ownerUid}/${params.videoId}.${extension}`;
    try {
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, blob, { contentType });
      const downloadUrl = await getDownloadURL(fileRef);
      return {
        url: downloadUrl,
        metadata: {
          backend: 'firebase_storage',
          storagePath,
          contentType,
          sizeBytes: blob.size,
          uploadedAt: nowIso,
        },
      };
    } catch (err) {
      if (!isStorageBucketUnavailable(err)) {
        throw err;
      }
      return saveChunkedVideoToFirestore({
        ownerUid: params.ownerUid,
        videoId: params.videoId,
        contentType,
        base64,
        sizeBytes: blob.size,
        onProgress: params.onProgress,
      });
    }
  }

  throw new Error('Enter a valid https:// video link (MP4, YouTube, Vimeo, Google Drive) or upload a video file.');
}

const chunkedUrlMemoryCache = new Map<string, { url: string; contentType: string }>();

export async function resolveChunkedVideoBlobUrl(
  videoId: string,
): Promise<{ url: string; contentType: string; isCached: boolean }> {
  const existing = chunkedUrlMemoryCache.get(videoId);
  if (existing) {
    return { ...existing, isCached: true };
  }

  const snap = await getDocs(query(collection(db, 'videoChunks'), where('videoId', '==', videoId)));
  if (snap.empty) {
    throw new Error('Video media chunks were not found in Firestore.');
  }

  const chunks = snap.docs
    .map((d) => d.data() as VideoChunkDoc)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  const expectedCount = chunks[0]?.totalChunks ?? chunks.length;
  if (chunks.length < expectedCount) {
    throw new Error(`Incomplete video upload (${chunks.length}/${expectedCount} segments found).`);
  }

  const contentType = chunks[0]?.contentType || 'video/mp4';
  const combinedBase64 = chunks.map((c) => c.data).join('');
  const bytes = base64ToUint8Array(combinedBase64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);

  chunkedUrlMemoryCache.set(videoId, { url: objectUrl, contentType });
  return { url: objectUrl, contentType, isCached: false };
}

export function parseVideoSource(rawUrl: string): ParsedVideoSource {
  const trimmed = (rawUrl ?? '').trim();

  const chunkedMatch = /^efinance-video:\/\/([a-zA-Z0-9_-]+)$/.exec(trimmed);
  if (chunkedMatch) {
    return { kind: 'chunked', videoId: chunkedMatch[1], originalUrl: trimmed };
  }

  // YouTube (watch, shorts, youtu.be, live, embed)
  const ytMatch =
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.exec(
      trimmed,
    );
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      kind: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1&playsinline=1`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  // Vimeo
  const vimeoMatch = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d{5,12})/.exec(trimmed);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return {
      kind: 'vimeo',
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}?api=1`,
      watchUrl: `https://vimeo.com/${videoId}`,
    };
  }

  // Google Drive
  const driveMatch =
    /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/.exec(trimmed);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return {
      kind: 'gdrive',
      fileId,
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      watchUrl: `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  return { kind: 'direct', src: trimmed };
}
