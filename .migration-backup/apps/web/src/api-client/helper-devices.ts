import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { customFetch, type ErrorType } from "./custom-fetch";

/**
 * Mac Mini Helper admin-facing client hooks. The Helper-facing
 * endpoints (`/helper/pair`, `/helper/heartbeat`, `/helper/events`)
 * are deliberately NOT wrapped here — those are called from the
 * Mac Mini, not from this web app.
 */

export type HelperDeviceStatus = "active" | "revoked";

export interface HelperDeviceSummary {
  id: number;
  deviceLabel: string;
  status: HelperDeviceStatus;
  hostname: string | null;
  osVersion: string | null;
  helperVersion: string | null;
  pairedAt: string;
  pairedByUserId: number;
  pairedByEmail: string | null;
  lastHeartbeatAt: string | null;
  lastUptimeSec: number | null;
  revokedAt: string | null;
}

export interface HelperPairingCode {
  code: string;
  deviceLabel: string;
  expiresAt: string;
}

export interface HelperEventRecord {
  id: string;
  eventId: string;
  kind: string;
  payload: Record<string, unknown>;
  sourceLabel: string | null;
  ts: string;
  receivedAt: string;
}

interface ErrorBody {
  error: string;
  message?: string;
}
type FetchError = ErrorType<ErrorBody>;

export const getListHelperDevicesQueryKey = () => ["listHelperDevices"] as const;

export const listHelperDevices = (): Promise<{ devices: HelperDeviceSummary[] }> =>
  customFetch("/api/helper-devices", { method: "GET" });

export function useListHelperDevices<
  TData = { devices: HelperDeviceSummary[] },
  TError = FetchError,
>(options?: {
  query?: Partial<
    UseQueryOptions<{ devices: HelperDeviceSummary[] }, TError, TData>
  >;
}): UseQueryResult<TData, TError> {
  return useQuery({
    queryKey: getListHelperDevicesQueryKey(),
    queryFn: () => listHelperDevices(),
    ...options?.query,
  });
}

export const getListHelperDeviceEventsQueryKey = (deviceId: number) =>
  ["listHelperDeviceEvents", deviceId] as const;

export const listHelperDeviceEvents = (
  deviceId: number,
  limit = 50,
): Promise<{ events: HelperEventRecord[] }> =>
  customFetch(`/api/helper-devices/${deviceId}/events?limit=${limit}`, {
    method: "GET",
  });

export function useListHelperDeviceEvents<
  TData = { events: HelperEventRecord[] },
  TError = FetchError,
>(
  deviceId: number,
  limit = 50,
  options?: {
    query?: Partial<
      UseQueryOptions<{ events: HelperEventRecord[] }, TError, TData>
    >;
  },
): UseQueryResult<TData, TError> {
  return useQuery({
    queryKey: getListHelperDeviceEventsQueryKey(deviceId),
    queryFn: () => listHelperDeviceEvents(deviceId, limit),
    ...options?.query,
  });
}

export const createHelperPairingCode = (
  body: { deviceLabel: string },
): Promise<HelperPairingCode> =>
  customFetch("/api/helper-devices/pairing-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export function useCreateHelperPairingCode<
  TError = FetchError,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    HelperPairingCode,
    TError,
    { deviceLabel: string },
    TContext
  >;
}): UseMutationResult<HelperPairingCode, TError, { deviceLabel: string }, TContext> {
  return useMutation({
    mutationKey: ["createHelperPairingCode"],
    mutationFn: createHelperPairingCode,
    ...options?.mutation,
  });
}

export const revokeHelperDevice = (
  deviceId: number,
): Promise<{ id: number; status: "revoked" }> =>
  customFetch(`/api/helper-devices/${deviceId}/revoke`, { method: "POST" });

export function useRevokeHelperDevice<
  TError = FetchError,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    { id: number; status: "revoked" },
    TError,
    { deviceId: number },
    TContext
  >;
}): UseMutationResult<
  { id: number; status: "revoked" },
  TError,
  { deviceId: number },
  TContext
> {
  return useMutation({
    mutationKey: ["revokeHelperDevice"],
    mutationFn: ({ deviceId }) => revokeHelperDevice(deviceId),
    ...options?.mutation,
  });
}
