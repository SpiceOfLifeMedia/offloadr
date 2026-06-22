import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Cpu,
  Copy,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  KeyRound,
} from "lucide-react";
import {
  useListHelperDevices,
  useCreateHelperPairingCode,
  useRevokeHelperDevice,
  useListHelperDeviceEvents,
  getListHelperDevicesQueryKey,
  getListHelperDeviceEventsQueryKey,
  type HelperDeviceSummary,
  type HelperPairingCode,
} from "@/api-client";

const HEARTBEAT_ONLINE_THRESHOLD_MS = 90 * 1000;

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "in the future";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function isOnline(d: HelperDeviceSummary): boolean {
  if (d.status !== "active") return false;
  if (!d.lastHeartbeatAt) return false;
  return Date.now() - new Date(d.lastHeartbeatAt).getTime() < HEARTBEAT_ONLINE_THRESHOLD_MS;
}

function DeviceStatusBadge({ device }: { device: HelperDeviceSummary }) {
  if (device.status === "revoked") return <Badge variant="destructive">Revoked</Badge>;
  return isOnline(device) ? (
    <Badge className="bg-green-600 hover:bg-green-600">Online</Badge>
  ) : (
    <Badge variant="secondary">Offline</Badge>
  );
}

function EventKindBadge({ kind }: { kind: string }) {
  const tone = kind.startsWith("recording.verified")
    ? "bg-green-600"
    : kind.startsWith("recording.failed") || kind.startsWith("storage.low")
    ? "bg-red-600"
    : kind.startsWith("recording.")
    ? "bg-blue-600"
    : "bg-slate-500";
  return <Badge className={`${tone} hover:${tone} font-mono text-xs`}>{kind}</Badge>;
}

function PairDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [deviceLabel, setDeviceLabel] = useState("Podcart Mac Mini");
  const [result, setResult] = useState<HelperPairingCode | null>(null);
  const queryClient = useQueryClient();
  const createCode = useCreateHelperPairingCode({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        queryClient.invalidateQueries({ queryKey: getListHelperDevicesQueryKey() });
      },
    },
  });

  const handleClose = () => {
    setResult(null);
    setDeviceLabel("Podcart Mac Mini");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pair a Mac Mini Helper</DialogTitle>
          <DialogDescription>
            Generate a one-time code. Read it to the operator running
            <code className="mx-1 rounded bg-muted px-1">offloadr-helper pair</code>
            on the Mac Mini. The code expires in 10 minutes.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="deviceLabel">Device label</Label>
              <Input
                id="deviceLabel"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                maxLength={120}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Where will this Mac Mini live? e.g. "Podcart Studio A".
              </p>
            </div>
            {createCode.error ? (
              <p className="text-sm text-red-600">
                Could not create pairing code. Try again.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-dashed bg-muted p-6 text-center">
              <div className="font-mono text-4xl tracking-[0.4em]">{result.code}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Expires at {new Date(result.expiresAt).toLocaleTimeString()}
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigator.clipboard.writeText(result.code)}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy code
            </Button>
            <p className="text-xs text-muted-foreground">
              On the Mac Mini, run:
              <code className="ml-1 rounded bg-muted px-1">
                offloadr-helper pair {result.code}
              </code>
              . The Helper will fetch a long-lived bearer token and store it in
              Apple Keychain. We never see the token again.
            </p>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => createCode.mutate({ deviceLabel: deviceLabel.trim() })}
                disabled={!deviceLabel.trim() || createCode.isPending}
              >
                {createCode.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Generate code
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceEventsPanel({ deviceId }: { deviceId: number }) {
  const { data, isLoading, refetch } = useListHelperDeviceEvents(deviceId, 25, {
    query: {
      refetchInterval: 5_000,
      queryKey: getListHelperDeviceEventsQueryKey(deviceId),
    },
  });
  const events = data?.events ?? [];

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" /> Recent events
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No events yet. Run the mock helper or pair a real Mac Mini.
        </p>
      ) : (
        <div className="divide-y">
          {events.map((e) => (
            <div key={e.id} className="grid grid-cols-[auto,1fr,auto] gap-3 px-4 py-2 text-sm">
              <EventKindBadge kind={e.kind} />
              <div className="min-w-0">
                {e.sourceLabel ? (
                  <span className="mr-2 text-muted-foreground">{e.sourceLabel}</span>
                ) : null}
                <span className="font-mono text-xs text-muted-foreground">
                  {JSON.stringify(e.payload)}
                </span>
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {timeAgo(e.ts)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceCard({ device }: { device: HelperDeviceSummary }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const revoke = useRevokeHelperDevice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHelperDevicesQueryKey() });
      },
    },
  });

  const online = isOnline(device);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            {device.deviceLabel}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {device.hostname ?? "no hostname"} · {device.osVersion ?? "unknown OS"} · helper {device.helperVersion ?? "?"}
          </p>
        </div>
        <DeviceStatusBadge device={device} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Last heartbeat</div>
            <div className="flex items-center gap-1">
              {online ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground" />
              )}
              {timeAgo(device.lastHeartbeatAt)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Paired</div>
            <div>{timeAgo(device.pairedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Paired by</div>
            <div className="truncate">{device.pairedByEmail ?? `user #${device.pairedByUserId}`}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Uptime</div>
            <div>{device.lastUptimeSec ? `${Math.floor(device.lastUptimeSec / 60)}m` : "—"}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide events" : "Show events"}
          </Button>
          {device.status === "active" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (
                  confirm(
                    `Revoke "${device.deviceLabel}"? The Mac Mini will be cut off immediately and will need to be re-paired.`,
                  )
                ) {
                  revoke.mutate({ deviceId: device.id });
                }
              }}
              disabled={revoke.isPending}
            >
              {revoke.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revoke
            </Button>
          ) : null}
        </div>

        {expanded ? <DeviceEventsPanel deviceId={device.id} /> : null}
      </CardContent>
    </Card>
  );
}

export default function DevicesPage() {
  const [pairOpen, setPairOpen] = useState(false);
  const { data, isLoading, error } = useListHelperDevices({
    query: {
      refetchInterval: 10_000,
      queryKey: getListHelperDevicesQueryKey(),
    },
  });

  const devices = useMemo(() => data?.devices ?? [], [data]);
  const onlineCount = useMemo(() => devices.filter(isOnline).length, [devices]);

  return (
    <MainLayout>
      <div className="flex-1 space-y-6 overflow-y-auto p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Helper devices</h2>
            <p className="text-sm text-muted-foreground">
              Mac Minis running the Offloadr Helper daemon. Pairing is single-use; tokens live only in Apple Keychain.
            </p>
          </div>
          <Button onClick={() => setPairOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" /> Pair a Mac Mini
          </Button>
        </div>

        {error ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-4 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Could not load devices. You may not have admin permission in this org.
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <Cpu className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No devices paired yet. The first Mac Mini install target is the Podcart studio.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {onlineCount} of {devices.length} {devices.length === 1 ? "device" : "devices"} online.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {devices.map((d) => (
                <DeviceCard key={d.id} device={d} />
              ))}
            </div>
          </>
        )}
      </div>

      <PairDialog open={pairOpen} onClose={() => setPairOpen(false)} />
    </MainLayout>
  );
}
