import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import Home from "@/pages/home";

const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const PILOT_URL = "https://offloadr-pilot.fly.dev/offloadr/";

function PilotRedirect() {
  if (typeof window !== "undefined") {
    window.location.replace(PILOT_URL);
  }
  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-zinc-500">
      Loading…
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        {/* Pilot app lives on Fly. Anyone hitting an app route on the
            marketing domain gets bounced to the real pilot URL. */}
        <Route path="/login" component={PilotRedirect} />
        <Route path="/register" component={PilotRedirect} />
        <Route path="/dashboard" component={PilotRedirect} />
        <Route path="/projects/:rest*" component={PilotRedirect} />
        <Route path="/share/:rest*" component={PilotRedirect} />
        <Route path="/student-upload/:rest*" component={PilotRedirect} />
        <Route path="/student-upload" component={PilotRedirect} />
        <Route path="/settings" component={PilotRedirect} />
        <Route path="/storage" component={PilotRedirect} />
        <Route path="/devices" component={PilotRedirect} />
        <Route path="/help" component={PilotRedirect} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
