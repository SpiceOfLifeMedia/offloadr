import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RecentWorkspace {
  slug: string;
  name: string;
  lastUsed: number;
}

interface WorkspaceState {
  orgSlug: string;
  recents: RecentWorkspace[];
  setOrgSlug: (slug: string) => void;
  addRecent: (slug: string, name: string) => Promise<void>;
  loadRecents: () => Promise<void>;
}

const STORAGE_KEY = "offl_recents";
const MAX_RECENTS = 5;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  orgSlug: "",
  recents: [],

  setOrgSlug: (slug) => set({ orgSlug: slug }),

  loadRecents: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set({ recents: JSON.parse(raw) as RecentWorkspace[] });
    } catch { /* ignore */ }
  },

  addRecent: async (slug, name) => {
    const existing = get().recents.filter((r) => r.slug !== slug);
    const updated: RecentWorkspace[] = [
      { slug, name, lastUsed: Date.now() },
      ...existing,
    ].slice(0, MAX_RECENTS);
    set({ recents: updated, orgSlug: slug });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  },
}));
