import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, Upload, X, Sparkles, Scissors } from "lucide-react";
import PortalLogo from "@/components/student-portal/portal-logo";
import type { StudentUploadCodeResolution, StudentWorkflowChoice } from "@/api-client";
import { useSetStudentWorkflowChoice } from "@/api-client";
import { customFetch, ApiError } from "@/api-client/custom-fetch";

// `customFetch` already prepends the artifact's base prefix to any
// path starting with "/" (configured once via `setBaseUrl` in
// `main.tsx`). For the XHR uploader below — which can't use
// `customFetch` because we need progress events — we replicate that
// same prefix calculation locally so the two paths stay in sync.
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type UploadStatus = "queued" | "uploading" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  errorMessage?: string;
  progress: number;
}

function formatBytes(bytes: number) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function uploadOne(
  code: string,
  studentName: string,
  uploadGrant: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; message?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/student-upload/codes/${encodeURIComponent(code)}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, status: xhr.status });
      } else {
        let message: string | undefined;
        try {
          const body = JSON.parse(xhr.responseText);
          message = body?.message ?? body?.error;
        } catch {
          message = undefined;
        }
        resolve({ ok: false, status: xhr.status, message });
      }
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, message: "Network error" });
    const fd = new FormData();
    fd.append("studentName", studentName);
    fd.append("uploadGrant", uploadGrant);
    fd.append("file", file);
    xhr.send(fd);
  });
}

const NAME_STORAGE_PREFIX = "offloadr.studentUpload.name.";

