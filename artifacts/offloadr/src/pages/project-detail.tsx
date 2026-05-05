import { MainLayout } from "@/components/layout/main-layout";
import {
  useGetProject,
  useGetMissingFiles,
  useListParticipants,
  useListActivity,
  useMarkProjectReady,
  useMarkProjectReview,
  useArchiveProject,
  useCreateEditorShare,
  useDeleteProject,
  getGetProjectQueryKey,
  getGetMissingFilesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation, useParams } from "wouter";
import { Loader2, Upload, FileText, Users, Activity, AlertTriangle, CheckCircle2, Copy, ArrowLeft, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: missing } = useGetMissingFiles(projectId, {
    query: { enabled: !!projectId, queryKey: getGetMissingFilesQueryKey(projectId) },
  });
  const { data: participants } = useListParticipants(projectId, {
    query: { enabled: !!projectId },
  });
  const { data: activity } = useListActivity(projectId, {
    query: { enabled: !!projectId },
  });

  const markReady = useMarkProjectReady();
  const markReview = useMarkProjectReview();
  const archive = useArchiveProject();
  const createShare = useCreateEditorShare();
  const deleteProject = useDeleteProject();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetMissingFilesQueryKey(projectId) });
  };

  const handleMarkReady = () => {
    markReady.mutate({ id: projectId }, {
      onSuccess: () => { toast({ title: "Project marked ready for editor" }); invalidate(); },
      onError: () => toast({ title: "Action failed", variant: "destructive" }),
    });
  };

  const handleMarkReview = () => {
    markReview.mutate({ id: projectId }, {
      onSuccess: () => { toast({ title: "Project marked as needing review" }); invalidate(); },
      onError: () => toast({ title: "Action failed", variant: "destructive" }),
    });
  };

  const handleArchive = () => {
    archive.mutate({ id: projectId }, {
      onSuccess: () => { toast({ title: "Project archived" }); setLocation("/dashboard"); },
      onError: () => toast({ title: "Action failed", variant: "destructive" }),
    });
  };

  const handleCreateShare = () => {
    createShare.mutate({ id: projectId, data: {} }, {
      onSuccess: (share) => {
        const url = `${window.location.origin}/share/${share.shareToken}`;
        navigator.clipboard.writeText(url).then(() => {
          toast({ title: "Editor link copied to clipboard" });
        });
      },
      onError: () => toast({ title: "Failed to create share link", variant: "destructive" }),
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
          <div className="flex gap-2 flex-shrink-0">
            <Link href={`/projects/${projectId}/upload`}>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Files
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/handoff`}>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Handoff
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column */}
          <div className="col-span-2 space-y-6">
            {/* Missing files */}
            {missing && (
              <Card className={missing.allPresent ? "border-green-200" : "border-amber-200"}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    {missing.allPresent ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                    <CardTitle className="text-base">
                      {missing.allPresent ? "All required files present" : "Missing files detected"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {missing.items.map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-sm">
                        {item.present ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        <span className={item.present ? "text-foreground" : "text-amber-700"}>
                          {item.label}
                          {item.required && !item.present && " (required)"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Files */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Files</CardTitle>
                  <Link href={`/projects/${projectId}/files`}>
                    <Button variant="ghost" size="sm">View all</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {project.fileCount === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No files uploaded yet.</p>
                    <Link href={`/projects/${projectId}/upload`}>
                      <Button className="mt-3" size="sm">Upload files</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {project.fileCount} files totalling {formatBytes(project.totalSize)}. 
                    <Link href={`/projects/${projectId}/files`} className="ml-1 text-primary underline">View file structure</Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Editor notes */}
            {project.editorNotes && (
              <Card>
                <CardHeader>
                  <CardTitle>Editor Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{project.editorNotes}</p>
                </CardContent>
              </Card>
            )}

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
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full gap-2"
                  onClick={handleMarkReady}
                  disabled={markReady.isPending || project.status === "ready_for_editor"}
                >
                  {markReady.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Mark Ready for Editor
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleCreateShare}
                  disabled={createShare.isPending}
                >
                  {createShare.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Create Editor Link
                </Button>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleMarkReview}
                  disabled={markReview.isPending}
                >
                  Flag for Review
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleArchive}
                  disabled={archive.isPending}
                >
                  Archive Project
                </Button>
                <Separator />
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive gap-2"
                  onClick={handleDelete}
                  disabled={deleteProject.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Project
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
