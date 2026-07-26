export type FloatingCaptionBackdrop = "none" | "soft" | "solid";

export type FloatingCaptionCommand = "toggle-session";

export interface FloatingWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingCaptionPreferences {
  locked: boolean;
  mousePassthrough: boolean;
  backdrop: FloatingCaptionBackdrop;
  opacity: number;
  fontScale: number;
}

export interface FloatingCaptionContent {
  translatedText: string;
  sourceText: string;
  previousText: string | null;
  statusLabel: string;
  compactStatusLabel: string;
  severity: "neutral" | "active" | "warning" | "error";
  languageDirection: string;
  sessionStatus: string;
  latencyLabel: string;
  revised: boolean;
  running: boolean;
  controlsVisible: boolean;
  updatedAtMs: number;
}

export type FloatingCaptionState = FloatingCaptionContent & FloatingCaptionPreferences;

export const FLOATING_MIN_WIDTH = 360;
export const FLOATING_MIN_HEIGHT = 88;
export const FLOATING_WIDTH_STEP = 80;
export const FLOATING_EDGE_MARGIN = 16;
const FLOATING_MAX_HEIGHT_RATIO = 0.6;

export const defaultFloatingCaptionPreferences: FloatingCaptionPreferences = {
  locked: false,
  mousePassthrough: false,
  backdrop: "none",
  opacity: 0.92,
  fontScale: 1
};

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Grows or shrinks the floating window so its height matches the measured caption
 * content, keeping the edge nearest the user's chosen side of the screen anchored.
 */
export function resolveFloatingHeight(input: {
  contentHeight: number;
  bounds: FloatingWindowRect;
  workArea: FloatingWindowRect;
}): FloatingWindowRect {
  const { bounds, workArea } = input;
  const maxHeight = Math.max(
    FLOATING_MIN_HEIGHT,
    Math.floor(workArea.height * FLOATING_MAX_HEIGHT_RATIO)
  );
  const requested = isFiniteNumber(input.contentHeight) ? Math.ceil(input.contentHeight) : bounds.height;
  const height = clamp(requested, FLOATING_MIN_HEIGHT, maxHeight);

  const centerY = bounds.y + bounds.height / 2;
  const anchorsBottom = centerY > workArea.y + workArea.height / 2;
  const rawY = anchorsBottom ? bounds.y + bounds.height - height : bounds.y;
  const y = clamp(rawY, workArea.y, workArea.y + workArea.height - height);

  return { x: bounds.x, y, width: bounds.width, height };
}

/**
 * Steps the floating window width, keeping the edge closest to the screen border
 * pinned so the overlay does not drift away from where the user parked it.
 */
export function resolveFloatingWidth(input: {
  delta: number;
  bounds: FloatingWindowRect;
  workArea: FloatingWindowRect;
}): FloatingWindowRect {
  const { bounds, workArea } = input;
  const steps = isFiniteNumber(input.delta) ? Math.trunc(input.delta) : 0;
  const maxWidth = Math.max(FLOATING_MIN_WIDTH, workArea.width - FLOATING_EDGE_MARGIN * 2);
  const width = clamp(bounds.width + steps * FLOATING_WIDTH_STEP, FLOATING_MIN_WIDTH, maxWidth);

  const centerX = bounds.x + bounds.width / 2;
  const anchorsRight = centerX > workArea.x + workArea.width / 2;
  const rawX = anchorsRight ? bounds.x + bounds.width - width : bounds.x;
  const x = clamp(rawX, workArea.x, workArea.x + workArea.width - width);

  return { x, y: bounds.y, width, height: bounds.height };
}

export function normalizeFloatingCaptionPreferences(
  input: Partial<FloatingCaptionPreferences> | null | undefined,
  fallback: FloatingCaptionPreferences = defaultFloatingCaptionPreferences
): FloatingCaptionPreferences {
  const backdrop = input?.backdrop;

  return {
    locked: typeof input?.locked === "boolean" ? input.locked : fallback.locked,
    mousePassthrough:
      typeof input?.mousePassthrough === "boolean"
        ? input.mousePassthrough
        : fallback.mousePassthrough,
    backdrop:
      backdrop === "none" || backdrop === "soft" || backdrop === "solid" ? backdrop : fallback.backdrop,
    opacity: isFiniteNumber(input?.opacity) ? clamp(input.opacity, 0.2, 1) : fallback.opacity,
    fontScale: isFiniteNumber(input?.fontScale) ? clamp(input.fontScale, 0.7, 2.2) : fallback.fontScale
  };
}

/**
 * The main window owns caption content while the overlay owns its own display
 * preferences. Merging here stops a caption refresh from resetting the font size,
 * backdrop, or lock state the user picked inside the overlay.
 */
export function mergeFloatingCaptionState(
  content: FloatingCaptionContent,
  preferences: FloatingCaptionPreferences
): FloatingCaptionState {
  return { ...content, ...preferences };
}

export function extractFloatingCaptionContent(
  state: FloatingCaptionState | FloatingCaptionContent
): FloatingCaptionContent {
  return {
    translatedText: state.translatedText,
    sourceText: state.sourceText,
    previousText: state.previousText,
    statusLabel: state.statusLabel,
    compactStatusLabel: state.compactStatusLabel,
    severity: state.severity,
    languageDirection: state.languageDirection,
    sessionStatus: state.sessionStatus,
    latencyLabel: state.latencyLabel,
    revised: state.revised,
    running: state.running,
    controlsVisible: state.controlsVisible,
    updatedAtMs: state.updatedAtMs
  };
}
