import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";

const CODE_ALPHABET = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/i;

export default function StudentUpload() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = code.trim().toUpperCase().replace(/[\s-]/g, "");
    if (normalized.length < 4 || normalized.length > 16) {
      setError("That code doesn't look right — check with your teacher.");
      return;
    }
    if (!CODE_ALPHABET.test(normalized)) {
      setError("Codes only use letters and numbers. Double-check what your teacher gave you.");
      return;
    }
    setSubmitting(true);
    setLocation(`/student-upload/${normalized}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/85">
        <div className="container flex h-16 items-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Offloadr"
            className="h-7 w-auto brightness-0 invert"
          />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Upload your work</CardTitle>
            <CardDescription>
              Enter the upload code your teacher gave you to send your audio,
              video, or project files into your class project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Upload code</Label>
                <Input
                  id="code"
                  data-testid="input-student-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. K7M2QP"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="text-center text-2xl tracking-[0.5em] font-mono uppercase h-14"
                  maxLength={16}
                />
                {error && (
                  <p className="text-sm text-destructive" role="alert">{error}</p>
                )}
              </div>
              <Button
                type="submit"
                data-testid="button-student-code-continue"
                className="w-full"
                disabled={submitting || code.trim().length === 0}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center pt-2">
                You don't need an account. Only your name and the files you
                pick will be sent to your teacher's review queue.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
