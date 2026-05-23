import { MainLayout } from "@/components/layout/main-layout";
import {
  useGetProject,
  useListParticipants,
  useListActivity,
  useArchiveProject,
  useDeleteProject,
  useSubmitProject,
  useApproveProject,
  useRejectProject,
  useReopenProject,
  useRefreshRenderJob,
  type RenderJob,
  useCreateFinalVideo,
  useListRenderJobs,
  getListRenderJobsQueryKey,
  useListStudentUploadCodes,
  useCreateStudentUploadCode,
  useCloseStudentUploadCode,
  useRegenerateStudentUploadCode,
  useGetProjectUploaderSummary,
  getGetProjectQueryKey,
  getListParticipantsQueryKey,
  getListActivityQueryKey,
  getListStudentUploadCodesQueryKey,
  getGetProjectUploaderSummaryQueryKey,
} from "@/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation, useParams } from "wouter";
import { Loader2, Users, Activity, CheckCircle2, Copy, ArrowLeft, Trash2, GraduationCap, QrCode, X, RefreshCw, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatBytes(bytes: number) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
    uploading: { label: "Uploading", className: "bg-blue-100 text-blue-800" },
    review_needed: { label: "Review Needed", className: "bg-red-100 text-red-800" },
    ready_for_editor: { label: "Ready for Editor", className: "bg-green-100 text-green-800" },
    delivered: { label: "Delivered", className: "bg-purple-100 text-purple-800" },
    archived: { label: "Archived", className: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? { label: status, className: "" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

function SubmissionBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
    needs_review: { label: "Awaiting teacher review", className: "bg-amber-100 text-amber-800" },
    approved: { label: "Approved", className: "bg-green-100 text-green-800" },
    rejected: { label: "Sent back to student", className: "bg-red-100 text-red-800" },
    exported: { label: "Exported", className: "bg-purple-100 text-purple-800" },
  };
  const s = map[status ?? "draft"] ?? { label: status ?? "draft", className: "" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

function RenderJobBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: "Queued", className: "bg-secondary text-secondary-foreground" },
    submitted: { label: "Submitted", className: "bg-blue-100 text-blue-800" },
    processing: { label: "Processing", className: "bg-amber-100 text-amber-800" },
    complete: { label: "Complete", className: "bg-green-100 text-green-800" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800" },
    not_configured: { label: "Provider not configured yet", className: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? { label: status, className: "" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: participants } = useListParticipants(projectId, {
    query: { enabled: !!projectId, queryKey: getListParticipantsQueryKey(projectId) },
  });
  const { data: activity } = useListActivity(projectId, {
    query: { enabled: !!projectId, queryKey: getListActivityQueryKey(projectId) },
  });

  const submitProject = useSubmitProject();
  const approveProject = useApproveProject();
  const rejectProject = useRejectProject();
  const reopenProject = useReopenProject();
  const createFinalVideo = useCreateFinalVideo();
  const refreshRenderJob = useRefreshRenderJob();
  const { data: renderJobs } = useListRenderJobs(projectId, {
    query: { queryKey: getListRenderJobsQueryKey(projectId), refetchInterval: 5000 },
  });
  const invalidateProjectAndJobs = () => {
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getListRenderJobsQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getListActivityQueryKey(projectId) });
  };

  // Automatically poll the provider for in-flight renders. The list
  // query above only re-reads the DB; without this hook a Shotstack
  // render would stay "submitted" in the UI until the teacher clicked
  // Refresh by hand. Tick every 8s and only hit the provider for jobs
  // that aren't terminal — finished projects cost zero API calls.
  // Defensive: the API contract says this is RenderJob[], but if the
  // server ever returns an error envelope (or anything non-array) we
  // must NOT call .filter on it — optional chaining doesn't protect
  // against object-shaped values and React will unmount the whole tree.
  const renderJobsList: RenderJob[] = Array.isArray(renderJobs) ? renderJobs : [];
  if (renderJobs != null && !Array.isArray(renderJobs)) {
    // eslint-disable-next-line no-console
    console.error("[Offloadr] renderJobs is not an array:", renderJobs);
  }
  const inFlightKey = renderJobsList
    .filter((j) => j.status === "queued" || j.status === "submitted" || j.status === "processing")
    .map((j) => `${j.id}`)
    .join(",");
  React.useEffect(() => {
    if (renderJobsList.length === 0) return;
    const inFlight = renderJobsList.filter(
      (j) =>
        (j.status === "queued" || j.status === "submitted" || j.status === "processing") &&
        j.externalJobId,
    );
    if (inFlight.length === 0) return;
    const t = setInterval(() => {
      for (const j of inFlight) {
        refreshRenderJob.mutate(
          { projectId, jobId: j.id },
          { onSettled: invalidateProjectAndJobs },
        );
      }
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFlightKey, projectId]);

  const { data: studentCodes } = useListStudentUploadCodes(projectId, {
    query: { enabled: !!projectId, queryKey: getListStudentUploadCodesQueryKey(projectId) },
  });
  const createStudentCode = useCreateStudentUploadCode();
  const regenerateStudentCode = useRegenerateStudentUploadCode();
  const closeStudentCode = useCloseStudentUploadCode();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [studentCodeFormOpen, setStudentCodeFormOpen] = useState(false);
  const [studentCodeExpiresAt, setStudentCodeExpiresAt] = useState("");
  const [studentCodeMaxUploads, setStudentCodeMaxUploads] = useState("");

  const invalidateStudentCodes = () =>
    queryClient.invalidateQueries({ queryKey: getListStudentUploadCodesQueryKey(projectId) });

  const studentUploadUrl = (code: string) =>
    `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/student-upload/${code}`;

  const { data: uploaderSummary } = useGetProjectUploaderSummary(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectUploaderSummaryQueryKey(projectId),
      refetchInterval: 15000,
    },
  });

  const handleCopyInvite = async (code: string) => {
    const projectName = project?.projectName ?? "our class project";
    const link = studentUploadUrl(code);
    const message =
      `Hi — please upload your recordings for "${projectName}".\n\n` +
      `1. Open this link: ${link}\n` +
      `2. Or go to the student upload page and enter code: ${code}\n` +
      `3. Type your name so your teacher knows who uploaded what.\n\n` +
      `You don't need an account. Drag in your video / audio / image files and tap Upload.`;
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Invite copied", description: "Paste it into Teams, email, or your LMS." });
    } catch {
      toast({ title: "Couldn't copy invite", variant: "destructive" });
    }
  };

  const formatRelative = (iso: string | null | undefined) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    const diff = Date.now() - t;
    const mins = Math.round(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.round(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString();
  };

  const resetStudentCodeForm = () => {
    setStudentCodeFormOpen(false);
    setStudentCodeExpiresAt("");
    setStudentCodeMaxUploads("");
  };

  const handleCreateStudentCode = () => {
    const data: { expiresAt?: string | null; maxUploads?: number | null } = {};
    if (studentCodeExpiresAt) {
      // datetime-local has no timezone — interpret as local and send ISO.
      const d = new Date(studentCodeExpiresAt);
      if (Number.isNaN(d.getTime())) {
        toast({ title: "Invalid expiry date", variant: "destructive" });
        return;
      }
      data.expiresAt = d.toISOString();
    }
    if (studentCodeMaxUploads) {
      const n = parseInt(studentCodeMaxUploads, 10);
      if (!Number.isInteger(n) || n < 1 || n > 10000) {
        toast({ title: "Max uploads must be 1–10000", variant: "destructive" });
        return;
      }
      data.maxUploads = n;
    }
    createStudentCode.mutate(
      { projectId, data },
      {
        onSuccess: (created) => {
          invalidateStudentCodes();
          resetStudentCodeForm();
          toast({ title: `Code ${created.code} created`, description: "Share it with your students." });
        },
        onError: () => toast({ title: "Couldn't create code", variant: "destructive" }),
      },
    );
  };

  const handleRegenerateStudentCode = (codeId: number, code: string) => {
    if (!confirm(`Rotate code ${code}? The old code stops working immediately and a new one takes its place.`)) return;
    regenerateStudentCode.mutate(
      { codeId },
      {
        onSuccess: (created) => {
          invalidateStudentCodes();
          toast({ title: `Code rotated → ${created.code}`, description: "Share the new code with your students." });
        },
        onError: () => toast({ title: "Couldn't rotate code", variant: "destructive" }),
      },
    );
  };

  const handleCloseStudentCode = (codeId: number, code: string) => {
    if (!confirm(`Close code ${code}? Students using it won't be able to upload anymore.`)) return;
    closeStudentCode.mutate(
      { codeId },
      {
        onSuccess: () => { invalidateStudentCodes(); toast({ title: `Code ${code} closed` }); },
        onError: () => toast({ title: "Couldn't close code", variant: "destructive" }),
      },
    );
  };

  const handleCopyStudentLink = (code: string) => {
    navigator.clipboard.writeText(studentUploadUrl(code)).then(() => {
      toast({ title: "Link copied to clipboard" });
    });
  };

  const handleCopyStudentCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast({ title: `Code ${code} copied` });
    });
  };

  const archive = useArchiveProject();
  const deleteProject = useDeleteProject();

  const handleArchive = () => {
    archive.mutate({ id: projectId }, {
      onSuccess: () => { toast({ title: "Project archived" }); setLocation("/dashboard"); },
      onError: () => toast({ title: "Action failed", variant: "destructive" }),
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    deleteProject.mutate({ id: projectId }, {
      onSuccess: () => { toast({ title: "Project deleted" }); setLocation("/dashboard"); },
      onError: () => toast({ title: "Failed to delete project", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium">Project not found</p>
            <Link href="/dashboard"><Button className="mt-4">Back to Dashboard</Button></Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="mt-0.5">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{project.projectName}</h1>
                <StatusBadge status={project.status} />
              </div>
              <div className="mt-1 text-muted-foreground text-sm flex gap-3">
                {project.clientName && <span>{project.clientName}</span>}
                {project.recordingDate && <span>{project.recordingDate}</span>}
                <span>{project.fileCount} files</span>
                <span>{formatBytes(project.totalSize)}</span>
              </div>
            </div>
          </div>
          {/* Classroom mode: legacy Producer Mode / Upload Files / Handoff buttons hidden.
              Routes remain reachable directly via URL for power users. */}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column */}
          <div className="col-span-2 space-y-6">
            {/* Student upload codes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <CardTitle>Student upload codes</CardTitle>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setStudentCodeFormOpen((v) => !v)}
                    data-testid="button-toggle-student-code-form"
                    variant={studentCodeFormOpen ? "outline" : "default"}
                  >
                    {studentCodeFormOpen ? "Cancel" : "Generate code"}
                  </Button>
                </div>
                <CardDescription>
                  Hand out a code so students can upload into this project without an account. Codes can be rotated or closed anytime.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {studentCodeFormOpen && (
                  <div className="mb-4 border rounded-md p-3 space-y-3 bg-muted/30">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor="student-code-expires">
                          Expires (optional)
                        </label>
                        <input
                          id="student-code-expires"
                          type="datetime-local"
                          value={studentCodeExpiresAt}
                          onChange={(e) => setStudentCodeExpiresAt(e.target.value)}
                          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                          data-testid="input-student-code-expires"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor="student-code-max">
                          Max uploads (optional)
                        </label>
                        <input
                          id="student-code-max"
                          type="number"
                          min={1}
                          max={10000}
                          placeholder="No limit"
                          value={studentCodeMaxUploads}
                          onChange={(e) => setStudentCodeMaxUploads(e.target.value)}
                          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                          data-testid="input-student-code-max"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={resetStudentCodeForm}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateStudentCode}
                        disabled={createStudentCode.isPending}
                        data-testid="button-create-student-code"
                      >
                        {createStudentCode.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Create code"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {!studentCodes || studentCodes.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    No codes yet. Generate one to share with your class.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {studentCodes.map((c) => {
                      const closed = c.status === "closed";
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 border rounded-md px-3 py-2"
                          data-testid={`row-student-code-${c.code}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-base font-semibold tracking-widest ${closed ? "line-through text-muted-foreground" : ""}`}>
                                {c.code}
                              </span>
                              <Badge variant={closed ? "outline" : "secondary"} className="text-xs">
                                {closed ? "Closed" : "Active"}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {c.uploadCount} upload{c.uploadCount === 1 ? "" : "s"}
                              {c.maxUploads != null && ` / ${c.maxUploads}`}
                              {c.lastUploadAt
                                ? ` · last upload ${formatRelative(c.lastUploadAt)}`
                                : " · no uploads yet"}
                              {c.expiresAt && ` · expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                              {studentUploadUrl(c.code)}
                            </div>
                          </div>
                          {!closed && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => handleCopyStudentCode(c.code)}
                                data-testid={`button-copy-student-code-${c.code}`}
                                title="Copy code"
                              >
                                <Hash className="h-3.5 w-3.5" /> Copy code
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => handleCopyStudentLink(c.code)}
                                data-testid={`button-copy-student-link-${c.code}`}
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy link
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1.5"
                                onClick={() => handleCopyInvite(c.code)}
                                data-testid={`button-copy-invite-${c.code}`}
                                title="Copy a ready-to-paste invite message for students"
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy invite
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => setQrCode(c.code)}
                                data-testid={`button-qr-student-code-${c.code}`}
                              >
                                <QrCode className="h-3.5 w-3.5" /> QR
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleRegenerateStudentCode(c.id, c.code)}
                                title="Rotate code"
                                data-testid={`button-regenerate-student-code-${c.code}`}
                                disabled={regenerateStudentCode.isPending}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleCloseStudentCode(c.id, c.code)}
                                title="Close code"
                                data-testid={`button-close-student-code-${c.code}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Per-name uploads received. Aggregated from every code,
                    grouped by the name a student typed at upload time. Null
                    names are bucketed as "Unknown / no name" so teachers
                    can spot students who skipped the field. */}
                {uploaderSummary && uploaderSummary.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Uploads received
                    </div>
                    <ul className="space-y-1 text-sm">
                      {uploaderSummary.map((u, i) => {
                        const label = u.name ?? "Unknown / no name";
                        const rel = formatRelative(u.lastUploadAt);
                        return (
                          <li
                            key={`${u.name ?? "__unknown"}-${i}`}
                            className="flex items-center justify-between gap-3"
                            data-testid={`uploader-summary-row-${i}`}
                          >
                            <span className={u.name ? "" : "italic text-muted-foreground"}>
                              {label}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {u.fileCount} file{u.fileCount === 1 ? "" : "s"}
                              {rel && ` · ${rel}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={!!qrCode} onOpenChange={(o) => { if (!o) setQrCode(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Scan to upload</DialogTitle>
                  <DialogDescription>
                    Students can scan this code to open the upload page directly.
                  </DialogDescription>
                </DialogHeader>
                {qrCode && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="bg-white p-4 rounded-md">
                      <QRCodeSVG value={studentUploadUrl(qrCode)} size={220} />
                    </div>
                    <div className="font-mono text-lg tracking-widest">{qrCode}</div>
                    <div className="text-xs text-muted-foreground text-center break-all">
                      {studentUploadUrl(qrCode)}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCopyStudentLink(qrCode)} className="gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Copy link
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Upload status — slim view so teachers see what landed without
                opening the file browser. Header already shows totals; this
                surfaces a CTA to the full file structure. */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Upload status</CardTitle>
                <CardDescription>
                  {project.fileCount === 0
                    ? "No files uploaded yet. Share the upload code or link above with your class."
                    : `${project.fileCount} file${project.fileCount === 1 ? "" : "s"} uploaded so far — ${formatBytes(project.totalSize)} total.`}
                </CardDescription>
              </CardHeader>
              {project.fileCount > 0 && (
                <CardContent className="pt-0">
                  <Link href={`/projects/${projectId}/files`}>
                    <Button variant="outline" size="sm">View uploaded files</Button>
                  </Link>
                </CardContent>
              )}
            </Card>

            {/* Recording sessions + Editor notes cards removed for classroom mode. */}

            {/* Activity log */}
            {activity && activity.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <CardTitle>Activity</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {activity.slice(0, 8).map((log) => (
                      <div key={log.id} className="flex items-start justify-between text-sm">
                        <span className="text-foreground">{log.message}</span>
                        <span className="text-muted-foreground text-xs ml-4 flex-shrink-0">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Student's post-upload preference. Surfaced so the
                teacher knows whether the class asked Offloadr to start a
                draft or wants to edit manually. Provider work still
                requires the teacher to hit Generate Smart Draft below —
                this banner is purely informational. */}
            {project.studentWorkflowChoice && (
              <Card
                className={
                  project.studentWorkflowChoice === "smart_draft"
                    ? "border-primary/40 bg-primary/5"
                    : "border-muted-foreground/30 bg-muted/30"
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {project.studentWorkflowChoice === "smart_draft"
                      ? "Student asked for a Smart Draft"
                      : "Student wants to edit manually"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {project.studentWorkflowChoice === "smart_draft"
                      ? "Use the Final Video card below to render their draft when you're ready."
                      : "The student plans to edit by hand. You can still render a final video for them anytime from the card below."}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Final video — classroom flow.
                Class uploads → teacher clicks once → finished MP4 they can show in class. */}
            <Card>
              <CardHeader>
                <CardTitle>Final Video</CardTitle>
                <CardDescription>
                  Turn the class's uploads into one finished MP4 — title card, smooth
                  transitions, end card. Ready to show in class, send home, or share in
                  the school newsletter. We'll email the link when it's done.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  // Pick the most recent in-flight or complete final_render
                  // job to show at the top. Older jobs scroll below.
                  const finalJobs = renderJobsList.filter((j) => j.kind === "final_render");
                  // Cast through `unknown` to read the server-side decoration
                  // fields (`lifecycle`, `isMirrored`, `mirrorError`) the API
                  // attaches but that aren't part of the strict generated type.
                  // These fields are computed in routes/render-jobs.ts and are
                  // always present on the wire — see decorateRenderJobForResponse.
                  type DecoratedJob = (typeof finalJobs)[number] & {
                    lifecycle?: "preparing" | "rendering" | "ready" | "failed";
                    isMirrored?: boolean;
                    mirrorError?: string | null;
                  };
                  const decorated = finalJobs as unknown as DecoratedJob[];
                  const latest = decorated[0];
                  const uploadedCount = project.fileCount ?? 0;
                  const latestInFlight =
                    latest &&
                    (latest.status === "queued" ||
                      latest.status === "submitted" ||
                      latest.status === "processing");

                  // Lifecycle step the server tells us we're at, with sane
                  // fallbacks if the field hasn't propagated yet.
                  const lifecycle: "uploading" | "preparing" | "rendering" | "ready" | "failed" = !latest
                    ? "uploading"
                    : (latest.lifecycle ?? "preparing");
                  void uploadedCount;

                  // Live elapsed timer for in-flight renders. Re-renders on
                  // the existing 5s render-jobs poll, which is fine — no
                  // separate setInterval needed for "good enough" accuracy.
                  const elapsedMs = latest ? Date.now() - new Date(latest.createdAt).getTime() : 0;
                  const elapsedLabel = (() => {
                    const s = Math.max(0, Math.floor(elapsedMs / 1000));
                    const m = Math.floor(s / 60);
                    const r = s % 60;
                    return m > 0 ? `${m}m ${r.toString().padStart(2, "0")}s` : `${s}s`;
                  })();

                  // Static lifecycle indicator. Highlights the current step
                  // and dims future steps. Failed state collapses to a
                  // single destructive row instead of the 4-dot strip.
                  const LifecycleRow = () => {
                    if (lifecycle === "failed") {
                      return (
                        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                          Render failed. See error below.
                        </div>
                      );
                    }
                    const steps: Array<{ key: typeof lifecycle; label: string }> = [
                      { key: "uploading", label: "Footage" },
                      { key: "preparing", label: "Preparing" },
                      { key: "rendering", label: "Rendering" },
                      { key: "ready", label: "Ready" },
                    ];
                    const currentIdx = steps.findIndex((s) => s.key === lifecycle);
                    return (
                      <div className="flex items-center gap-1.5" data-testid="render-lifecycle">
                        {steps.map((s, i) => {
                          const done = i < currentIdx;
                          const active = i === currentIdx;
                          return (
                            <div key={s.key} className="flex flex-1 items-center gap-1.5">
                              <div
                                className={
                                  "h-2 flex-1 rounded " +
                                  (done
                                    ? "bg-primary"
                                    : active
                                      ? "bg-primary/60 animate-pulse"
                                      : "bg-muted")
                                }
                                aria-current={active ? "step" : undefined}
                              />
                              <span
                                className={
                                  "text-[10px] uppercase tracking-wide " +
                                  (done || active ? "text-foreground font-medium" : "text-muted-foreground")
                                }
                              >
                                {s.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  return (
                    <>
                      <LifecycleRow />

                      {latest && latestInFlight && (
                        <p className="text-xs text-muted-foreground">
                          Elapsed: {elapsedLabel} · Shotstack typically finishes a short school
                          report in 1–3 minutes. This page polls automatically; you can leave
                          it and come back — the email will arrive when it's done.
                        </p>
                      )}

                      <Button
                        size="lg"
                        className="w-full text-base"
                        data-testid="button-create-final-video"
                        onClick={() => {
                          createFinalVideo.mutate(
                            { projectId },
                            {
                              onSuccess: () => {
                                toast({
                                  title: "Final video render started",
                                  description:
                                    "Shotstack is rendering now. You'll get an email at info@edumediasystems.com.au when it's ready.",
                                });
                                invalidateProjectAndJobs();
                              },
                              onError: (err: unknown) => {
                                const e = err as { status?: number; data?: { code?: string; message?: string } };
                                const code = e?.data?.code;
                                const message = e?.data?.message;
                                if (code === "shotstack_not_configured") {
                                  toast({
                                    title: "Setup required: SHOTSTACK_API_KEY missing",
                                    description:
                                      "Final video rendering is not configured on the server. Set SHOTSTACK_API_KEY on Fly and redeploy.",
                                    variant: "destructive",
                                  });
                                } else if (code === "no_clips") {
                                  toast({
                                    title: "Upload some clips first",
                                    description:
                                      message ?? "No uploaded video clips found for this project yet.",
                                    variant: "destructive",
                                  });
                                } else {
                                  toast({
                                    title: "Could not start render",
                                    description: message ?? "Unknown error.",
                                    variant: "destructive",
                                  });
                                }
                              },
                            },
                          );
                        }}
                        disabled={createFinalVideo.isPending || Boolean(latestInFlight)}
                      >
                        {createFinalVideo.isPending || latestInFlight ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {latestInFlight ? "Rendering…" : "Create Final Video"}
                      </Button>

                      {latest && (
                        <div
                          className="rounded border p-3 text-xs space-y-2"
                          data-testid={`final-video-job-${latest.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">Latest render</span>
                            <RenderJobBadge status={latest.status} />
                          </div>
                          {latest.errorMessage && (
                            <div className="text-destructive">{latest.errorMessage}</div>
                          )}
                          {latestInFlight && (
                            <p className="text-muted-foreground">
                              Rendering through Shotstack. This usually takes 1–3 minutes
                              for a short school news report. The page polls automatically.
                            </p>
                          )}
                          {latest.status === "complete" && (latest.finalExportUrl ?? latest.previewUrl) && (
                            <div className="space-y-2">
                              <video
                                controls
                                preload="metadata"
                                src={latest.finalExportUrl ?? latest.previewUrl ?? undefined}
                                className="w-full rounded border bg-black"
                                data-testid={`video-final-${latest.id}`}
                              />
                              {latest.isMirrored ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Saved to project library — link refreshes automatically.
                                </p>
                              ) : latest.mirrorError ? (
                                <p
                                  className="text-[11px] text-amber-600"
                                  data-testid={`mirror-warning-${latest.id}`}
                                >
                                  Permanent copy not yet saved ({latest.mirrorError}).
                                  Playback will work for ~24h until the next poll retries the save.
                                </p>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">
                                  Saving a permanent copy to your project library…
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3">
                                <a
                                  className="inline-flex items-center rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                                  href={latest.finalExportUrl ?? latest.previewUrl ?? "#"}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  data-testid={`link-download-final-${latest.id}`}
                                >
                                  Download MP4
                                </a>
                                <button
                                  type="button"
                                  className="text-primary underline"
                                  onClick={() => {
                                    const url = latest.finalExportUrl ?? latest.previewUrl ?? "";
                                    if (!url) return;
                                    void navigator.clipboard.writeText(url);
                                    toast({ title: "Share link copied" });
                                  }}
                                  data-testid={`button-copy-final-${latest.id}`}
                                >
                                  Copy share link
                                </button>
                                <a
                                  className="text-primary underline"
                                  href={latest.finalExportUrl ?? latest.previewUrl ?? "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open in new tab
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {finalJobs.length > 1 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer">
                            Previous renders ({finalJobs.length - 1})
                          </summary>
                          <ul className="mt-2 space-y-1">
                            {finalJobs.slice(1, 6).map((j) => {
                              const url = j.finalExportUrl ?? j.previewUrl;
                              return (
                                <li key={j.id} className="flex items-center gap-2">
                                  <RenderJobBadge status={j.status} />
                                  <span>{new Date(j.createdAt).toLocaleString()}</span>
                                  {url && (
                                    <a className="text-primary underline" href={url} target="_blank" rel="noreferrer">
                                      open
                                    </a>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Teacher Review — moved to appear AFTER Final Video per classroom page structure. */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Teacher review</CardTitle>
                  <SubmissionBadge status={project.submissionStatus} />
                </div>
                <CardDescription>Students submit. Teachers approve.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(project.submissionStatus ?? "draft") === "draft" && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      submitProject.mutate(
                        { projectId },
                        {
                          onSuccess: () => {
                            toast({ title: "Sent for review" });
                            invalidateProjectAndJobs();
                          },
                          onError: () => toast({ title: "Could not submit", variant: "destructive" }),
                        },
                      );
                    }}
                    disabled={submitProject.isPending}
                  >
                    {submitProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit for teacher review
                  </Button>
                )}
                {project.submissionStatus === "needs_review" && (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => {
                        approveProject.mutate(
                          { projectId },
                          {
                            onSuccess: () => {
                              toast({ title: "Project approved" });
                              invalidateProjectAndJobs();
                            },
                            onError: () => toast({ title: "Could not approve", variant: "destructive" }),
                          },
                        );
                      }}
                      disabled={approveProject.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        rejectProject.mutate(
                          { projectId },
                          {
                            onSuccess: () => {
                              toast({ title: "Sent back to student" });
                              invalidateProjectAndJobs();
                            },
                            onError: () => toast({ title: "Could not reject", variant: "destructive" }),
                          },
                        );
                      }}
                      disabled={rejectProject.isPending}
                    >
                      Send back to student
                    </Button>
                  </>
                )}
                {(project.submissionStatus === "approved" ||
                  project.submissionStatus === "rejected" ||
                  project.submissionStatus === "exported") && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      reopenProject.mutate(
                        { projectId },
                        {
                          onSuccess: () => {
                            toast({ title: "Reopened" });
                            invalidateProjectAndJobs();
                          },
                          onError: () => toast({ title: "Could not reopen", variant: "destructive" }),
                        },
                      );
                    }}
                    disabled={reopenProject.isPending}
                  >
                    Reopen for changes
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Project actions — classroom mode keeps this minimal. */}
            <Card>
              <CardHeader>
                <CardTitle>Project actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleArchive}
                  disabled={archive.isPending}
                >
                  Archive project
                </Button>
                <Separator />
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive gap-2"
                  onClick={handleDelete}
                  disabled={deleteProject.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete project
                </Button>
              </CardContent>
            </Card>

            {/* Participants */}
            {participants && participants.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <CardTitle>Participants</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {participants.map((p) => (
                      <div key={p.id} className="text-sm">
                        <div className="font-medium">{p.name}</div>
                        {(p.role || p.micLabel) && (
                          <div className="text-muted-foreground text-xs">
                            {[p.role, p.micLabel].filter(Boolean).join(" — ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Project info */}
            <Card>
              <CardHeader><CardTitle>Setup</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {project.expectedCameraCount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cameras</span>
                    <span>{project.expectedCameraCount}</span>
                  </div>
                )}
                {project.expectedAudioSetup && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Audio</span>
                    <span className="text-right ml-4">{project.expectedAudioSetup}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
