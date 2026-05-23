import { MainLayout } from "@/components/layout/main-layout";
import { useGetDashboardStats, useListProjects } from "@/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, FileBox, HardDrive, AlertCircle, Loader2, GraduationCap } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft': return <Badge variant="secondary">Draft</Badge>;
    case 'uploading': return <Badge variant="default" className="bg-blue-500">Uploading</Badge>;
    case 'review_needed': return <Badge variant="destructive">Review Needed</Badge>;
    case 'ready_for_editor': return <Badge variant="default" className="bg-green-600">Ready</Badge>;
    case 'delivered': return <Badge variant="outline">Delivered</Badge>;
    case 'archived': return <Badge variant="secondary">Archived</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { user } = useAuth();
  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] || "there";
  const isStaff = user?.role === "ems_staff";

  return (
    <MainLayout>
      <div className="flex-1 space-y-6 p-8 overflow-y-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight">Welcome back, {firstName}</h2>
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <GraduationCap className="h-3 w-3" />
                {isStaff ? "Staff Account" : "Teacher Account"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Your class media projects and recent student uploads.
            </p>
          </div>
          <Link href="/projects/new">
            <Button>Create Project</Button>
          </Link>
        </div>

        {statsLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Uploads</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeUploads || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                <FileBox className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalFiles || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(stats?.totalStorageBytes || 0)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-xl font-bold tracking-tight">Recent Projects</h3>
          {projectsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border bg-card text-card-foreground">
              {projects && projects.length > 0 ? (
                <div className="divide-y">
                  {projects.map((project) => {
                    const meta = [
                      project.classGroup,
                      project.lessonType,
                      project.dueDate ? `Due ${project.dueDate}` : null,
                    ].filter(Boolean).join(" • ");
                    return (
                      <div key={project.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="space-y-1 min-w-0">
                          <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                            {project.projectName}
                          </Link>
                          <div className="text-sm text-muted-foreground truncate">
                            {meta || project.clientName || "No class assigned"}
                            <span className="text-muted-foreground/60"> • {new Date(project.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-muted-foreground">
                            {project.fileCount} files ({formatBytes(project.totalSize)})
                          </div>
                          <StatusBadge status={project.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No projects found. Create your first project to get started.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}