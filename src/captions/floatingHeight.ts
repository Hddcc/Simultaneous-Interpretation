export interface FloatingHeightRequestState {
  appliedHeight: number;
  pendingShrinkHeight: number | null;
  pendingShrinkSinceMs: number | null;
}

export interface PlanFloatingHeightRequestInput {
  measuredHeight: number;
  state: FloatingHeightRequestState;
  nowMs: number;
  settleMs?: number;
  thresholdPx?: number;
}

export interface PlanFloatingHeightRequestResult {
  state: FloatingHeightRequestState;
  requestHeight: number | null;
  recheckInMs: number | null;
}

/** A streaming translation gains lines quickly; shrinking waits for the cue to settle. */
export const DEFAULT_FLOATING_SHRINK_SETTLE_MS = 900;
export const DEFAULT_FLOATING_HEIGHT_THRESHOLD_PX = 4;

export const initialFloatingHeightRequestState: FloatingHeightRequestState = {
  appliedHeight: 0,
  pendingShrinkHeight: null,
  pendingShrinkSinceMs: null
};

function clearPendingShrink(state: FloatingHeightRequestState): FloatingHeightRequestState {
  if (state.pendingShrinkHeight === null && state.pendingShrinkSinceMs === null) {
    return state;
  }

  return { ...state, pendingShrinkHeight: null, pendingShrinkSinceMs: null };
}

/**
 * Decides whether the overlay should ask the main process for a new window height.
 *
 * Growth applies immediately so a caption is never clipped mid-sentence, while
 * shrinking waits for the measurement to hold still. Without that asymmetry a
 * streaming translation makes the window step up and down on every token, which
 * reads as flicker rather than as captions.
 */
export function planFloatingHeightRequest(
  input: PlanFloatingHeightRequestInput
): PlanFloatingHeightRequestResult {
  const settleMs = input.settleMs ?? DEFAULT_FLOATING_SHRINK_SETTLE_MS;
  const thresholdPx = input.thresholdPx ?? DEFAULT_FLOATING_HEIGHT_THRESHOLD_PX;
  const { state } = input;

  if (!Number.isFinite(input.measuredHeight) || input.measuredHeight <= 0) {
    return { state, requestHeight: null, recheckInMs: null };
  }

  const measuredHeight = Math.ceil(input.measuredHeight);
  const delta = measuredHeight - state.appliedHeight;

  if (Math.abs(delta) < thresholdPx) {
    return { state: clearPendingShrink(state), requestHeight: null, recheckInMs: null };
  }

  if (delta > 0) {
    return {
      state: clearPendingShrink({ ...state, appliedHeight: measuredHeight }),
      requestHeight: measuredHeight,
      recheckInMs: null
    };
  }

  const isSamePendingHeight =
    state.pendingShrinkHeight !== null &&
    Math.abs(measuredHeight - state.pendingShrinkHeight) < thresholdPx;

  if (!isSamePendingHeight || state.pendingShrinkSinceMs === null) {
    return {
      state: {
        ...state,
        pendingShrinkHeight: measuredHeight,
        pendingShrinkSinceMs: input.nowMs
      },
      requestHeight: null,
      recheckInMs: settleMs
    };
  }

  const waitedMs = input.nowMs - state.pendingShrinkSinceMs;

  if (waitedMs < settleMs) {
    return { state, requestHeight: null, recheckInMs: settleMs - waitedMs };
  }

  return {
    state: clearPendingShrink({ ...state, appliedHeight: measuredHeight }),
    requestHeight: measuredHeight,
    recheckInMs: null
  };
}
