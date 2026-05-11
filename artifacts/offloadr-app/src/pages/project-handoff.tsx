import { MainLayout } from "@/components/layout/main-layout";
import {
  useGetProject,
  useGetMissingFiles,
  useListProjectFiles,
  useListParticipants,
  useCreateEditorShare,
  getGetProjectQueryKey,
  getGetMissingFilesQueryKey,
  getListProjectFilesQueryKey,
  getListParticipantsQueryKey,
} from "@/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useParams } from "wouter";
import { Loader2, CheckCircle2, AlertTriangle, Copy, ArrowLeft, FolderOpen, FileAudio, FileVideo, File, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

function formatBytes(bytes: number) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function FileIcon({ type }: { type: string }) {
  if (type === "audio") return <FileAudio className="h-4 w-4 text-blue-500" />;
  if (type === "video") return <FileVideo className="h-4 w-4 text-purple-500" />;
  if (type === "image") return <FileImage className="h-4 w-4 text-green-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

const FOLDERS = [
  { id: "01_AUDIO", label: "01_AUDIO", types: ["audio"] as string[] },
  { id: "02_VIDEO", label: "02_VIDEO", types: ["video"] as string[] },
  { id: "03_PROJECT_FILES", label: "03_PROJECT_FILES", types: ["project_file"] as string[] },
  { id: "04_EXPORTS", label: "04_EXPORTS", types: ["export"] as string[] },
  { id: "05_NOTES", label: "05_NOTES", types: ["document"] as string[] },
];

export default function ProjectHandoff() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: missing } = useGetMissingFiles(projectId, {
    query: { enabled: !!projectId, queryKey: getGetMissingFilesQueryKey(projectId) },
  });
  const { data: files } = useListProjectFiles(projectId, {
    query: { enabled: !!projectId, queryKey: getListProjectFilesQueryKey(projectId) },
  });
  const { data: participants } = useListParticipants(projectId, {
    query: { enabled: !!projectId, queryKey: getListParticipantsQueryKey(projectId) },
  });

  const createShare = useCreateEditorShare();

  const handleCreateShare = () => {
    createShare.mutate({ id: projectId, data: {} }, {
      onSuccess: (share) => {
        const url = `${window.location.origin}/share/${share.shareToken}`;
        setShareUrl(url);
        navigator.clipboard.writeText(url).then(() => {
          toast({ title: "Editor link copied to clipboard" });
        });
      },
      onError: () => toast({ title: "Failed to create share link", variant: "destructive" }),
    });
  };

  const copyShareUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({ title: "Link copied" });
    });
  };

  const getFilesForFolder = (types: string[]) =>
    (files ?? []).filter((f) => types.includes(f.fileType));

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Project Ready for Editor</h1>
        </div>

        {/* Status banner */}
        {missing && (
          <div className={`rounded-xl p-6 border-2 ${missing.allPresent ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${missing.allPresent ? "bg-green-100" : "bg-amber-100"}`}>
                {missing.allPresent
                  ? <CheckCircle2 className="h-6 w-6 text-green-600" />
                  : <AlertTriangle className="h-6 w-6 text-amber-600" />
                }
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {missing.allPresent ? "All files accounted for" : "Some files may be missing"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {missing.allPresent
                    ? "The project contains all required files for editing."
                    : "Review the checklist below before sending the editor link."
                  }
                </p>
                {!missing.allPresent && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {missing.items.filter((i) => !i.present).map((item) => (
                      <Badge key={item.label} variant="outline" className="text-amber-700 border-amber-300">
                        Missing: {item.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{project?.fileCount ?? 0}</div>
                  <p className="text-sm text-muted-foreground">Files uploaded</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{formatBytes(project?.totalSize ?? 0)}</div>
                  <p className="text-sm text-muted-foreground">Total project size</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{participants?.length ?? 0}</div>
                  <p className="text-sm text-muted-foreground">Participants</p>
                </CardContent>
              </Card>
            </div>

            {/* Folder structure */}
            <Card>
              <CardHeader>
                <CardTitle>Folder Structure</CardTitle>
                <CardDescription>Files organised by type. The editor will see this layout on the handoff page.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {FOLDERS.map((folder) => {
                    const folderFiles = getFilesForFolder(folder.types);
                    return (
                      <div key={folder.id} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                          <FolderOpen className="h-4 w-4 text-amber-500" />
                          <span className="font-mono text-xs font-semibold">{folder.label}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">{folderFiles.length}</Badge>
                        </div>
                        {folderFiles.length > 0 && (
                          <div className="divide-y">
                            {folderFiles.map((f) => (
                              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                                <FileIcon type={f.fileType} />
                                <span className="text-xs flex-1 truncate">{f.originalFileName}</span>
                                {f.mediaRole && <Badge variant="outline" className="text-xs">{f.mediaRole}</Badge>}
                                <span className="text-xs text-muted-foreground">{formatBytes(Number(f.fileSize))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Editor notes */}
            {project?.editorNotes && (
              <Card>
                <CardHeader><CardTitle>Editor Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{project.editorNotes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Share */}
          <div className="space-y-4">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Editor Handoff Link</CardTitle>
                <CardDescription>
                  A private link that gives the editor read-only access to the project — files, notes, and structure.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {shareUrl ? (
                  <>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs font-mono break-all text-foreground">{shareUrl}</p>
                    </div>
                    <Button className="w-full gap-2" onClick={copyShareUrl}>
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={handleCreateShare}
                    disabled={createShare.isPending}
                  >
                    {createShare.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Copy className="h-4 w-4" />
                    }
                    Create Editor Link
                  </Button>
                )}
              </CardContent>
            </Card>

            {project && (
              <Card>
                <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {project.episodeTitle && (
                    <div>
                      <div className="text-xs text-muted-foreground">Episode</div>
                      <div>{project.episodeTitle}</div>
                    </div>
                  )}
                  {project.clientName && (
                    <div>
                      <div className="text-xs text-muted-foreground">Client</div>
                      <div>{project.clientName}</div>
                    </div>
                  )}
                  {project.recordingDate && (
                    <div>
                      <div className="text-xs text-muted-foreground">Recorded</div>
                      <div>{project.recordingDate}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
