import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export type SubmissionStatus = "draft" | "needs_review" | "approved" | "rejected" | "exported";

export type ProviderName = "descript" | "shotstack" | "vizard" | "creatomate" | "remotion" | "stub";

export type RenderJobStatus = "queued" | "submitted" | "processing" | "complete" | "failed" | "not_configured";
export type RenderJobKind = "smart_draft" | "final_render" | "highlight";

export interface RenderJob {
  id: number;
  projectId: number;
  timelineId: number | null;
  provider: ProviderName;
  kind: RenderJobKind;
  status: RenderJobStatus;
  externalJobId: string | null;
  previewUrl: string | null;
  finalExportUrl: string | null;
  errorMessage: string | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderListItem {
  name: ProviderName;
  configured: boolean;
}

type Mut<T, V> = UseMutationOptions<T, ErrorType<unknown>, V>;

function mutate<T, V = void>(method: "POST", url: (vars: V) => string, body?: (vars: V) => unknown) {
  return async (vars: V): Promise<T> =>
    customFetch<T>(url(vars), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body(vars)) : undefined,
    });
}

// ----- Submission state machine -----
export const useSubmitProject = (
  opts?: { mutation?: Mut<unknown, { projectId: number }> },
): UseMutationResult<unknown, ErrorType<unknown>, { projectId: number }> =>
  useMutation({
    mutationFn: mutate<unknown, { projectId: number }>(
      "POST",
      ({ projectId }) => `/offloadr/api/projects/${projectId}/submit`,
    ),
    ...opts?.mutation,
  });

export const useApproveProject = (
  opts?: { mutation?: Mut<unknown, { projectId: number }> },
): UseMutationResult<unknown, ErrorType<unknown>, { projectId: number }> =>
  useMutation({
    mutationFn: mutate<unknown, { projectId: number }>(
      "POST",
      ({ projectId }) => `/offloadr/api/projects/${projectId}/approve`,
    ),
    ...opts?.mutation,
  });

export const useRejectProject = (
  opts?: { mutation?: Mut<unknown, { projectId: number }> },
): UseMutationResult<unknown, ErrorType<unknown>, { projectId: number }> =>
  useMutation({
    mutationFn: mutate<unknown, { projectId: number }>(
      "POST",
      ({ projectId }) => `/offloadr/api/projects/${projectId}/reject`,
    ),
    ...opts?.mutation,
  });

export const useReopenProject = (
  opts?: { mutation?: Mut<unknown, { projectId: number }> },
): UseMutationResult<unknown, ErrorType<unknown>, { projectId: number }> =>
  useMutation({
    mutationFn: mutate<unknown, { projectId: number }>(
      "POST",
      ({ projectId }) => `/offloadr/api/projects/${projectId}/reopen`,
    ),
    ...opts?.mutation,
  });

// ----- Smart Draft + render -----
export const useRequestSmartDraft = (
  opts?: { mutation?: Mut<RenderJob, { projectId: number; provider?: ProviderName; fallbackStub?: boolean }> },
): UseMutationResult<RenderJob, ErrorType<unknown>, { projectId: number; provider?: ProviderName; fallbackStub?: boolean }> =>
  useMutation({
    mutationFn: async (vars) => {
      const qs = vars.fallbackStub ? "?fallback=stub" : "";
      return customFetch<RenderJob>(`/offloadr/api/projects/${vars.projectId}/smart-draft${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: vars.provider }),
      });
    },
    ...opts?.mutation,
  });

/**
 * One-button "Create Final Video" mutation for the school demo flow.
 *
 * Hits the dedicated /create-final-video endpoint which:
 *  - Returns 503 with `{code:"shotstack_not_configured"}` if the
 *    SHOTSTACK_API_KEY is missing on the server (no fake success rows).
 *  - Returns 422 with `{code:"no_clips"}` if there are no uploaded
 *    video clips yet.
 *  - Returns 201 with a real render_job row when Shotstack accepted
 *    the render submission.
 *
 * The caller is responsible for surfacing these errors as toast/UI.
 */
export interface CreateFinalVideoError {
  error: string;
  code?: "shotstack_not_configured" | "no_clips" | "shotstack_submit_failed";
  message: string;
}

export const useCreateFinalVideo = (
  opts?: {
    mutation?: UseMutationOptions<RenderJob, ErrorType<CreateFinalVideoError>, { projectId: number }>;
  },
): UseMutationResult<RenderJob, ErrorType<CreateFinalVideoError>, { projectId: number }> =>
  useMutation({
    mutationFn: async ({ projectId }) =>
      customFetch<RenderJob>(`/offloadr/api/projects/${projectId}/create-final-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    ...opts?.mutation,
  });

export const useRequestFinalRender = (
  opts?: { mutation?: Mut<RenderJob, { projectId: number; provider?: ProviderName }> },
): UseMutationResult<RenderJob, ErrorType<unknown>, { projectId: number; provider?: ProviderName }> =>
  useMutation({
    mutationFn: async (vars) =>
      customFetch<RenderJob>(`/offloadr/api/projects/${vars.projectId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: vars.provider }),
      }),
    ...opts?.mutation,
  });

export const getListRenderJobsQueryKey = (projectId: number): QueryKey => [
  `/offloadr/api/projects/${projectId}/render-jobs`,
];

export const useListRenderJobs = (
  projectId: number,
  opts?: { query?: Partial<UseQueryOptions<RenderJob[], ErrorType<unknown>, RenderJob[], QueryKey>> },
): UseQueryResult<RenderJob[], ErrorType<unknown>> =>
  useQuery({
    queryKey: getListRenderJobsQueryKey(projectId),
    queryFn: () => customFetch<RenderJob[]>(`/offloadr/api/projects/${projectId}/render-jobs`),
    enabled: !!projectId,
    ...opts?.query,
  });

// Refresh a single render job by re-querying the provider. The list
// query refetches by invalidating its key on success.
export const useRefreshRenderJob = (
  opts?: { mutation?: Mut<RenderJob, { projectId: number; jobId: number }> },
): UseMutationResult<RenderJob, ErrorType<unknown>, { projectId: number; jobId: number }> =>
  useMutation({
    mutationFn: async ({ projectId, jobId }) =>
      customFetch<RenderJob>(`/offloadr/api/projects/${projectId}/render-jobs/${jobId}/refresh`, {
        method: "POST",
      }),
    ...opts?.mutation,
  });

export const getListProvidersQueryKey = (): QueryKey => [`/offloadr/api/providers`];

export const useListProviders = (
  opts?: { query?: Partial<UseQueryOptions<{ providers: ProviderListItem[] }, ErrorType<unknown>, { providers: ProviderListItem[] }, QueryKey>> },
): UseQueryResult<{ providers: ProviderListItem[] }, ErrorType<unknown>> =>
  useQuery({
    queryKey: getListProvidersQueryKey(),
    queryFn: () => customFetch<{ providers: ProviderListItem[] }>(`/offloadr/api/providers`),
    ...opts?.query,
  });
