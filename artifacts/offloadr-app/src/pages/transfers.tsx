import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CloudUpload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  FileIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TransferStatus = "queued" | "uploading" | "verifying" | "done" | "failed" | "cancelled";

interface TransferProgress {
  bytes: number;
  totalBytes: number;
  speed: number;
  eta: number | null;
  percentage: number;
}

interface Transfer {
  id: string;
  filename: string;
  size: number;
  destination: string;
  status: TransferStatus;
  progress?: TransferProgress;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  driveLink?: string;
  cleanupAfterUpload: boolean;
}

interface ConfigResponse {
  rclone: { installed: boolean; version: string | null };
  googleDrive: { configured: boolean; uploadRoot: string; sharedDriveConfigured: boolean };
  queue: { active: number; queued: number; maxConcurrent: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/s`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  queued: {
    label: "Queued",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-zinc-700 text-zinc-200 border-zinc-600",
  },
  uploading: {
    label: "Uploading",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    className: "bg-blue-900/60 text-blue-200 border-blue-700",
  },
  verifying: {
    label: "Verifying",
    icon: <RefreshCw className="h-3 w-3 animate-spin" />,
    className: "bg-yellow-900/60 text-yellow-200 border-yellow-700",
  },
  done: {
    label: "Done",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-900/60 text-green-200 border-green-700",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="h-3 w-3" />,
    className: "bg-red-900/60 text-red-200 border-red-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="h-3 w-3" />,
    className: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
};

function StatusBadge({ status }: { status: TransferStatus }) {
  const { label, icon, className } = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={`flex items-center gap-1 text-xs font-medium border ${className}`}
    >
      {icon}
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Transfer card
// ---------------------------------------------------------------------------

function TransferCard({
  transfer,
  onCancel,
}: {
  transfer: Transfer;
  onCancel: (id: string) => void;
}) {
  const isActive = transfer.status === "uploading" || transfer.status === "verifying";
  const pct = transfer.progress?.percentage ?? 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon className="h-4 w-4 text-zinc-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">{transfer.filename}</p>
            <p className="text-xs text-zinc-500">
              {formatBytes(transfer.size)}
              {transfer.destination ? ` → ${transfer.destination}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={transfer.status} />
          {transfer.status === "queued" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-red-400"
              onClick={() => onCancel(transfer.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {isActive && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              {transfer.status === "verifying"
                ? "Verifying integrity…"
                : `${formatBytes(transfer.progress?.bytes ?? 0)} of ${formatBytes(transfer.progress?.totalBytes ?? transfer.size)}`}
            </span>
            <span className="flex gap-3">
              {transfer.progress?.speed ? formatSpeed(transfer.progress.speed) : ""}
              {transfer.progress?.eta !== null && transfer.progress?.eta !== undefined
                ? `ETA ${formatEta(transfer.progress.eta)}`
                : ""}
            </span>
          </div>
          <Progress
            value={transfer.status === "verifying" ? undefined : pct}
            className="h-1.5 bg-zinc-800"
          />
        </div>
      )}

      {transfer.status === "done" && transfer.progress && (
        <div className="text-xs text-zinc-500">
          {formatBytes(transfer.progress.totalBytes)} transferred
          {transfer.driveLink && (
            <>
              {" · "}
              <a
                href={transfer.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Open in Drive ↗
              </a>
            </>
          )}
        </div>
      )}

      {transfer.status === "failed" && transfer.error && (
        <div className="flex items-start gap-2 rounded-md bg-red-950/40 border border-red-900/50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 break-all">{transfer.error}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

function DropZone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed",
        "p-10 text-center transition-colors cursor-pointer select-none",
        dragging
          ? "border-blue-500 bg-blue-950/30"
          : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/60",
        disabled ? "opacity-40 pointer-events-none" : "",
      ].join(" ")}
    >
      <CloudUpload className="h-10 w-10 text-zinc-500" />
      <div>
        <p className="text-sm font-medium text-zinc-200">
          Drop files here or <span className="text-blue-400">browse</span>
        </p>
        <p className="text-xs text-zinc-500 mt-1">Audio, video, images — up to 4 GB per file</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) { onFiles(files); e.target.value = ""; }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TransfersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [destination, setDestination] = useState("");
  const [cleanupAfterUpload, setCleanupAfterUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Config check
  const { data: config, isLoading: configLoading } = useQuery<ConfigResponse>({
    queryKey: ["transfers-config"],
    queryFn: () => apiFetch(`${API}/transfers/config`),
    staleTime: 30_000,
  });

  // Transfer list — poll while anything is active
  const { data: transfersData } = useQuery<{
    transfers: Transfer[];
    queue: { active: number; queued: number; maxConcurrent: number };
  }>({
    queryKey: ["transfers"],
    queryFn: () => apiFetch(`${API}/transfers`),
    refetchInterval: (query) => {
      const transfers = query.state.data?.transfers ?? [];
      const hasActive = transfers.some(
        (t) => t.status === "queued" || t.status === "uploading" || t.status === "verifying",
      );
      return hasActive ? 1000 : 5000;
    },
  });

  const transfers = transfersData?.transfers ?? [];
  const queueStats = transfersData?.queue;

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${API}/transfers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transfers"] }),
  });

  // Upload handler
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!config?.googleDrive.configured) {
        toast({
          title: "Google Drive not configured",
          description: "Ask your admin to set GOOGLE_SERVICE_ACCOUNT_KEY on the server.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);
      let succeeded = 0;
      let failed = 0;

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("destination", destination);
        formData.append("cleanupAfterUpload", String(cleanupAfterUpload));

        try {
          await apiFetch(`${API}/transfers`, {
            method: "POST",
            body: formData,
          });
          succeeded++;
        } catch (err) {
          failed++;
          toast({
            title: `Failed to queue "${file.name}"`,
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        }
      }

      setUploading(false);
      if (succeeded > 0) {
        toast({
          title: `${succeeded} file${succeeded !== 1 ? "s" : ""} queued`,
          description: "Uploading to Google Drive…",
        });
        qc.invalidateQueries({ queryKey: ["transfers"] });
      }
      if (failed > 0 && succeeded === 0) {
        // already toasted per-file above
      }
    },
    [config, destination, cleanupAfterUpload, toast, qc],
  );

  const activeCount = queueStats ? queueStats.active + queueStats.queued : 0;

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <CloudUpload className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transfer to Drive</h1>
            <p className="text-muted-foreground mt-1">
              Upload media files directly to your Google Drive folder via rclone.
            </p>
          </div>
        </div>

        {/* Status bar */}
        {configLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking configuration…
          </div>
        ) : config ? (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={
                config.rclone.installed
                  ? "bg-green-900/30 text-green-300 border-green-800"
                  : "bg-red-900/30 text-red-300 border-red-800"
              }
            >
              rclone {config.rclone.installed ? config.rclone.version ?? "installed" : "not found"}
            </Badge>
            <Badge
              variant="outline"
              className={
                config.googleDrive.configured
                  ? "bg-green-900/30 text-green-300 border-green-800"
                  : "bg-amber-900/30 text-amber-300 border-amber-800"
              }
            >
              Google Drive {config.googleDrive.configured ? "ready" : "not configured"}
            </Badge>
            {activeCount > 0 && (
              <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-800">
                {activeCount} transfer{activeCount !== 1 ? "s" : ""} in progress
              </Badge>
            )}
          </div>
        ) : null}

        {/* Config warning */}
        {config && !config.googleDrive.configured && (
          <Card className="border-amber-900/50 bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-200">Google Drive not configured</p>
                  <p className="text-xs text-amber-300/80">
                    Set{" "}
                    <code className="bg-amber-900/40 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code>{" "}
                    (service account JSON) in the Secrets panel, then restart the API server.
                    Optionally set{" "}
                    <code className="bg-amber-900/40 px-1 rounded">GDRIVE_SHARED_DRIVE_ID</code>{" "}
                    to target a Shared Drive.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Add files
            </CardTitle>
            <CardDescription>
              Files are saved locally first, then transferred to{" "}
              <span className="font-mono text-xs">
                {config?.googleDrive.uploadRoot ?? "Offloadr/Uploads"}
                {destination ? `/${destination}` : ""}
              </span>{" "}
              on Drive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Destination folder */}
            <div className="space-y-2">
              <Label htmlFor="destination" className="flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4 text-zinc-400" />
                Destination sub-folder
                <span className="text-zinc-500 font-normal">(optional)</span>
              </Label>
              <Input
                id="destination"
                placeholder="e.g. Class A / Episode 4"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="bg-zinc-900 border-zinc-700"
              />
              <p className="text-xs text-zinc-500">
                Appended to the root folder. Leave blank to upload into the root.
              </p>
            </div>

            {/* Drop zone */}
            <DropZone
              onFiles={handleFiles}
              disabled={uploading || !config?.googleDrive.configured}
            />

            {/* Cleanup option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="cleanup"
                checked={cleanupAfterUpload}
                onCheckedChange={(v) => setCleanupAfterUpload(v === true)}
              />
              <Label htmlFor="cleanup" className="text-sm font-normal cursor-pointer">
                Delete local copy after successful upload and verification
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Transfer list */}
        {transfers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300">
                Transfers
                {queueStats && (
                  <span className="ml-2 font-normal text-zinc-500">
                    ({queueStats.active} active · {queueStats.queued} queued)
                  </span>
                )}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-zinc-500 h-7"
                onClick={() => qc.invalidateQueries({ queryKey: ["transfers"] })}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {transfers.map((t) => (
                <TransferCard
                  key={t.id}
                  transfer={t}
                  onCancel={(id) => cancelMutation.mutate(id)}
                />
              ))}
            </div>
          </div>
        )}

        {transfers.length === 0 && !configLoading && (
          <div className="text-center py-12 text-zinc-600 text-sm">
            No transfers yet. Drop some files above to get started.
          </div>
        )}

      </div>
    </MainLayout>
  );
}
