import { MainLayout } from "@/components/layout/main-layout";
import { useGetStorageStatus, getGetStorageStatusQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Loader2 } from "lucide-react";

function formatBytes(bytes: number) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function StoragePage() {
  const { data: storage, isLoading } = useGetStorageStatus({
    query: { queryKey: getGetStorageStatusQueryKey() },
  });

  const usedPercent =
    storage?.maxBytes && storage.maxBytes > 0
      ? Math.min(100, (storage.totalBytes / storage.maxBytes) * 100)
      : null;

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8 flex items-center gap-3">
          <HardDrive className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage</h1>
            <p className="text-muted-foreground mt-1">Overview of your project file storage usage.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : storage ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Storage Provider</CardTitle>
                  <Badge variant={storage.status === "ok" ? "secondary" : "destructive"} className={storage.status === "ok" ? "bg-green-100 text-green-800" : ""}>
                    {storage.status === "ok" ? "Online" : storage.status}
                  </Badge>
                </div>
                <CardDescription>
                  Provider: {storage.provider === "local" ? "Local storage" : storage.provider}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-3xl font-bold">{formatBytes(storage.totalBytes)}</div>
                    <p className="text-sm text-muted-foreground mt-1">Total storage used</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{storage.totalFiles}</div>
                    <p className="text-sm text-muted-foreground mt-1">Total files stored</p>
                  </div>
                </div>

                {usedPercent !== null && storage.maxBytes && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Used</span>
                      <span>{formatBytes(storage.totalBytes)} of {formatBytes(storage.maxBytes)}</span>
                    </div>
                    <Progress value={usedPercent} />
                    <p className="text-xs text-muted-foreground">{usedPercent.toFixed(1)}% of quota used</p>
                  </div>
                )}

                {!storage.maxBytes && (
                  <p className="text-sm text-muted-foreground">No storage quota limit configured.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Storage information unavailable.
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
