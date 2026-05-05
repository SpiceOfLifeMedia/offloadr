import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import ProjectNew from "@/pages/project-new";
import ProjectDetail from "@/pages/project-detail";
import ProjectUpload from "@/pages/project-upload";
import ProjectFiles from "@/pages/project-files";
import ProjectHandoff from "@/pages/project-handoff";
import SharePage from "@/pages/share-page";
import Settings from "@/pages/settings";
import StoragePage from "@/pages/storage-page";
import Help from "@/pages/help";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/projects/new" component={ProjectNew} />
      <Route path="/projects/:id/upload" component={ProjectUpload} />
      <Route path="/projects/:id/files" component={ProjectFiles} />
      <Route path="/projects/:id/handoff" component={ProjectHandoff} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/share/:token" component={SharePage} />
      <Route path="/settings" component={Settings} />
      <Route path="/storage" component={StoragePage} />
      <Route path="/help" component={Help} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
