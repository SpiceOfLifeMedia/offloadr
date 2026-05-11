import {
  useGetEditorShare,
  getGetEditorShareQueryKey,
} from "@/api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams } from "wouter";
import { Loader2, FileAudio, FileVideo, FileImage, File, FolderOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

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

export default function SharePage() {
  const { token } = useParams<{ token: string }>();

  const { data: handoff, isLoading, error } = useGetEditorShare(token, {
    query: {
      enabled: !!token,
      queryKey: getGetEditorShareQueryKey(token),
      retry: false,
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !handoff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold">Link not found</h1>
          <p className="text-muted-foreground mt-2">
            This editor link may have expired or been disabled.
          </p>
        </div>
      </div>
    );
  }

  const { project, files, participants } = handoff;

  const getFilesForFolder = (types: string[]) =>
    files.filter((f) => types.includes(f.fileType));

  const untaggedFiles = files.filter(
    (f) => !FOLDERS.some((folder) => folder.types.includes(f.fileType)),
  );

  const hasAudio = files.some((f) => f.fileType === "audio");
  const hasVideo = files.some((f) => f.fileType === "video");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">Offloadr</div>
          <Badge variant="secondary">Editor Handoff</Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Project header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.projectName}</h1>
          {project.episodeTitle && (
            <p className="text-xl text-muted-foreground mt-1">{project.episodeTitle}</p>
          )}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            {project.clientName && (
              <div><span className="font-medium text-foreground">Client:</span> {project.clientName}</div>
            )}
            {project.recordingDate && (
              <div><span className="font-medium text-foreground">Recorded:</span> {project.recordingDate}</div>
            )}
            <div><span className="font-medium text-foreground">Files:</span> {project.fileCount}</div>
            <div><span className="font-medium text-foreground">Size:</span> {formatBytes(project.totalSize)}</div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            {/* Editor notes */}
            {project.editorNotes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes from Producer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.editorNotes}</p>
                </CardContent>
              </Card>
            )}

            {/* File tree */}
            <Card>
              <CardHeader>
                <CardTitle>Project Files</CardTitle>
                <CardDescription>All files organised by type. Download links available for each file.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {FOLDERS.map((folder) => {
                    const folderFiles = getFilesForFolder(folder.types);
                    if (folderFiles.length === 0) return null;
                    return (
                      <div key={folder.id} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                          <FolderOpen className="h-4 w-4 text-amber-500" />
                          <span className="font-mono text-xs font-semibold">{folder.label}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">{folderFiles.length}</Badge>
                        </div>
                        <div className="divide-y">
                          {folderFiles.map((f) => (
                            <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                              <FileIcon type={f.fileType} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{f.originalFileName}</div>
                                <div className="text-xs text-muted-foreground flex gap-2">
                                  <span>{formatBytes(Number(f.fileSize))}</span>
                                  {f.mediaRole && <span>• {f.mediaRole}</span>}
                                </div>
                              </div>
                              {f.isMissing ? (
                                <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
                                  Missing — please ask producer to re-upload
                                </span>
                              ) : f.publicUrl ? (
                                <a
                                  href={`${f.publicUrl}?share=${encodeURIComponent(token)}`}
                                  download={f.originalFileName}
                                  className="text-xs text-primary hover:underline flex-shrink-0"
                                >
                                  Download
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {untaggedFiles.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-xs font-semibold">Other</span>
                        <Badge variant="secondary" className="ml-auto text-xs">{untaggedFiles.length}</Badge>
                      </div>
                      <div className="divide-y">
                        {untaggedFiles.map((f) => (
                          <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                            <FileIcon type={f.fileType} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{f.originalFileName}</div>
                              <div className="text-xs text-muted-foreground">{formatBytes(Number(f.fileSize))}</div>
                            </div>
                            {f.isMissing ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
                                Missing — please ask producer to re-upload
                              </span>
                            ) : f.publicUrl ? (
                              <a href={`${f.publicUrl}?share=${encodeURIComponent(token)}`} download className="text-xs text-primary hover:underline flex-shrink-0">
                                Download
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Quick reference */}
            <Card>
              <CardHeader><CardTitle>Quick Reference</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audio files</span>
                  <span>{files.filter((f) => f.fileType === "audio").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Video files</span>
                  <span>{files.filter((f) => f.fileType === "video").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project files</span>
                  <span>{files.filter((f) => f.fileType === "project_file").length}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatBytes(project.totalSize)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Participants */}
            {participants && participants.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Participants</CardTitle></CardHeader>
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
                        {p.notes && <div className="text-xs text-muted-foreground mt-0.5">{p.notes}</div>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground text-center pt-2">
              Delivered via Offloadr
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
