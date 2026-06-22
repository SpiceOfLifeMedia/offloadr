import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type UploadItemStatus =
  | "local"
  | "queued"
  | "uploading"
  | "uploaded"
  | "error";

export interface UploadQueueItem {
  uuid: string;
  projectId: number;
  projectName: string;
  localUri: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  status: UploadItemStatus;
  progress: number;
  retries: number;
  storageKey: string | null;
  fileId: number | null;
  error: string | null;
  addedAt: number;
  uploadStartedAt: number | null;
}

interface UploadQueueState {
  items: UploadQueueItem[];
  addItem: (item: Omit<UploadQueueItem, "uuid" | "status" | "progress" | "retries" | "storageKey" | "fileId" | "error" | "addedAt" | "uploadStartedAt">) => string;
  setItemStatus: (uuid: string, status: UploadItemStatus, extra?: Partial<Pick<UploadQueueItem, "storageKey" | "fileId" | "error" | "retries">>) => void;
  updateProgress: (uuid: string, progress: number) => void;
  startUploadForProject: (projectId: number) => void;
  retryItem: (uuid: string) => void;
  removeItem: (uuid: string) => void;
  resetStuckItems: () => void;
}

function makeUuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export const useUploadQueueStore = create<UploadQueueState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item) => {
        const uuid = makeUuid();
        const newItem: UploadQueueItem = {
          ...item,
          uuid,
          status: "local",
          progress: 0,
          retries: 0,
          storageKey: null,
          fileId: null,
          error: null,
          addedAt: Date.now(),
          uploadStartedAt: null,
        };
        set((s) => ({ items: [...s.items, newItem] }));
        return uuid;
      },

      setItemStatus: (uuid, status, extra) => {
        set((s) => ({
          items: s.items.map((item) => {
            if (item.uuid !== uuid) return item;
            return {
              ...item,
              status,
              ...(extra ?? {}),
              uploadStartedAt: status === "uploading" ? Date.now() : item.uploadStartedAt,
            };
          }),
        }));
      },

      updateProgress: (uuid, progress) => {
        set((s) => ({
          items: s.items.map((item) => item.uuid === uuid ? { ...item, progress } : item),
        }));
      },

      startUploadForProject: (projectId) => {
        set((s) => ({
          items: s.items.map((item) =>
            item.projectId === projectId && item.status === "local"
              ? { ...item, status: "queued" as const }
              : item,
          ),
        }));
      },

      retryItem: (uuid) => {
        set((s) => ({
          items: s.items.map((item) =>
            item.uuid === uuid && item.status === "error"
              ? { ...item, status: "queued" as const, progress: 0, error: null }
              : item,
          ),
        }));
      },

      removeItem: (uuid) => {
        set((s) => ({ items: s.items.filter((i) => i.uuid !== uuid) }));
      },

      resetStuckItems: () => {
        set((s) => ({
          items: s.items.map((item) =>
            item.status === "uploading"
              ? { ...item, status: "queued" as const, progress: 0 }
              : item,
          ),
        }));
      },
    }),
    {
      name: "upload-queue",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.resetStuckItems();
      },
    },
  ),
);
