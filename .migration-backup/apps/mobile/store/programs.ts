import { create } from "zustand";

export type TakeStatus = "not-started" | "recorded" | "kept";

export interface Take {
  promptId: string;
  uri: string | null;
  durationSeconds: number;
  recordedAt: string;
}

interface ProgramState {
  programId: string | null;
  currentPromptIndex: number;
  takes: Record<string, Take>;
  keptPromptIds: string[];
  isSubmitted: boolean;

  startProgram: (programId: string) => void;
  setCurrentPromptIndex: (index: number) => void;
  saveTake: (promptId: string, take: Take) => void;
  keepTake: (promptId: string) => void;
  goToNextPrompt: () => void;
  submitProgram: () => void;
  resetSession: () => void;
  getStatusForPrompt: (promptId: string) => TakeStatus;
}

export const useProgramStore = create<ProgramState>((set, get) => ({
  programId: null,
  currentPromptIndex: 0,
  takes: {},
  keptPromptIds: [],
  isSubmitted: false,

  startProgram: (programId) =>
    set({
      programId,
      currentPromptIndex: 0,
      takes: {},
      keptPromptIds: [],
      isSubmitted: false,
    }),

  setCurrentPromptIndex: (index) => set({ currentPromptIndex: index }),

  saveTake: (promptId, take) =>
    set((s) => ({ takes: { ...s.takes, [promptId]: take } })),

  keepTake: (promptId) =>
    set((s) => {
      const already = s.keptPromptIds.includes(promptId);
      return {
        keptPromptIds: already
          ? s.keptPromptIds
          : [...s.keptPromptIds, promptId],
      };
    }),

  goToNextPrompt: () =>
    set((s) => ({ currentPromptIndex: s.currentPromptIndex + 1 })),

  submitProgram: () => set({ isSubmitted: true }),

  resetSession: () =>
    set({
      programId: null,
      currentPromptIndex: 0,
      takes: {},
      keptPromptIds: [],
      isSubmitted: false,
    }),

  getStatusForPrompt: (promptId) => {
    const { takes, keptPromptIds } = get();
    if (keptPromptIds.includes(promptId)) return "kept";
    if (takes[promptId]) return "recorded";
    return "not-started";
  },
}));
