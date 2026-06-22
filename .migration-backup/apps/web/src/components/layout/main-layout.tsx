import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogoutUser } from "@/api-client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderOpen, HardDrive, Settings, HelpCircle, LogOut, Loader2, Plus, Cpu } from "lucide-react";
import { PilotBanner } from "@/components/PilotBanner";
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarProvider
} from "@/components/ui/sidebar";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const logout = useLogoutUser();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/login")
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar>
          <SidebarHeader className="flex items-center gap-2 px-4 py-6 border-b">
            <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight text-foreground">Offloadr</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <div className="px-4 py-4">
                  <Button className="w-full justify-start gap-2" onClick={() => setLocation("/projects/new")}>
                    <Plus className="h-4 w-4" />
                    New Project
                  </Button>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Application</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                      <Link href="/dashboard" className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/storage")}>
                      <Link href="/storage" className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        <span>Storage</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/devices")}>
                      <Link href="/devices" className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        <span>Devices</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Account</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/settings"}>
                      <Link href="/settings" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/help"}>
                      <Link href="/help" className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        <span>Help</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-4">
            <div className="flex flex-col gap-4">
              <div className="text-sm truncate">
                <div className="font-medium truncate">{user?.name}</div>
                <div className="text-muted-foreground text-xs truncate">{user?.email}</div>
              </div>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout} disabled={logout.isPending}>
                {logout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Log out
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <PilotBanner />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}