import { MainLayout } from "@/components/layout/main-layout";
import {
  useGetProject,
  useListProjectFiles,
  useUpdateFile,
  useDeleteFile,
  getGetProjectQueryKey,
  getListProjectFilesQueryKey,
} from "@/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useParams } from "wouter";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, X, FileAudio, FileVideo, FileImage, File, ArrowLeft, CheckCircle2, AlertTriangle, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getMediaRolesForWorkflow } from "@/lib/workflow-tags";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatBytes(bytes: number) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function FileIcon({ type }: { type: string }) {
  if (type === "audio") return <FileAudio className="h-5 w-5 text-blue-500" />;
  if (type === "video") return <FileVideo className="h-5 w-5 text-purple-500" />;
  if (type === "image") return <FileImage className="h-5 w-5 text-green-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function UploadStatusIcon({ status }: { status: string }) {
  if (status === "uploaded") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "failed") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  return null;
}

type ActiveStatus = "queued" | "uploading" | "succeeded" | "failed";

interface ActiveUpload {
  id: string;
  file: File;
  status: ActiveStatus;
  loaded: number;
  total: number;
  errorMessage: string | null;
  xhr: XMLHttpRequest | null;
}

/**
 * Upload a single File via XHR so we get real upload-progress events
 * (fetch() has no upload progress hook in browsers). Returns the parsed
 * server response on success; throws an Error whose `.message` contains
 * the actionable failure reason (HTTP status + server message, or a
 * network-level description) on failure.
 *
 * This intentionally talks to the server directly instead of going
 * through the generated `uploadFile` client so we control the request
 * lifecycle for progress reporting. The URL/credential handling mirrors
 * what `customFetch` + `setBaseUrl` do for the rest of the app.
 */
