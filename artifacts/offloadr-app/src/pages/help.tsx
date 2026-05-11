import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const STEPS = [
  {
    step: "1",
    title: "Create a project",
    body: "Each recording session gets its own project. Set the project name, episode title, recording date, and client. Define the expected camera count and audio setup — Offloadr uses this to build the missing file checklist.",
  },
  {
    step: "2",
    title: "Upload your files",
    body: "After the session, upload everything: Rodecaster exports, camera files, program video, screen recordings, OBS recordings, project files, and notes. Offloadr supports large files and accepts audio, video, image, document, and project file formats.",
  },
  {
    step: "3",
    title: "Tag each file",
    body: "Give each file a role — Host Mic, Camera 1, Program Video, Stereo Mix, and so on. Roles tell the editor exactly what each file is without them needing to guess from filenames.",
  },
  {
    step: "4",
    title: "Review the missing file checklist",
    body: "Offloadr compares the uploaded files against the expected setup. If Camera 3 is missing, or the multitrack audio was not exported, the checklist flags it before the editor receives the project.",
  },
  {
    step: "5",
    title: "Mark ready and create an editor link",
    body: "Once all files are uploaded and tagged, mark the project ready for editor. Create a private handoff link and send it to your editor. The link gives them a read-only view of the organised project — no account required.",
  },
];

const FAQ = [
  {
    q: "Does Offloadr record audio or video?",
    a: "No. Offloadr is a post-recording workflow tool. It does not record audio or video. Record with your cameras, Rodecaster, video switcher, OBS, or studio hardware as you normally would. When the session is finished, upload everything into Offloadr.",
  },
  {
    q: "Can my editor download the files?",
    a: "Yes. The editor handoff page shows download links for each file. The editor does not need an Offloadr account to access the handoff page.",
  },
  {
    q: "What file types are supported?",
    a: "Offloadr accepts any file type. Audio (WAV, AIFF, MP3, FLAC), video (MP4, MOV, MXF, AVI), project files (PRPROJ, FCPXML, DRP), images, documents, and archive files are all recognised and sorted automatically.",
  },
  {
    q: "How does the missing file checklist work?",
    a: "When you create a project, you define the expected number of cameras and the audio setup. Offloadr checks the uploaded and tagged files against those expectations. If a camera angle or audio track is missing, it shows a warning before you send the handoff link.",
  },
  {
    q: "Can I disable an editor link?",
    a: "Yes. From the project handoff page you can disable any previously created editor link. Once disabled, the link shows a not found error.",
  },
];

export default function Help() {
  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">How Offloadr Works</h1>
          <p className="text-muted-foreground mt-2">
            Offloadr is the post-recording workflow layer for podcast and video production teams.
            It turns raw recording sessions into clean, organised, ready-to-edit projects.
          </p>
        </div>

        <div className="space-y-4 mb-12">
          {STEPS.map((step) => (
            <Card key={step.step}>
              <CardContent className="pt-6 flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step.step}
                </div>
                <div>
                  <h3 className="font-semibold text-base">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="mb-8" />

        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <Card key={item.q}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-12 p-6 bg-muted/50 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">
            Offloadr is the bridge between recording and editing.
            Dropbox and Google Drive store files. Offloadr prepares recording sessions for editing.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
