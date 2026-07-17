import { onScopeDispose, watch } from "vue";

let activeLocks = 0;
let savedState = null;

function acquireDocumentScrollLock() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  activeLocks += 1;
  if (activeLocks > 1) return true;

  const root = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);

  savedState = {
    scrollX,
    scrollY,
    rootOverflow: root.style.overflow,
    rootOverscrollBehavior: root.style.overscrollBehavior,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
    bodyPaddingRight: body.style.paddingRight,
  };

  root.style.overflow = "hidden";
  root.style.overscrollBehavior = "none";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = `-${scrollX}px`;
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";

  if (scrollbarWidth > 0) {
    const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }

  return true;
}

function releaseDocumentScrollLock() {
  if (activeLocks === 0) return;

  activeLocks -= 1;
  if (activeLocks > 0 || !savedState) return;

  const root = document.documentElement;
  const body = document.body;
  const state = savedState;
  savedState = null;

  root.style.overflow = state.rootOverflow;
  root.style.overscrollBehavior = state.rootOverscrollBehavior;
  body.style.position = state.bodyPosition;
  body.style.top = state.bodyTop;
  body.style.left = state.bodyLeft;
  body.style.width = state.bodyWidth;
  body.style.overflow = state.bodyOverflow;
  body.style.overscrollBehavior = state.bodyOverscrollBehavior;
  body.style.paddingRight = state.bodyPaddingRight;
  window.scrollTo(state.scrollX, state.scrollY);
}

export function useDocumentScrollLock(locked) {
  let ownsLock = false;

  const stop = watch(
    locked,
    (shouldLock) => {
      if (shouldLock && !ownsLock) {
        ownsLock = acquireDocumentScrollLock();
      } else if (!shouldLock && ownsLock) {
        ownsLock = false;
        releaseDocumentScrollLock();
      }
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(() => {
    stop();
    if (!ownsLock) return;
    ownsLock = false;
    releaseDocumentScrollLock();
  });
}