function uploadWithProgress(
  projectId: number,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  bindXhr: (xhr: XMLHttpRequest) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    bindXhr(xhr);

    const url = `${API_BASE}/api/projects/${projectId}/files/upload`;
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    xhr.responseType = "text";

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    });

    xhr.addEventListener("load", () => {
      const status = xhr.status;
      let parsed: unknown = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = xhr.responseText;
      }
      if (status >= 200 && status < 300) {
        resolve(parsed);
        return;
      }
      const serverMsg =
        (parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : null) ?? xhr.statusText ?? "Unknown error";
      reject(new Error(`HTTP ${status} ${xhr.statusText} — ${serverMsg}`));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error — the connection dropped before the upload finished. Check your WiFi and try again."));
    });
    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });
    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timed out"));
    });

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export default function ProjectUpload() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [active, setActive] = useState<ActiveUpload[]>([]);
  const activeRef = useRef<ActiveUpload[]>([]);
  activeRef.current = active;
  const runningRef = useRef(false);

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: files, isLoading: filesLoading } = useListProjectFiles(projectId, {
    query: { enabled: !!projectId, queryKey: getListProjectFilesQueryKey(projectId) },
  });

  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();

  const invalidateFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
  }, [projectId, queryClient]);

  // Warn the user before they navigate away while uploads are in flight.
  // The browser will only honour this if there has been a user gesture on
  // the page, which there always will be (file selection / drop counts).
  useEffect(() => {
    const hasInFlight = active.some(
      (u) => u.status === "queued" || u.status === "uploading",
    );
    if (!hasInFlight) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  const updateOne = useCallback((id: string, patch: Partial<ActiveUpload>) => {
    setActive((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  // Drain the queue sequentially so the 1 GB Fly machine isn't asked to
  // spool multiple multi-hundred-MB files to /tmp in parallel.
  const drainQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (true) {
        const next = activeRef.current.find((u) => u.status === "queued");
        if (!next) break;
        updateOne(next.id, { status: "uploading", loaded: 0 });
        try {
          await uploadWithProgress(
            projectId,
            next.file,
            (loaded, total) => updateOne(next.id, { loaded, total }),
            (xhr) => updateOne(next.id, { xhr }),
          );
          updateOne(next.id, {
            status: "succeeded",
            loaded: next.file.size,
            total: next.file.size,
            xhr: null,
          });
          invalidateFiles();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          updateOne(next.id, { status: "failed", errorMessage: message, xhr: null });
          toast({
            title: `Failed to upload ${next.file.name}`,
            description: message,
            variant: "destructive",
          });
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [projectId, updateOne, invalidateFiles, toast]);

  const enqueue = useCallback((fileList: FileList) => {
    const additions: ActiveUpload[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      status: "queued",
      loaded: 0,
      total: file.size,
      errorMessage: null,
      xhr: null,
    }));
    setActive((prev) => [...prev, ...additions]);
    // Kick the drain on the next tick so state has flushed.
    setTimeout(() => { void drainQueue(); }, 0);
  }, [drainQueue]);

  const retry = useCallback((id: string) => {
    setActive((prev) => prev.map((u) =>
      u.id === id ? { ...u, status: "queued", loaded: 0, errorMessage: null } : u,
    ));
    setTimeout(() => { void drainQueue(); }, 0);
  }, [drainQueue]);

  const cancel = useCallback((id: string) => {
    const u = activeRef.current.find((x) => x.id === id);
    if (u?.xhr) u.xhr.abort();
    setActive((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setActive((prev) => prev.filter((u) => u.status !== "succeeded"));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) enqueue(e.dataTransfer.files);
  }, [enqueue]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleRoleChange = (fileId: number, role: string) => {
    updateFile.mutate(
      { id: fileId, data: { mediaRole: role } },
      { onSuccess: invalidateFiles },
    );
  };

  const handleDelete = (fileId: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteFile.mutate({ id: fileId }, {
      onSuccess: () => { toast({ title: "File deleted" }); invalidateFiles(); },
      onError: () => toast({ title: "Failed to delete file", variant: "destructive" }),
    });
  };

  const inFlightCount = active.filter(
    (u) => u.status === "queued" || u.status === "uploading",
  ).length;
  const hasFinished = active.some((u) => u.status === "succeeded");

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Upload Files</h1>
            {project && <p className="text-muted-foreground mt-1">{project.projectName}</p>}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors
            ${isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && enqueue(e.target.files)}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-xl font-semibold">
                {isDragging ? "Drop files to upload" : "Drop files here or click to browse"}
              </p>
              <p className="text-muted-foreground mt-1">
                Audio, video, project files, exports, and notes. Large files supported.
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
                Large video files can take several minutes depending on your WiFi speed.
                Keep this page open until the upload finishes — closing it will cancel any in-progress uploads.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground max-w-lg">
              {["WAV", "MP4", "MOV", "AIFF", "MP3", "PRPROJ", "FCPXML", "DRP", "AVI", "MXF"].map((ext) => (
                <Badge key={ext} variant="outline" className="text-xs font-mono">{ext}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Active uploads with progress */}
        {active.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {inFlightCount > 0
                    ? `Uploading ${inFlightCount} file${inFlightCount !== 1 ? "s" : ""}…`
                    : "Upload Activity"}
                </CardTitle>
                <CardDescription>
                  {inFlightCount > 0
                    ? "Keep this page open until uploads finish."
                    : "All uploads complete."}
                </CardDescription>
              </div>
              {hasFinished && inFlightCount === 0 && (
                <Button variant="outline" size="sm" onClick={clearFinished}>
                  Clear finished
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {active.map((u) => {
                const pct = u.total > 0 ? Math.round((u.loaded / u.total) * 100) : 0;
                return (
                  <div key={u.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{u.file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.status === "uploading" && (
                            <>{formatBytes(u.loaded)} / {formatBytes(u.total)} ({pct}%)</>
                          )}
                          {u.status === "queued" && <>Waiting — {formatBytes(u.total)}</>}
                          {u.status === "succeeded" && <>Uploaded — {formatBytes(u.total)}</>}
                          {u.status === "failed" && (
                            <span className="text-destructive">{u.errorMessage}</span>
                          )}
                        </div>
                      </div>
                      {u.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {u.status === "succeeded" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {u.status === "failed" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {u.status === "failed" && (
                        <Button variant="outline" size="sm" onClick={() => retry(u.id)}>
                          <RotateCw className="h-3 w-3 mr-1" /> Retry
                        </Button>
                      )}
                      {(u.status === "uploading" || u.status === "queued" || u.status === "failed") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cancel(u.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {(u.status === "uploading" || u.status === "queued") && (
                      <Progress value={pct} className="h-2" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Saved file list */}
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
            <CardDescription>
              Tag each file with its role so the editor understands what they are working with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !files || files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No files uploaded yet. Use the drop zone above to upload your recording session files.
              </div>
            ) : (
              <div className="divide-y">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-4 py-3">
                    <FileIcon type={file.fileType} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{file.originalFileName}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(Number(file.fileSize))}</div>
                    </div>
                    <UploadStatusIcon status={file.uploadStatus} />
                    <div className="w-48 flex-shrink-0">
                      <Select
                        value={file.mediaRole ?? ""}
                        onValueChange={(v) => handleRoleChange(file.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Tag role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getMediaRolesForWorkflow(project?.projectWorkflowType).map((role) => (
                            <SelectItem key={role} value={role} className="text-xs">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(file.id, file.originalFileName)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Link href={`/projects/${projectId}`}>
            <Button>Back to Project</Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