export default function StudentUploadSession() {
  const { code: codeParam } = useParams<{ code: string }>();
  const code = (codeParam ?? "").toUpperCase();

  const [resolution, setResolution] = useState<StudentUploadCodeResolution | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  const nameStorageKey = `${NAME_STORAGE_PREFIX}${code}`;
  const [studentName, setStudentName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.sessionStorage.getItem(nameStorageKey) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const trimmed = studentName.trim();
      if (trimmed.length > 0) {
        window.sessionStorage.setItem(nameStorageKey, studentName);
      } else {
        window.sessionStorage.removeItem(nameStorageKey);
      }
    } catch {
      /* sessionStorage may be unavailable (private mode, etc.) */
    }
  }, [nameStorageKey, studentName]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Local mirror of the student's workflow choice. Seeded from the
  // resolution (so coming back to the page shows what was already
  // picked) and overwritten on a successful mutation.
  const [workflowChoice, setWorkflowChoice] = useState<StudentWorkflowChoice | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  useEffect(() => {
    if (resolution?.studentWorkflowChoice) {
      setWorkflowChoice(resolution.studentWorkflowChoice);
    }
  }, [resolution?.studentWorkflowChoice]);

  const setWorkflowChoiceMutation = useSetStudentWorkflowChoice();
  const submittingChoice = setWorkflowChoiceMutation.isPending;
  const pendingChoiceRef = useRef<StudentWorkflowChoice | null>(null);

  const pickWorkflow = (choice: StudentWorkflowChoice) => {
    if (!resolution || submittingChoice) return;
    pendingChoiceRef.current = choice;
    setChoiceError(null);
    setWorkflowChoiceMutation.mutate(
      { code, choice, uploadGrant: resolution.uploadGrant },
      {
        onSuccess: (res) => {
          setWorkflowChoice(res.studentWorkflowChoice);
          pendingChoiceRef.current = null;
        },
        onError: (err) => {
          const data =
            err instanceof ApiError ? (err.data as { message?: string } | null) : null;
          setChoiceError(
            data?.message ?? "Couldn't save your choice. Check your connection and try again.",
          );
          pendingChoiceRef.current = null;
        },
      },
    );
  };

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    customFetch<StudentUploadCodeResolution>(
      `/api/student-upload/codes/${encodeURIComponent(code)}`,
    )
      .then((body) => {
        if (cancelled) return;
        setResolution(body);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          const data = err.data as { message?: string } | null;
          setResolveError(
            data?.message ?? "This code isn't active. Ask your teacher for a fresh one.",
          );
        } else {
          setResolveError("Couldn't reach the server. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => { cancelled = true; };
  }, [code]);

  const onPickFiles = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const next: UploadItem[] = Array.from(picked).map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      status: "queued",
      progress: 0,
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id || i.status === "uploading"));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resolution) return;
    const trimmed = studentName.trim();
    if (trimmed.length < 1 || trimmed.length > 120) return;
    const queued = items.filter((i) => i.status === "queued" || i.status === "error");
    if (queued.length === 0) return;

    setUploading(true);
    for (const item of queued) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "uploading", progress: 0, errorMessage: undefined } : i)));
      const result = await uploadOne(code, trimmed, resolution.uploadGrant, item.file, (pct) => {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i)));
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? result.ok
              ? { ...i, status: "done", progress: 100 }
              : { ...i, status: "error", errorMessage: result.message ?? `Upload failed (${result.status})` }
            : i,
        ),
      );
      if (result.ok && resolution.uploadsRemaining != null) {
        setResolution((r) =>
          r && r.uploadsRemaining != null
            ? { ...r, uploadsRemaining: Math.max(0, r.uploadsRemaining - 1) }
            : r,
        );
      }
    }
    setUploading(false);
  };

  const allDone = items.length > 0 && items.every((i) => i.status === "done");
  // Has at least one successful upload — independent of stragglers/errors.
  // The chooser uses this so a flaky retry doesn't hide the picker.
  const hasAnySuccess = items.some((i) => i.status === "done");
  const hasQueued = items.some((i) => i.status === "queued" || i.status === "error");
  const nameValid = studentName.trim().length >= 1 && studentName.trim().length <= 120;

  return (
    <div className="portal-bg dark min-h-screen flex flex-col text-zinc-100">
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto max-w-3xl flex h-16 items-center justify-between px-4 sm:px-6">
          <PortalLogo />
          <Link href="/student-upload">
            <button
              type="button"
              className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Use a different code
            </button>
          </Link>
        </div>
      </header>
      <main className="relative z-10 flex-1 flex justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6">
          {resolving ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : resolveError ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Code not active
                </CardTitle>
                <CardDescription>{resolveError}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/student-upload">
                  <Button>Try a different code</Button>
                </Link>
              </CardContent>
            </Card>
          ) : resolution ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle data-testid="text-student-session-project">
                    {resolution.projectName}
                  </CardTitle>
                  <CardDescription>
                    {resolution.organizationDisplayName} &middot; code{" "}
                    <span className="font-mono uppercase">{resolution.code}</span>
                    {resolution.uploadsRemaining != null && (
                      <> &middot; {resolution.uploadsRemaining} upload{resolution.uploadsRemaining === 1 ? "" : "s"} remaining</>
                    )}
                  </CardDescription>
                </CardHeader>
                {resolution.studentInstructions && resolution.studentInstructions.trim() && (
                  <CardContent>
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        From your teacher
                      </div>
                      {resolution.studentInstructions}
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="studentName">Your name</Label>
                      <Input
                        id="studentName"
                        data-testid="input-student-name"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="First and last name"
                        maxLength={120}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Your teacher sees this next to every file you upload.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Files</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        data-testid="input-student-files"
                        onChange={(e) => {
                          onPickFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        data-testid="dropzone-student-files"
                        aria-label="Drop files here or click to choose"
                        onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
                        onKeyDown={(e) => {
                          if (uploading) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragCounterRef.current += 1;
                          if (!uploading) setIsDragging(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer) e.dataTransfer.dropEffect = uploading ? "none" : "copy";
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
                          if (dragCounterRef.current === 0) setIsDragging(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragCounterRef.current = 0;
                          setIsDragging(false);
                          if (uploading) return;
                          if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                            onPickFiles(e.dataTransfer.files);
                          }
                        }}
                        className={
                          "flex flex-col items-center justify-center gap-1 w-full h-32 rounded-md border-2 border-dashed cursor-pointer transition-colors " +
                          (uploading
                            ? "opacity-60 cursor-not-allowed border-border bg-muted/30"
                            : isDragging
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/60 hover:bg-muted/40")
                        }
                      >
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <div className="text-sm font-medium">
                          {isDragging ? "Drop to add files" : "Drag files here or click to choose"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          You can drop multiple files at once.
                        </div>
                      </div>

                      {items.length > 0 && (
                        <ul className="border rounded-md divide-y mt-3">
                          {items.map((item) => (
                            <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <div className="truncate font-medium">{item.file.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatBytes(item.file.size)}
                                  {item.status === "uploading" && ` · ${item.progress}%`}
                                  {item.status === "error" && item.errorMessage && ` · ${item.errorMessage}`}
                                </div>
                              </div>
                              {item.status === "done" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : item.status === "uploading" ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : item.status === "error" ? (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {allDone && (
                      <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>All files uploaded. Pick what happens next below — you can still upload more above.</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      data-testid="button-student-upload-submit"
                      className="w-full"
                      disabled={uploading || !nameValid || !hasQueued}
                    >
                      {uploading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <>Upload {items.filter((i) => i.status === "queued" || i.status === "error").length} file(s)</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Smart Draft chooser — appears once the student has at
                  least one successful upload, OR if they already made a
                  choice on a previous visit. Recording a choice does NOT
                  trigger provider work; it just tells the teacher what
                  the student wants. The teacher hits "Generate Smart
                  Draft" on their side when ready. */}
              {(hasAnySuccess || workflowChoice) && (
                workflowChoice ? (
                  <Card
                    className={
                      workflowChoice === "smart_draft"
                        ? "border-primary/50 bg-primary/5"
                        : "border-muted-foreground/30 bg-muted/30"
                    }
                    data-testid={`card-workflow-choice-confirmed-${workflowChoice}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {workflowChoice === "smart_draft" ? (
                          <Sparkles className="h-5 w-5 text-primary" />
                        ) : (
                          <Scissors className="h-5 w-5" />
                        )}
                        {workflowChoice === "smart_draft"
                          ? "Smart Draft on the way"
                          : "You'll edit this manually"}
                      </CardTitle>
                      <CardDescription>
                        {workflowChoice === "smart_draft"
                          ? "Offloadr will help your teacher put together a first draft from your footage. Your teacher gets the final say before it goes anywhere."
                          : "Your teacher will hand the footage back to you to edit. They'll let you know the next step in class."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        You're done here. You can close this page, or upload more files above.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card data-testid="card-workflow-chooser">
                    <CardHeader>
                      <CardTitle className="text-base">What happens next?</CardTitle>
                      <CardDescription>
                        Pick one. Your teacher will see your choice and take it from there.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <button
                        type="button"
                        data-testid="button-pick-smart-draft"
                        onClick={() => pickWorkflow("smart_draft")}
                        disabled={submittingChoice}
                        className="group relative w-full text-left rounded-lg border-2 border-primary/40 bg-primary/5 p-4 transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                          Recommended
                        </span>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
                            {submittingChoice && pendingChoiceRef.current === "smart_draft" ? (
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            ) : (
                              <Sparkles className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-16">
                            <div className="font-semibold">Smart Draft — recommended</div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Offloadr stitches your clips into a first-draft video automatically — title card, transitions, end card. Your teacher reviews it before anyone sees it.
                            </p>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        data-testid="button-pick-manual"
                        onClick={() => pickWorkflow("manual")}
                        disabled={submittingChoice}
                        className="group w-full text-left rounded-lg border-2 border-border bg-background p-4 transition-colors hover:border-foreground/30 hover:bg-muted/40 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                            {submittingChoice && pendingChoiceRef.current === "manual" ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Scissors className="h-5 w-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">I'll organise it myself</div>
                            <p className="text-sm text-muted-foreground mt-1">
                              You'd rather edit the video by hand. Your teacher will hand the footage back to you in class.
                            </p>
                          </div>
                        </div>
                      </button>

                      {choiceError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{choiceError}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
