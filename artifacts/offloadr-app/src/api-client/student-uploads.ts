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

export type StudentUploadCodeStatus = "active" | "closed";

export interface StudentUploadCode {
  id: number;
  projectId: number;
  organizationId: number;
  code: string;
  status: StudentUploadCodeStatus;
  maxUploads?: number | null;
  uploadCount: number;
  expiresAt?: string | null;
  createdByUserId: number;
  createdAt: string;
  closedAt?: string | null;
  lastUploadAt?: string | null;
}

export interface UploaderSummaryEntry {
  name: string | null;
  fileCount: number;
  lastUploadAt: string | null;
}

export interface CreateStudentUploadCodeRequest {
  expiresAt?: string | null;
  maxUploads?: number | null;
}

export type StudentWorkflowChoice = "smart_draft" | "manual";

export interface StudentUploadCodeResolution {
  code: string;
  projectName: string;
  organizationDisplayName: string;
  projectId: number;
  studentInstructions?: string | null;
  studentWorkflowChoice?: StudentWorkflowChoice | null;
  expiresAt?: string | null;
  uploadsRemaining?: number | null;
  uploadGrant: string;
  uploadGrantExpiresAt: string;
}

export interface SetStudentWorkflowChoiceResponse {
  projectId: number;
  studentWorkflowChoice: StudentWorkflowChoice;
  studentWorkflowChoiceAt: string;
}

export const setStudentWorkflowChoice = (
  code: string,
  body: { choice: StudentWorkflowChoice; uploadGrant: string },
): Promise<SetStudentWorkflowChoiceResponse> =>
  customFetch<SetStudentWorkflowChoiceResponse>(
    `/api/student-upload/codes/${encodeURIComponent(code)}/workflow-choice`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

export function useSetStudentWorkflowChoice(options?: {
  mutation?: UseMutationOptions<
    SetStudentWorkflowChoiceResponse,
    StudentUploadFetchError,
    { code: string; choice: StudentWorkflowChoice; uploadGrant: string }
  >;
}): UseMutationResult<
  SetStudentWorkflowChoiceResponse,
  StudentUploadFetchError,
  { code: string; choice: StudentWorkflowChoice; uploadGrant: string }
> {
  return useMutation({
    mutationFn: ({ code, choice, uploadGrant }) =>
      setStudentWorkflowChoice(code, { choice, uploadGrant }),
    ...options?.mutation,
  });
}

interface StudentUploadErrorBody {
  error: string;
  message?: string;
}
type StudentUploadFetchError = ErrorType<StudentUploadErrorBody>;

export const getListStudentUploadCodesUrl = (projectId: number) =>
  `/api/projects/${projectId}/student-upload-codes`;

export const listStudentUploadCodes = (
  projectId: number,
  options?: RequestInit,
): Promise<StudentUploadCode[]> =>
  customFetch<StudentUploadCode[]>(getListStudentUploadCodesUrl(projectId), {
    ...options,
    method: "GET",
  });

export const getListStudentUploadCodesQueryKey = (projectId: number): QueryKey =>
  [getListStudentUploadCodesUrl(projectId)] as const;

export function useListStudentUploadCodes<
  TData = StudentUploadCode[],
  TError = StudentUploadFetchError,
>(
  projectId: number,
  options?: {
    query?: Partial<UseQueryOptions<StudentUploadCode[], TError, TData>>;
  },
): UseQueryResult<TData, TError> {
  const queryKey =
    options?.query?.queryKey ?? getListStudentUploadCodesQueryKey(projectId);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => listStudentUploadCodes(projectId, { signal }),
    ...options?.query,
  }) as UseQueryResult<TData, TError>;
}

export const createStudentUploadCode = (
  projectId: number,
  data: CreateStudentUploadCodeRequest = {},
): Promise<StudentUploadCode> =>
  customFetch<StudentUploadCode>(getListStudentUploadCodesUrl(projectId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export function useCreateStudentUploadCode<
  TError = StudentUploadFetchError,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    StudentUploadCode,
    TError,
    { projectId: number; data?: CreateStudentUploadCodeRequest },
    TContext
  >;
}): UseMutationResult<
  StudentUploadCode,
  TError,
  { projectId: number; data?: CreateStudentUploadCodeRequest },
  TContext
> {
  return useMutation({
    mutationKey: ["createStudentUploadCode"],
    mutationFn: ({ projectId, data }) =>
      createStudentUploadCode(projectId, data ?? {}),
    ...options?.mutation,
  });
}

export const regenerateStudentUploadCode = (
  codeId: number,
): Promise<StudentUploadCode> =>
  customFetch<StudentUploadCode>(`/api/student-upload-codes/${codeId}/regenerate`, {
    method: "POST",
  });

export function useRegenerateStudentUploadCode<
  TError = StudentUploadFetchError,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    StudentUploadCode,
    TError,
    { codeId: number },
    TContext
  >;
}): UseMutationResult<
  StudentUploadCode,
  TError,
  { codeId: number },
  TContext
> {
  return useMutation({
    mutationKey: ["regenerateStudentUploadCode"],
    mutationFn: ({ codeId }) => regenerateStudentUploadCode(codeId),
    ...options?.mutation,
  });
}

export const getGetProjectUploaderSummaryUrl = (projectId: number) =>
  `/api/projects/${projectId}/uploader-summary`;

export const getProjectUploaderSummary = (
  projectId: number,
  options?: RequestInit,
): Promise<UploaderSummaryEntry[]> =>
  customFetch<UploaderSummaryEntry[]>(getGetProjectUploaderSummaryUrl(projectId), {
    ...options,
    method: "GET",
  });

export const getGetProjectUploaderSummaryQueryKey = (projectId: number): QueryKey =>
  [getGetProjectUploaderSummaryUrl(projectId)] as const;

export function useGetProjectUploaderSummary<
  TData = UploaderSummaryEntry[],
  TError = StudentUploadFetchError,
>(
  projectId: number,
  options?: {
    query?: Partial<UseQueryOptions<UploaderSummaryEntry[], TError, TData>>;
  },
): UseQueryResult<TData, TError> {
  const queryKey =
    options?.query?.queryKey ?? getGetProjectUploaderSummaryQueryKey(projectId);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => getProjectUploaderSummary(projectId, { signal }),
    ...options?.query,
  }) as UseQueryResult<TData, TError>;
}

export const closeStudentUploadCode = (codeId: number): Promise<StudentUploadCode> =>
  customFetch<StudentUploadCode>(`/api/student-upload-codes/${codeId}/close`, {
    method: "POST",
  });

export function useCloseStudentUploadCode<
  TError = StudentUploadFetchError,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    StudentUploadCode,
    TError,
    { codeId: number },
    TContext
  >;
}): UseMutationResult<
  StudentUploadCode,
  TError,
  { codeId: number },
  TContext
> {
  return useMutation({
    mutationKey: ["closeStudentUploadCode"],
    mutationFn: ({ codeId }) => closeStudentUploadCode(codeId),
    ...options?.mutation,
  });
}
