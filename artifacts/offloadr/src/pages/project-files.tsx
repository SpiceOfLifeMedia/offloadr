import { MainLayout } from "@/components/layout/main-layout";
import {
  useGetProject,
  useListProjectFiles,
  useUpdateFile,
  useDeleteFile,
  getGetProjectQueryKey,
  getListProjectFilesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useParams } from "wouter";
import { Loader2, FileAudio, FileVideo, FileImage, File, FolderOpen, ArrowLeft, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const MEDIA_ROLES = [
  "Rodecaster Multitrack", "Stereo Mix", "Host Mic", "Guest Mic",
  "Program Video", "Camera 1", "Camera 2", "Camera 3", "Camera 4",
  "Camera ISO", "Screen Recording", "Project File", "Final Export",
  "Thumbnail", "Backup", "Other",
];

const FOLDER_STRUCTURE = [
  { id: "01_AUDIO", label: "01_AUDIO", types: ["audio"], roles: ["Rodecaster Multitrack", "Stereo Mix", "Host Mic", "Guest Mic"] },
  { id: "02_VIDEO", label: "02_VIDEO", types: ["video"], roles: ["Program Video", "Camera 1", "Camera 2", "Camera 3", "Camera 4", "Camera ISO", "Screen Recording"] },
  { id: "03_PROJECT_FILES", label: "03_PROJECT_FILES", types: ["project_file"], roles: ["Project File"] },
  { id: "04_EXPORTS", label: "04_EXPORTS", types: ["export"], roles: ["Final Export"] },
  { id: "05_NOTES", label: "05_NOTES", types: ["document"], roles: [] },
  { id: "UNTAGGED", label: "Untagged / Other", types: [], roles: ["Other", "Thumbnail", "Backup"] },
];

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

  const getFilesForFolder = (folder: typeof FOLDER_STRUCTURE[0]) => {
    if (!files) return [];
    if (folder.id === "UNTAGGED") {
      return files.filter((f) => {
        const inOtherFolder = FOLDER_STRUCTURE.slice(0, -1).some(
          (other) =>
            other.types.includes(f.fileType) ||
            (f.mediaRole && other.roles.includes(f.mediaRole)),
        );
        return !inOtherFolder;
      });
    }
    return files.filter(
      (f) => folder.types.includes(f.fileType) || (f.mediaRole && folder.roles.includes(f.mediaRole)),
    );
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
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">File Structure</h1>
            {project && <p className="text-muted-foreground mt-1">{project.projectName}</p>}
          </div>
          <Link href={`/projects/${projectId}/upload`}>
            <Button variant="outline">Upload More</Button>
          </Link>
        </div>

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
            {FOLDER_STRUCTURE.map((folder) => {
              const folderFiles = getFilesForFolder(folder);
              if (folderFiles.length === 0 && folder.id === "UNTAGGED") return null;
              return (
                <div key={folder.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                    <span className="font-mono text-sm font-semibold">{folder.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {folderFiles.length} file{folderFiles.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {folderFiles.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No files in this folder</div>
                  ) : (
                    <div className="divide-y">
                      {folderFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                          <FileIcon type={file.fileType} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{file.originalFileName}</div>
                            <div className="text-xs text-muted-foreground">{formatBytes(Number(file.fileSize))}</div>
                          </div>
                          <div className="w-44 flex-shrink-0">
                            <Select
                              value={file.mediaRole ?? ""}
                              onValueChange={(v) => handleRoleChange(file.id, v)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Tag role..." />
                              </SelectTrigger>
                              <SelectContent>
                                {MEDIA_ROLES.map((role) => (
                                  <SelectItem key={role} value={role} className="text-xs">{role}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                            onClick={() => handleDelete(file.id, file.originalFileName)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
