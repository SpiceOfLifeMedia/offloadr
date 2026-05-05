import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { HardDrive, Share2, FolderTree, FileWarning } from "lucide-react";

export default function Home() {
  return (
    <PublicLayout>
      <div className="flex flex-col">
        {/* Hero Section */}
        <section className="py-24 md:py-32 bg-muted/30">
          <div className="container text-center space-y-8 max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
              Offload your session. Start your edit.
            </h1>
            <p className="text-xl text-muted-foreground">
              Offloadr turns raw podcast and video recordings into clean, organised, ready-to-edit projects.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 text-lg">Create your first project</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-16">
              
              <div className="space-y-4">
                <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center rounded-lg">
                  <HardDrive className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">Built for local-first recording</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Designed for the massive multi-gigabyte files that come from local multitrack audio recorders and 4K cameras. No web-based recording artifacts, just your pure raw files.
                </p>
              </div>

              <div className="space-y-4">
                <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center rounded-lg">
                  <FolderTree className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">From scattered files to structured projects</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Stop dumping SD cards into loose folders. Offloadr automatically organizes your assets into rigid, predictable folder structures so your editor knows exactly where everything is.
                </p>
              </div>

              <div className="space-y-4">
                <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center rounded-lg">
                  <FileWarning className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">Know what is missing before handoff</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Offloadr checks your upload against the expected camera count and audio setup. Never get an email from your editor asking where Camera 2 went.
                </p>
              </div>

              <div className="space-y-4">
                <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center rounded-lg">
                  <Share2 className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">One clean link for your editor</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you are done uploading, generate a single secure share link. Your editor gets a clean interface to download the structured project, complete with your notes.
                </p>
              </div>

            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}