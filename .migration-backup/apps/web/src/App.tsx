import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import Home from "@/pages/home";

const NotFound = lazy(() => import("@/pages/not-found"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const ProjectNew = lazy(() => import("@/pages/project-new"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const ProjectUpload = lazy(() => import("@/pages/project-upload"));
const ProjectFiles = lazy(() => import("@/pages/project-files"));
const DevicesPage = lazy(() => import("@/pages/devices"));
const SharePage = lazy(() => import("@/pages/share-page"));
const Settings = lazy(() => import("@/pages/settings"));
const StoragePage = lazy(() => import("@/pages/storage-page"));
const Help = lazy(() => import("@/pages/help"));
const StudentUpload = lazy(() => import("@/pages/student-upload"));
const StudentUploadSession = lazy(
  () => import("@/pages/student-upload-session"),
);
const StudentPortalLogin = lazy(
  () => import("@/pages/student-portal-login"),
);
const StudentPortalProjects = lazy(
  () => import("@/pages/student-portal-projects"),
);
const StudentPortalProject = lazy(
  () => import("@/pages/student-portal-project"),
);
const StudentPortalDraftReview = lazy(
  () => import("@/pages/student-portal-draft-review"),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

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
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/projects/new" component={ProjectNew} />
        <Route path="/projects/:id/upload" component={ProjectUpload} />
        <Route path="/projects/:id/files" component={ProjectFiles} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/share/:token" component={SharePage} />
        <Route path="/student-upload" component={StudentUpload} />
        <Route path="/student-upload/:code" component={StudentUploadSession} />
        {/* Canonical school-scoped URLs. The /s/ prefix is required to
            avoid colliding with every reserved top-level route in this
            app (/dashboard, /settings, /projects, etc.). Teachers share
            ONE link per school, e.g. app.useoffloadr.com/s/pnps/login —
            students see only username + password. */}
        <Route path="/s/:school/login" component={StudentPortalLogin} />
        <Route path="/s/:school" component={StudentPortalLogin} />
        <Route path="/s/:school/projects" component={StudentPortalProjects} />
        <Route
          path="/s/:school/projects/:projectId/draft-review"
          component={StudentPortalDraftReview}
        />
        <Route
          path="/s/:school/projects/:projectId"
          component={StudentPortalProject}
        />
        {/* Unscoped (no school in URL) — the org-code field is shown. */}
        <Route path="/student-login" component={StudentPortalLogin} />
        <Route path="/student-projects" component={StudentPortalProjects} />
        <Route
          path="/student-projects/:projectId/draft-review"
          component={StudentPortalDraftReview}
        />
        <Route
          path="/student-projects/:projectId"
          component={StudentPortalProject}
        />
        {/* Legacy aliases — kept working so old links / QR codes don't
            break. /student-login/:orgSlug → behaves like /s/:school/login. */}
        <Route path="/student-login/:orgSlug" component={StudentPortalLogin} />
        <Route path="/student-portal/login" component={StudentPortalLogin} />
        <Route
          path="/student-portal/projects"
          component={StudentPortalProjects}
        />
        <Route
          path="/student-portal/projects/:projectId/draft-review"
          component={StudentPortalDraftReview}
        />
        <Route
          path="/student-portal/projects/:projectId"
          component={StudentPortalProject}
        />
        <Route
          path="/student-portal/upload"
          component={StudentPortalProjects}
        />
        <Route path="/settings" component={Settings} />
        <Route path="/storage" component={StoragePage} />
        <Route path="/devices" component={DevicesPage} />
        <Route path="/help" component={Help} />
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
