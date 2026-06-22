import { MainLayout } from "@/components/layout/main-layout";
import { useCreateProject } from "@/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Loader2, Upload, FolderInput, Cloud, Lock, Copy, CheckCircle2, ArrowRight, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/api-client/custom-fetch";
import {
  WORKFLOW_OPTIONS,
  DEFAULT_WORKFLOW_TYPE,
  type ProjectWorkflowType,
} from "@/lib/workflow-tags";

type CreatedProject = {
  id: number;
  projectName: string;
  uploadMethod: string | null;
  uploadCode: string | null;
};

const EMPTY_FORM = {
  projectName: "",
  classGroup: "",
  lessonType: "",
  studentInstructions: "",
  uploadMethod: "student_codes" as UploadMethod,
  dueDate: "",
  episodeTitle: "",
  clientName: "",
  expectedCameraCount: "",
  expectedAudioSetup: "",
  editorNotes: "",
  description: "",
  projectWorkflowType: DEFAULT_WORKFLOW_TYPE as ProjectWorkflowType,
};

const LESSON_TYPES = [
  { value: "podcast", label: "Podcast / audio piece" },
  { value: "video", label: "Video project" },
  { value: "documentary", label: "Documentary / short film" },
  { value: "interview", label: "Interview" },
  { value: "presentation", label: "Presentation / pitch" },
  { value: "music", label: "Music recording" },
  { value: "other", label: "Other" },
];

type UploadMethod = "student_codes" | "teacher_upload" | "podcart_sync";

