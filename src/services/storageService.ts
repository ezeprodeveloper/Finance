import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import type { StoredMediaMetadata } from '../types/finance';

export interface PersistentUploadResult {
  url: string;
  metadata: StoredMediaMetadata;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string; extension: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid media data URL.');
  }
  const contentType = match[1] || 'application/octet-stream';
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const subtype = contentType.split('/')[1]?.split('+')[0]?.toLowerCase() || 'bin';
  const extension = subtype === 'jpeg' ? 'jpg' : subtype.replace(/[^a-z0-9]/g, '') || 'bin';
  return {
    blob: new Blob([bytes], { type: contentType }),
    contentType,
    extension,
  };
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
    // Firebase Storage bucket is not provisioned/authorized in Console yet;
    // persist the compressed media directly in Cloud Firestore when within document bounds.
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
