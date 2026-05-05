import { MainLayout } from "@/components/layout/main-layout";
import {
  useGetProject,
  useListProjectFiles,
  useUploadFile,
  useUpdateFile,
  useDeleteFile,
  getGetProjectQueryKey,
  getListProjectFilesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useParams, useLocation } from "wouter";
import { useCallback, useRef, useState } from "react";
import { Loader2, Upload, X, FileAudio, FileVideo, FileImage, File, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const MEDIA_ROLES = [
  "Rodecaster Multitrack",
  "Stereo Mix",
  "Host Mic",
  "Guest Mic",
  "Program Video",
  "Camera 1",
  "Camera 2",
  "Camera 3",
  "Camera 4",
  "Camera ISO",
  "Screen Recording",
  "Project File",
  "Final Export",
  "Thumbnail",
  "Backup",
  "Other",
];

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

export default function ProjectUpload() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: files, isLoading: filesLoading } = useListProjectFiles(projectId, {
    query: { enabled: !!projectId, queryKey: getListProjectFilesQueryKey(projectId) },
  });

  const uploadFile = useUploadFile();
  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();

  const invalidateFiles = () => {
    queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    const arr = Array.from(fileList);
    for (const file of arr) {
      const key = `${file.name}-${Date.now()}`;
      setUploading((prev) => [...prev, key]);
      const formData = new FormData();
      formData.append("file", file);
      uploadFile.mutate(
        { id: projectId, data: formData as unknown as { file: Blob } },
        {
          onSuccess: () => {
            invalidateFiles();
            setUploading((prev) => prev.filter((k) => k !== key));
          },
          onError: () => {
            toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
            setUploading((prev) => prev.filter((k) => k !== key));
          },
        },
      );
    }
  }, [projectId, uploadFile, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

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
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
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
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground max-w-lg">
              {["WAV", "MP4", "MOV", "AIFF", "MP3", "PRPROJ", "FCPXML", "DRP", "AVI", "MXF"].map((ext) => (
                <Badge key={ext} variant="outline" className="text-xs font-mono">{ext}</Badge>
              ))}
            </div>
          </div>
          {uploading.length > 0 && (
            <div className="absolute inset-0 rounded-xl bg-background/80 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="font-medium">Uploading {uploading.length} file{uploading.length !== 1 ? "s" : ""}...</span>
              </div>
            </div>
          )}
        </div>

        {/* File list */}
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
                          {MEDIA_ROLES.map((role) => (
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
            <Button variant="outline">Back to Project</Button>
          </Link>
          <Link href={`/projects/${projectId}/handoff`}>
            <Button>Review and Create Handoff</Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