const UPLOAD_METHODS: Array<{
  value: UploadMethod;
  label: string;
  description: string;
  icon: typeof Upload;
  disabled?: boolean;
  pill?: string;
}> = [
  {
    value: "student_codes",
    label: "Students upload with a code",
    description: "Share a short upload code. Students send files straight in — no account needed.",
    icon: Upload,
  },
  {
    value: "teacher_upload",
    label: "Teacher uploads on behalf of class",
    description: "You upload finished or collected files yourself from your device.",
    icon: FolderInput,
  },
  {
    value: "podcart_sync",
    label: "Auto-sync from The Podcart",
    description: "Pull recordings directly from a Podcart in the classroom.",
    icon: Cloud,
    disabled: true,
    pill: "Coming soon",
  },
];

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProject = useCreateProject();

  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState<CreatedProject | null>(null);

  const handleChange = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
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
          classGroup: form.classGroup || undefined,
          lessonType: form.lessonType || undefined,
          studentInstructions: form.studentInstructions || undefined,
          uploadMethod: form.uploadMethod || undefined,
          dueDate: form.dueDate || undefined,
          episodeTitle: form.episodeTitle || undefined,
          clientName: form.clientName || undefined,
          expectedCameraCount: form.expectedCameraCount ? Number(form.expectedCameraCount) : undefined,
          expectedAudioSetup: form.expectedAudioSetup || undefined,
          editorNotes: form.editorNotes || undefined,
          description: form.description || undefined,
          projectWorkflowType: form.projectWorkflowType,
        },
      },
      {
        onSuccess: (project) => {
          const p = project as unknown as {
            id: number;
            projectName: string;
            uploadMethod?: string | null;
            uploadCode?: string | null;
          };
          setCreated({
            id: p.id,
            projectName: p.projectName,
            uploadMethod: p.uploadMethod ?? form.uploadMethod,
            uploadCode: p.uploadCode ?? null,
          });
          toast({ title: "Project created" });
        },
        onError: (err: unknown) => {
          let description = "Unknown error. Please try again.";
          let status: number | undefined;
          if (err instanceof ApiError) {
            status = err.status;
            const data = err.data as { message?: string; issues?: Array<{ path: string; message: string }> } | null;
            if (data?.issues && data.issues.length > 0) {
              description = data.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
            } else if (data?.message) {
              description = data.message;
            } else {
              description = err.statusText || `HTTP ${err.status}`;
            }
          } else if (err instanceof Error) {
            description = err.message;
          }
          // eslint-disable-next-line no-console
          console.error("Project creation failed", { status, err });
          toast({
            title: status ? `Failed to create project (${status})` : "Failed to create project",
            description,
            variant: "destructive",
          });
        },
      },
    );
  };

  // BASE_URL always ends with "/" (Vite). In production the app is mounted
  // under /offloadr/, so links must include that prefix or they 404.
  const appBase = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const studentUploadUrl = created?.uploadCode
    ? `${appBase}student-upload/${created.uploadCode}`
    : null;

  const inviteMessage = created
    ? `You've been added to "${created.projectName}" on Offloadr.\n\n` +
      (created.uploadCode
        ? `Upload your files here:\n${studentUploadUrl}\n\nOr go to ${appBase}student-upload and enter code: ${created.uploadCode}`
        : `Your teacher will share upload instructions shortly.`)
    : "";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch {
      toast({ title: `Couldn't copy ${label.toLowerCase()}`, variant: "destructive" });
    }
  };

  const startAnother = () => {
    setCreated(null);
    setForm(EMPTY_FORM);
  };

  if (created) {
    return (
      <MainLayout>
        <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/15 p-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Project created</h1>
              <p className="mt-1 text-muted-foreground">Share the code or link below with your class to start uploading.</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{created.projectName}</CardTitle>
              <CardDescription>
                {created.uploadMethod === "student_codes"
                  ? "Students enter this code (or open the link) to upload — no account needed."
                  : created.uploadMethod === "teacher_upload"
                  ? "You'll upload files yourself from the project page."
                  : "Upload method configured."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {created.uploadCode ? (
                <>
                  <div className="space-y-2">
                    <Label>Upload code</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-md border bg-muted/40 px-4 py-3 font-mono text-2xl tracking-widest text-center">
                        {created.uploadCode}
                      </div>
                      <Button type="button" variant="outline" onClick={() => copy(created.uploadCode!, "Code")}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy code
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Student upload link</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono truncate" title={studentUploadUrl ?? ""}>
                        {studentUploadUrl}
                      </div>
                      <Button type="button" variant="outline" onClick={() => copy(studentUploadUrl!, "Link")}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy link
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Button type="button" variant="secondary" onClick={() => copy(inviteMessage, "Invite message")}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy invite message
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      A short message with the link and code, ready to paste into Teams, Seesaw, Google Classroom or email.
                    </p>
                  </div>
                </>
              ) : created.uploadMethod === "student_codes" ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                  We couldn't auto-generate an upload code for this project. Open the project and create one manually from the Students tab.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-2 border-t">
                <Link href={`/projects/${created.id}`}>
                  <Button type="button">
                    Go to Project Hub
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button type="button" variant="outline" onClick={startAnother}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create another project
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
          <p className="mt-2 text-muted-foreground">
            Set up a class media project. Students upload into it, you review and prepare it for editing or publishing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Project basics</CardTitle>
              <CardDescription>Name the project and the class it belongs to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project name <span className="text-destructive">*</span></Label>
                <Input
                  id="projectName"
                  placeholder="e.g. Year 9 Media — Documentary Project"
                  value={form.projectName}
                  onChange={(e) => handleChange("projectName", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="classGroup">Class / group</Label>
                  <Input
                    id="classGroup"
                    placeholder="e.g. 9MED-A"
                    value={form.classGroup}
                    onChange={(e) => handleChange("classGroup", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lessonType">Lesson type</Label>
                  <Select
                    value={form.lessonType}
                    onValueChange={(v) => handleChange("lessonType", v)}
                  >
                    <SelectTrigger id="lessonType">
                      <SelectValue placeholder="Select a lesson type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LESSON_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectWorkflowType">Project workflow</Label>
                <Select
                  value={form.projectWorkflowType}
                  onValueChange={(v) =>
                    handleChange("projectWorkflowType", v as ProjectWorkflowType)
                  }
                >
                  <SelectTrigger id="projectWorkflowType" data-testid="select-project-workflow-type">
                    <SelectValue placeholder="Select a workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {WORKFLOW_OPTIONS.find((o) => o.value === form.projectWorkflowType)
                    ?.description ??
                    "Choose the type of media project so Offloadr can show the right upload roles and prepare the right workflow."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions for students</CardTitle>
              <CardDescription>
                Shown on the student upload page after they enter their code. Use it for the brief, what to record, what to name files, deadlines.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="studentInstructions">Student instructions</Label>
                <Textarea
                  id="studentInstructions"
                  placeholder="e.g. Upload your final cut as a single MP4 file. Use your name in the filename. Due Friday 3pm."
                  rows={5}
                  value={form.studentInstructions}
                  onChange={(e) => handleChange("studentInstructions", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How will files come in?</CardTitle>
              <CardDescription>Pick the upload method that fits this project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {UPLOAD_METHODS.map((m) => {
                const Icon = m.icon;
                const selected = form.uploadMethod === m.value;
                return (
                  <label
                    key={m.value}
                    className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                      m.disabled
                        ? "opacity-60 cursor-not-allowed border-border bg-muted/30"
                        : selected
                        ? "border-primary bg-primary/5 cursor-pointer"
                        : "border-border hover:bg-muted/30 cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="uploadMethod"
                      value={m.value}
                      className="mt-1"
                      checked={selected}
                      disabled={m.disabled}
                      onChange={() => !m.disabled && handleChange("uploadMethod", m.value)}
                    />
                    <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{m.label}</span>
                        {m.pill && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Lock className="h-3 w-3" />
                            {m.pill}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">{m.description}</div>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <details className="rounded-lg border bg-card">
            <summary className="cursor-pointer select-none px-6 py-4 font-medium">
              Advanced production settings
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (optional — for podcast / video production handoff)
              </span>
            </summary>
            <div className="px-6 pb-6 space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="episodeTitle">Episode title</Label>
                  <Input
                    id="episodeTitle"
                    value={form.episodeTitle}
                    onChange={(e) => handleChange("episodeTitle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client / studio name</Label>
                  <Input
                    id="clientName"
                    value={form.clientName}
                    onChange={(e) => handleChange("clientName", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expectedCameraCount">Number of cameras</Label>
                  <Input
                    id="expectedCameraCount"
                    type="number"
                    min="0"
                    max="8"
                    value={form.expectedCameraCount}
                    onChange={(e) => handleChange("expectedCameraCount", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedAudioSetup">Media setup</Label>
                  <Input
                    id="expectedAudioSetup"
                    placeholder="e.g. 4-mic multitrack, 2-camera shoot"
                    value={form.expectedAudioSetup}
                    onChange={(e) => handleChange("expectedAudioSetup", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Project description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editorNotes">Teacher notes for editor</Label>
                <Textarea
                  id="editorNotes"
                  placeholder="Notes for whoever will edit this — priorities, cuts, technical issues..."
                  rows={4}
                  value={form.editorNotes}
                  onChange={(e) => handleChange("editorNotes", e.target.value)}
                />
              </div>
            </div>
          </details>

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
                "Create project"
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
