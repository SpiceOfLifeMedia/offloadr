import { MainLayout } from "@/components/layout/main-layout";
import { useCreateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProject = useCreateProject();

  const [form, setForm] = useState({
    projectName: "",
    episodeTitle: "",
    clientName: "",
    recordingDate: "",
    description: "",
    editorNotes: "",
    expectedCameraCount: "",
    expectedAudioSetup: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectName.trim()) {
      toast({ title: "Project name is required", variant: "destructive" });
      return;
    }
    createProject.mutate(
      {
        data: {
          projectName: form.projectName,
          episodeTitle: form.episodeTitle || undefined,
          clientName: form.clientName || undefined,
          recordingDate: form.recordingDate || undefined,
          description: form.description || undefined,
          editorNotes: form.editorNotes || undefined,
          expectedCameraCount: form.expectedCameraCount ? Number(form.expectedCameraCount) : undefined,
          expectedAudioSetup: form.expectedAudioSetup || undefined,
        },
      },
      {
        onSuccess: (project) => {
          toast({ title: "Project created" });
          setLocation(`/projects/${project.id}/upload`);
        },
        onError: () => {
          toast({ title: "Failed to create project", variant: "destructive" });
        },
      },
    );
  };

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
          <p className="mt-2 text-muted-foreground">
            Define the recording session before uploading files. The more detail you provide, the more useful the missing file checklist becomes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>Basic information about this recording session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project name <span className="text-destructive">*</span></Label>
                <Input
                  id="projectName"
                  placeholder="e.g. The Startup Podcast — Ep. 42"
                  value={form.projectName}
                  onChange={(e) => handleChange("projectName", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="episodeTitle">Episode title</Label>
                  <Input
                    id="episodeTitle"
                    placeholder="e.g. Fundraising in a downturn"
                    value={form.episodeTitle}
                    onChange={(e) => handleChange("episodeTitle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client / Studio name</Label>
                  <Input
                    id="clientName"
                    placeholder="e.g. Spice of Life Media"
                    value={form.clientName}
                    onChange={(e) => handleChange("clientName", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recordingDate">Recording date</Label>
                <Input
                  id="recordingDate"
                  type="date"
                  value={form.recordingDate}
                  onChange={(e) => handleChange("recordingDate", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expected Setup</CardTitle>
              <CardDescription>
                Describe the expected recording setup. Offloadr uses this to build the missing file checklist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expectedCameraCount">Number of cameras</Label>
                  <Input
                    id="expectedCameraCount"
                    type="number"
                    min="0"
                    max="8"
                    placeholder="e.g. 3"
                    value={form.expectedCameraCount}
                    onChange={(e) => handleChange("expectedCameraCount", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedAudioSetup">Audio setup</Label>
                  <Input
                    id="expectedAudioSetup"
                    placeholder="e.g. Rodecaster Pro II, 4-mic multitrack"
                    value={form.expectedAudioSetup}
                    onChange={(e) => handleChange("expectedAudioSetup", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Notes visible to your editor on the handoff page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Session description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief summary of what was recorded in this session..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editorNotes">Editor notes</Label>
                <Textarea
                  id="editorNotes"
                  placeholder="Instructions for the editor — what to prioritise, any technical issues during recording, cuts to make..."
                  rows={4}
                  value={form.editorNotes}
                  onChange={(e) => handleChange("editorNotes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pb-8">
            <Button type="button" variant="outline" onClick={() => setLocation("/dashboard")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project and Upload Files"
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
