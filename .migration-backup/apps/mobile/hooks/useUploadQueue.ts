import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { offloadrApi } from "@/api/client";
import { useUploadQueueStore, type UploadQueueItem } from "@/store/uploadQueueStore";

const MAX_TRANSIENT_RETRIES = 5;

interface ProcessResult {
  ok: boolean;
  fileId?: number;
  message?: string;
  isTransient: boolean;
}

async function processItem(
  item: UploadQueueItem,
  token: string | null,
  onProgress: (pct: number) => void,
): Promise<ProcessResult> {
  // Step 1: request a presigned upload URL
  const reqResult = await offloadrApi.student.files.requestUpload({
    projectId: item.projectId,
    fileName: item.fileName,
    contentType: item.contentType,
    fileSize: item.fileSize,
  });

  if (!reqResult.ok || !reqResult.data?.uploadUrl || !reqResult.data?.storageKey || !reqResult.data?.fileId) {
    const isTransient = reqResult.status === 0 || reqResult.status >= 500;
    return { ok: false, message: reqResult.message ?? "Upload request failed", isTransient };
  }

  const { uploadUrl, storageKey, fileId } = reqResult.data;

  // Step 2: upload the file to the presigned URL
  try {
    let blob: Blob;
    try {
      const fetchRes = await fetch(item.localUri);
      blob = await fetchRes.blob();
    } catch {
      return { ok: false, message: "Could not read local file", isTransient: true };
    }

    const xhr = new XMLHttpRequest();
    await new Promise<void>((resolve, reject) => {
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", item.contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(blob);
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Upload failed", isTransient: true };
  }

  onProgress(95);

  // Step 3: confirm the upload
  const confirmResult = await offloadrApi.student.files.confirmUpload({ fileId, storageKey });
  if (!confirmResult.ok) {
    const isTransient = confirmResult.status === 0 || confirmResult.status >= 500;
    return { ok: false, message: confirmResult.message ?? "Confirm upload failed", isTransient };
  }

  onProgress(100);
  return { ok: true, fileId, isTransient: false };
}

export function useUploadQueue() {
  const { items, setItemStatus, updateProgress, resetStuckItems } = useUploadQueueStore();
  const token = useAuthStore((s) => s.user?.sessionToken ?? null);
  const mountedRef = useRef(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    resetStuckItems();
    return () => { mountedRef.current = false; };
  }, []);

  const nextQueued = items.find((i) => i.status === "queued");
  const nextQueuedUuid = nextQueued?.uuid;

  useEffect(() => {
    if (!nextQueuedUuid || isProcessing) return;

    const item = items.find((i) => i.uuid === nextQueuedUuid);
    if (!item) return;

    const uuid = nextQueuedUuid;
    const currentRetries = item.retries ?? 0;

    setIsProcessing(true);
    setItemStatus(uuid, "uploading");

    processItem(item, token, (pct) => {
      if (mountedRef.current) updateProgress(uuid, pct);
    })
      .then(({ ok, fileId, message, isTransient }) => {
        if (!mountedRef.current) return;
        if (ok && fileId !== undefined) {
          setItemStatus(uuid, "uploaded", { fileId });
          updateProgress(uuid, 100);
          return;
        }
        if (isTransient && currentRetries < MAX_TRANSIENT_RETRIES) {
          setItemStatus(uuid, "queued", { retries: currentRetries + 1 });
        } else {
          setItemStatus(uuid, "error", { error: message ?? "Upload failed", retries: currentRetries + 1 });
        }
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        if (currentRetries < MAX_TRANSIENT_RETRIES) {
          setItemStatus(uuid, "queued", { retries: currentRetries + 1 });
        } else {
          setItemStatus(uuid, "error", { error: err instanceof Error ? err.message : "Upload failed", retries: currentRetries + 1 });
        }
      })
      .finally(() => {
        if (mountedRef.current) setIsProcessing(false);
      });
  }, [nextQueuedUuid, isProcessing]);

  return { items, isProcessing };
}
