import { useRef, useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import {
  useGetProject,
  useListProjectFiles,
  useUpdateFile,
  useDeleteFile,
  uploadFile,
  getGetProjectQueryKey,
  getListProjectFilesQueryKey,
} from "@/api-client";
import type { MediaFile } from "@/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link, useParams } from "wouter";
import {
  Loader2,
  FileAudio,
  FileVideo,
  FileImage,
  File,
  ArrowLeft,
  X,
  AlertTriangle,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getMediaRolesForWorkflow } from "@/lib/workflow-tags";

const TEACHER_BUCKET_LABEL = "Teacher / unassigned uploads";

function formatBytes(bytes: number) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function FileIcon({ type, missing }: { type: string; missing?: boolean }) {
  const muted = missing ? "text-muted-foreground/40" : "";
  if (type === "audio") return <FileAudio className={`h-4 w-4 ${missing ? muted : "text-blue-500"}`} />;
  if (type === "video") return <FileVideo className={`h-4 w-4 ${missing ? muted : "text-purple-500"}`} />;
  if (type === "image") return <FileImage className={`h-4 w-4 ${missing ? muted : "text-green-500"}`} />;
  return <File className={`h-4 w-4 ${missing ? muted : "text-muted-foreground"}`} />;
}

export default function ProjectFiles() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: files, isLoading } = useListProjectFiles(projectId, {
    query: { enabled: !!projectId, queryKey: getListProjectFilesQueryKey(projectId) },
  });

  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();
  const replaceUpload = useMutation({
    mutationFn: ({ id: pid, formData }: { id: number; formData: FormData }) =>
      uploadFile(pid, { body: formData }),
  });

  const replaceInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MediaFile | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
  };

  const handleRoleChange = (fileId: number, role: string) => {
    updateFile.mutate({ id: fileId, data: { mediaRole: role } }, { onSuccess: invalidate });
  };

  const handleDelete = (fileId: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteFile.mutate({ id: fileId }, {
      onSuccess: () => { toast({ title: "File deleted" }); invalidate(); },
    });
  };

  const handleRemoveMissing = (file: MediaFile) => {
    deleteFile.mutate(
      { id: file.id },
      {
        onSuccess: () => {
          toast({ title: "Reference removed", description: `Cleared "${file.originalFileName}" from this project.` });
          invalidate();
          setConfirmRemove(null);
        },
        onError: () => {
          toast({ title: "Couldn't remove reference", variant: "destructive" });
          setConfirmRemove(null);
        },
      },
    );
  };

  const handleReplace = (file: MediaFile, picked: File) => {
    setReplacingId(file.id);
    const formData = new FormData();
    formData.append("file", picked);
    if (file.mediaRole) formData.append("mediaRole", file.mediaRole);
    if (file.notes) formData.append("notes", file.notes);

    replaceUpload.mutate(
      { id: projectId, formData },
      {
        onSuccess: () => {
          deleteFile.mutate(
            { id: file.id },
            {
              onSettled: () => {
                setReplacingId(null);
                invalidate();
                toast({ title: "File replaced", description: `Re-uploaded "${picked.name}".` });
              },
            },
          );
        },
        onError: () => {
          setReplacingId(null);
          toast({ title: `Failed to upload ${picked.name}`, variant: "destructive" });
        },
      },
    );
  };

  const groupedByStudent = (() => {
    const map = new Map<string, MediaFile[]>();
    const order: string[] = [];
    for (const f of files ?? []) {
      const isStudent = f.uploaderKind === "student";
      const key = isStudent && f.studentUploaderName
        ? f.studentUploaderName.trim()
        : TEACHER_BUCKET_LABEL;
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(f);
    }
    // Push the teacher bucket to the end
    return order
      .sort((a, b) => {
        if (a === TEACHER_BUCKET_LABEL) return 1;
        if (b === TEACHER_BUCKET_LABEL) return -1;
        return a.localeCompare(b);
      })
      .map((key) => ({ key, files: map.get(key)! }));
  })();

  const missingCount = files?.filter((f) => f.isMissing).length ?? 0;

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Student uploads</h1>
            {project && <p className="text-muted-foreground mt-1">{project.projectName}</p>}
          </div>
          <Link href={`/projects/${projectId}/upload`}>
            <Button variant="outline">Upload More</Button>
          </Link>
        </div>

        {missingCount > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-100">
              <div className="font-medium">
                {missingCount} file{missingCount !== 1 ? "s" : ""} from this project can't be downloaded
              </div>
              <div className="text-amber-800/90 dark:text-amber-200/90 mt-0.5">
                These files were uploaded before Offloadr moved to durable storage and the original copies are no longer available.
                Re-upload to restore them, or remove the references if you don't need them anymore.
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !files || files.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No files uploaded yet</p>
            <Link href={`/projects/${projectId}/upload`}>
              <Button className="mt-4">Upload Files</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByStudent.map((group) => {
              const isTeacher = group.key === TEACHER_BUCKET_LABEL;
              const totalBytes = group.files.reduce((acc, f) => acc + Number(f.fileSize), 0);
              return (
                <div key={group.key} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
                    <UserIcon className={`h-4 w-4 ${isTeacher ? "text-muted-foreground" : "text-primary"}`} />
                    <span className={`text-sm font-semibold ${isTeacher ? "text-muted-foreground" : ""}`}>
                      {group.key}
                    </span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {group.files.length} file{group.files.length !== 1 ? "s" : ""} · {formatBytes(totalBytes)}
                    </Badge>
                  </div>
                  {group.files.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No files in this group</div>
                  ) : (
                    <div className="divide-y">
                      {group.files.map((file) => {
                        const missing = !!file.isMissing;
                        const isReplacing = replacingId === file.id;
                        return (
                          <div
                            key={file.id}
                            className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                              missing ? "bg-amber-50/40 dark:bg-amber-950/10" : "hover:bg-muted/20"
                            }`}
                          >
                            <FileIcon type={file.fileType} missing={missing} />
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-sm font-medium truncate ${
                                  missing ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""
                                }`}
                              >
                                {file.originalFileName}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {missing ? (
                                  <>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-700 dark:text-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30"
                                    >
                                      Missing
                                    </Badge>
                                    <span>Original file no longer in storage — re-upload to restore.</span>
                                  </>
                                ) : (
                                  <span>{formatBytes(Number(file.fileSize))}</span>
                                )}
                              </div>
                            </div>
                            <div className="w-44 flex-shrink-0">
                              <Select
                                value={file.mediaRole ?? ""}
                                onValueChange={(v) => handleRoleChange(file.id, v)}
                                disabled={missing}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder={missing ? "—" : "Tag role..."} />
                                </SelectTrigger>
                                <SelectContent>
                                  {getMediaRolesForWorkflow(project?.projectWorkflowType).map((role) => (
                                    <SelectItem key={role} value={role} className="text-xs">{role}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {missing ? (
                              <>
                                <input
                                  ref={(el) => { replaceInputs.current[file.id] = el; }}
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const picked = e.target.files?.[0];
                                    if (picked) handleReplace(file, picked);
                                    e.target.value = "";
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs flex-shrink-0 gap-1"
                                  disabled={isReplacing}
                                  onClick={() => replaceInputs.current[file.id]?.click()}
                                >
                                  {isReplacing ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Uploading
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-3 w-3" />
                                      Replace
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Remove this missing file reference"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                                  disabled={isReplacing}
                                  onClick={() => setConfirmRemove(file)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                                onClick={() => handleDelete(file.id, file.originalFileName)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!confirmRemove}
        onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove missing file reference?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the entry for{" "}
              <span className="font-medium text-foreground">
                "{confirmRemove?.originalFileName}"
              </span>{" "}
              from your project. The original file is already gone from storage, so nothing else will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmRemove) handleRemoveMissing(confirmRemove); }}
            >
              Remove reference
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
