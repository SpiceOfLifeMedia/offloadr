// Smart Draft V1 composer — school news report only.
//
// Hard scope rules (do not generalise this file):
//   - One project type. One template. No speech detection, no highlight
//     detection, no clip selection magic. Clips play in upload order.
//   - Title card, clips, end card. Simple fade transitions.
//   - Unknown clip durations default to 8s. We do NOT use Shotstack's
//     "length: auto" because we need a known start offset for each
//     subsequent clip — start offsets can't be 'auto'.
//   - HTML title/end cards rendered server-side by Shotstack. No
//     external font loads, no school branding for V1.
//
// When (not if) we expand to other project types — podcast, excursion
// recap, oral presentation — add a new composer file and dispatch on
// project.lessonType inside the adapter, not by branching this one.

export interface ComposerSourceClip {
  url: string;
  mimeType: string;
  /** Seconds. Fallback used when DB column is null. */
  duration: number | null;
  /** Optional lower-third name. Shown briefly at the start of the clip. */
  studentName?: string | null;
}

export interface ComposerInput {
  projectName: string;
  classGroup?: string | null;
  clips: ComposerSourceClip[];
  /** Optional webhook URL Shotstack will POST to on status changes. */
  callbackUrl?: string;
}

const DEFAULT_CLIP_LENGTH_SEC = 8;
const TITLE_CARD_LENGTH_SEC = 3;
const END_CARD_LENGTH_SEC = 3;
const FADE_LENGTH_SEC = 0.5;
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const LOWER_THIRD_LENGTH_SEC = 3;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleCard(projectName: string, classGroup: string | null | undefined) {
  const subtitle = classGroup ? `<span class="sub">${escapeHtml(classGroup)}</span>` : "";
  return {
    asset: {
      type: "html" as const,
      html: `<div class="wrap"><p class="title">${escapeHtml(projectName)}</p>${subtitle}</div>`,
      css:
        ".wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;}" +
        ".title{color:#fff;font-family:'Open Sans',sans-serif;font-size:68px;font-weight:700;text-align:center;margin:0;}" +
        ".sub{color:#8b5cf6;font-family:'Open Sans',sans-serif;font-size:32px;margin-top:14px;letter-spacing:2px;text-transform:uppercase;}",
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      background: "#0a0a0a",
    },
    start: 0,
    length: TITLE_CARD_LENGTH_SEC,
    transition: { out: "fade" },
  };
}

function endCard(start: number) {
  return {
    asset: {
      type: "html" as const,
      html: `<div class="wrap"><p class="end">Created with Offloadr</p><span class="sub">Classroom media workflows</span></div>`,
      css:
        ".wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;}" +
        ".end{color:#fff;font-family:'Open Sans',sans-serif;font-size:48px;font-weight:600;text-align:center;margin:0;}" +
        ".sub{color:#3b82f6;font-family:'Open Sans',sans-serif;font-size:22px;margin-top:14px;letter-spacing:1px;}",
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      background: "#0a0a0a",
    },
    start,
    length: END_CARD_LENGTH_SEC,
    transition: { in: "fade" },
  };
}

function videoClip(src: ComposerSourceClip, start: number, length: number) {
  return {
    asset: { type: "video" as const, src: src.url },
    start,
    length,
    transition: { in: "fade", out: "fade" },
  };
}

function lowerThird(name: string, start: number) {
  return {
    asset: {
      type: "html" as const,
      html: `<div class="lt"><span class="dot"></span><span class="name">${escapeHtml(name)}</span></div>`,
      css:
        ".lt{display:flex;align-items:center;gap:12px;padding:14px 22px;background:rgba(10,10,10,0.85);border-left:4px solid #3b82f6;border-radius:6px;}" +
        ".dot{width:8px;height:8px;border-radius:50%;background:#3b82f6;}" +
        ".name{color:#fff;font-family:'Open Sans',sans-serif;font-size:28px;font-weight:600;letter-spacing:0.5px;}",
      width: 520,
      height: 80,
      background: "transparent",
    },
    start,
    length: LOWER_THIRD_LENGTH_SEC,
    position: "bottomLeft" as const,
    offset: { x: 0.04, y: 0.06 },
    transition: { in: "slideRight", out: "fade" },
  };
}

/**
 * Build the Shotstack render JSON for a school news report.
 *
 * Layout:
 *   Track 1 (top): lower-third name tags (overlays)
 *   Track 2: title card → video clips → end card (the spine)
 *
 * Shotstack stacks tracks visually top-to-bottom, so overlays go on the
 * higher-index track in the array.
 */
export function buildNewsReportTimeline(input: ComposerInput): Record<string, unknown> {
  const spineClips: Array<Record<string, unknown>> = [];
  const overlayClips: Array<Record<string, unknown>> = [];

  // 1. Title card
  spineClips.push(titleCard(input.projectName, input.classGroup ?? null));

  // 2. Video clips back-to-back, starting right after the title card.
  // We subtract one fade-length per join so the cross-fade overlaps
  // cleanly without leaving black frames.
  let cursor = TITLE_CARD_LENGTH_SEC - FADE_LENGTH_SEC;
  for (const clip of input.clips) {
    const length = clip.duration && clip.duration > 0 ? clip.duration : DEFAULT_CLIP_LENGTH_SEC;
    spineClips.push(videoClip(clip, cursor, length));
    if (clip.studentName) {
      // Lower-third comes in 0.5s after the clip starts, lingers 3s.
      overlayClips.push(lowerThird(clip.studentName, cursor + 0.5));
    }
    cursor += length - FADE_LENGTH_SEC;
  }

  // 3. End card, picking up after the last clip's outgoing fade.
  spineClips.push(endCard(cursor));

  const tracks: Array<Record<string, unknown>> = [];
  if (overlayClips.length > 0) tracks.push({ clips: overlayClips });
  tracks.push({ clips: spineClips });

  const body: Record<string, unknown> = {
    timeline: {
      background: "#000000",
      fonts: [],
      tracks,
    },
    output: {
      format: "mp4",
      resolution: "hd", // 1280x720
      fps: 25,
    },
  };

  if (input.callbackUrl) body["callback"] = input.callbackUrl;

  return body;
}
