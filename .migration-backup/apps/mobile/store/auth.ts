import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const K = {
  token: "offl_session",
  studentId: "offl_sid",
  displayName: "offl_name",
  orgId: "offl_oid",
  orgSlug: "offl_slug",
  orgName: "offl_orgname",
} as const;

export interface AuthUser {
  sessionToken: string;
  studentId: number;
  displayName: string;
  orgId: number;
  orgSlug: string;
  orgName: string;
}

interface AuthState {
  user: AuthUser | null;
  isRestoring: boolean;
  restore: () => Promise<void>;
  setUser: (user: AuthUser) => Promise<void>;
  clearUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isRestoring: true,

  restore: async () => {
    try {
      const token = await SecureStore.getItemAsync(K.token);
      if (!token) { set({ isRestoring: false }); return; }
      const [studentId, displayName, orgId, orgSlug, orgName] = await Promise.all([
        SecureStore.getItemAsync(K.studentId),
        SecureStore.getItemAsync(K.displayName),
        SecureStore.getItemAsync(K.orgId),
        SecureStore.getItemAsync(K.orgSlug),
        SecureStore.getItemAsync(K.orgName),
      ]);
      set({
        user: {
          sessionToken: token,
          studentId: studentId ? parseInt(studentId, 10) : 0,
          displayName: displayName ?? "",
          orgId: orgId ? parseInt(orgId, 10) : 0,
          orgSlug: orgSlug ?? "",
          orgName: orgName ?? "",
        },
        isRestoring: false,
      });
    } catch {
      set({ isRestoring: false });
    }
  },

  setUser: async (user) => {
    await Promise.all([
      SecureStore.setItemAsync(K.token, user.sessionToken),
      SecureStore.setItemAsync(K.studentId, String(user.studentId)),
      SecureStore.setItemAsync(K.displayName, user.displayName),
      SecureStore.setItemAsync(K.orgId, String(user.orgId)),
      SecureStore.setItemAsync(K.orgSlug, user.orgSlug),
      SecureStore.setItemAsync(K.orgName, user.orgName),
    ]);
    set({ user });
  },

  clearUser: async () => {
    await Promise.all(Object.values(K).map((k) => SecureStore.deleteItemAsync(k)));
    set({ user: null });
  },
}));
