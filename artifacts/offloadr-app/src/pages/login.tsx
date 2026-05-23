import { useState } from "react";
import { Link, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLoginUser } from "@/api-client";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, GraduationCap, Upload, KeyRound, ArrowRight } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");
  const loginMutation = useLoginUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setError("");
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: () => setLocation("/dashboard"),
        onError: (err) => {
          const message = err instanceof Error ? err.message : "";
          setError(message || "Failed to log in. Please check your credentials.");
        },
      },
    );
  }

  return (
    <PublicLayout>
      <div className="relative flex-1 flex items-start justify-center px-4 py-8 md:py-12 overflow-hidden">
        {/* ambient gradient backdrop, same family as the home page */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-gradient-to-br from-blue-600/15 via-indigo-500/10 to-purple-600/15 blur-3xl" />
        </div>

        <div className="relative w-full max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-50">
              Welcome to Offloadr
            </h1>
            <p className="mt-2 text-sm md:text-base text-zinc-400 max-w-xl mx-auto">
              Pick how you're signing in. Teachers run the projects, students upload from a
              code their teacher shared.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* ---------------------------------------------------------- */}
            {/* Teacher / Staff — real, working login                       */}
            {/* ---------------------------------------------------------- */}
            <Card className="lg:col-span-1 border-zinc-800 bg-zinc-950/70 backdrop-blur-xl">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2 text-blue-300">
                  <GraduationCap className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Teacher / Staff</span>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">Continue as Teacher</CardTitle>
                <CardDescription>
                  Full dashboard access. Manage class projects, review student uploads, approve
                  Smart Drafts and export final videos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="name@example.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input placeholder="••••••••" type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login-submit"
                    >
                      {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Log in
                    </Button>
                  </form>
                </Form>
                <div className="mt-4 text-center text-sm text-zinc-400">
                  Don't have an account?{" "}
                  <Link href="/register" className="text-blue-300 hover:text-blue-200 hover:underline">
                    Register here
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* ---------------------------------------------------------- */}
            {/* Join with Upload Code — the real student path today        */}
            {/* ---------------------------------------------------------- */}
            <Card className="lg:col-span-1 relative overflow-hidden border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-zinc-950/80 to-purple-950/40 backdrop-blur-xl">
              <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
              <CardHeader className="space-y-2 relative">
                <div className="flex items-center gap-2 text-blue-300">
                  <KeyRound className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Upload Code</span>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-zinc-50">
                  Join with Upload Code
                </CardTitle>
                <CardDescription className="text-zinc-300">
                  Your teacher shared a short code. Enter it to send your audio, video or project
                  files straight into the class project — no account needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 relative">
                <Link href="/student-upload">
                  <Button
                    size="lg"
                    className="w-full gap-2 bg-white text-zinc-950 hover:bg-zinc-200"
                    data-testid="button-login-upload-code"
                  >
                    Enter Upload Code
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You won't see other students' work, the dashboard, storage, or any teacher
                  tools. Only the files you pick will be sent to your teacher's review queue.
                </p>
              </CardContent>
            </Card>

            {/* ---------------------------------------------------------- */}
            {/* Student Login — aspirational, marked as Coming Soon        */}
            {/* so we don't fake a feature that doesn't exist yet.         */}
            {/* ---------------------------------------------------------- */}
            <Card className="lg:col-span-1 border-zinc-800/80 bg-zinc-950/40 backdrop-blur-xl opacity-90">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Student</span>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Coming Soon
                  </span>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
                  Student Login
                </CardTitle>
                <CardDescription>
                  Personal student accounts with project history, restricted media access and
                  reflection logs. We're building it next — for now, students join via upload
                  code.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="lg"
                  className="w-full"
                  variant="outline"
                  disabled
                  data-testid="button-login-student-coming-soon"
                >
                  Coming Soon
                </Button>
                <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
                  Until student accounts ship, use the upload code your teacher shared.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
