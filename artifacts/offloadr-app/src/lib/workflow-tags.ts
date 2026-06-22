/**
 * Workflow-aware file-role tag catalogue.
 *
 * Drives the upload-page tag dropdown and the teacher files-page tag
 * filter. The project's `projectWorkflowType` (server-side enum,
 * exposed on every Project response) selects which list to render.
 *
 * V1 ships two workflows. The catalogue is designed to be extended
 * (school_news, documentary, short_film, performance, sports, music,
 * livestream, etc.) by adding entries to ROLES_BY_WORKFLOW and to the
 * DB enum — no other call sites need to change.
 *
 * Note on data migration: tags are stored as free strings on
 * media_files.media_role, so existing rows tagged "Rodecaster
 * Multitrack" remain valid even though the dropdown now offers
 * "Multitrack Audio". The dropdown will surface the legacy value as
 * the current selection because <Select value={...}> on a value not
 * in the option list just renders the raw value.
 */

export type ProjectWorkflowType = "podcast_studio" | "general_video";

export const DEFAULT_WORKFLOW_TYPE: ProjectWorkflowType = "general_video";

export const WORKFLOW_OPTIONS: ReadonlyArray<{
  value: ProjectWorkflowType;
  label: string;
  description: string;
}> = [
  {
    value: "podcast_studio",
    label: "Podcast / Studio Recording",
    description:
      "Best for podcasts, interviews, studio shows, multicam recordings and audio-led projects.",
  },
  {
    value: "general_video",
    label: "General Video Project",
    description:
      "Best for documentaries, school news, excursions, short films, presentations and classroom videos.",
  },
];

const PODCAST_STUDIO_ROLES: ReadonlyArray<string> = [
  // Audio
  "Host Mic",
  "Guest Mic",
  "Stereo Mix",
  "Multitrack Audio",
  // Video
  "Camera 1",
  "Camera 2",
  "Camera 3",
  "Camera 4",
  "Camera ISO",
  "Program Video",
  "Screen Recording",
  // Project
  "Project File",
  "Final Export",
  "Thumbnail",
  "Backup",
  // System
  "Untagged Media",
];

const GENERAL_VIDEO_ROLES: ReadonlyArray<string> = [
  // Video
  "Main Video",
  "A-Roll",
  "B-Roll",
  "Interview",
  "Drone Footage",
  "Screen Recording",
  // Audio
  "Voiceover",
  "Music",
  "Sound Effects",
  "Location Audio",
  // Graphics
  "Photos",
  "Graphics",
  "Thumbnail",
  "Captions / Transcript",
  // Project
  "Project File",
  "Final Export",
  "Backup",
  // System
  "Untagged Media",
];

const ROLES_BY_WORKFLOW: Record<ProjectWorkflowType, ReadonlyArray<string>> = {
  podcast_studio: PODCAST_STUDIO_ROLES,
  general_video: GENERAL_VIDEO_ROLES,
};

/**
 * Returns the dropdown options for a given workflow. Always appends
 * "Other" as a final freeform escape hatch so teachers/students are
 * never blocked by a missing role. Falls back to general_video when
 * `workflow` is null/undefined or an unrecognised value (e.g. data
 * from a future workflow type returned to an older client).
 */
export function getMediaRolesForWorkflow(
  workflow: string | null | undefined,
): ReadonlyArray<string> {
  const key: ProjectWorkflowType =
    workflow === "podcast_studio" || workflow === "general_video"
      ? workflow
      : DEFAULT_WORKFLOW_TYPE;
  return [...ROLES_BY_WORKFLOW[key], "Other"];
}

export function getWorkflowLabel(
  workflow: string | null | undefined,
): string {
  const found = WORKFLOW_OPTIONS.find((o) => o.value === workflow);
  return found?.label ?? "General Video Project";
}
