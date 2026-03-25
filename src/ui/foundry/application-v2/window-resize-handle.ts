export interface ApplicationV2Like {
  hasFrame?: boolean;
  window?: {
    resize?: HTMLElement | null;
  };
}

const RESIZE_HANDLE_CLASS = "fth-window-resize-handle";
const RESIZE_AFFORDANCE = "native";

export function ensureNativeWindowResizeHandle(app: ApplicationV2Like): HTMLElement | null {
  if (!app?.hasFrame) return null;

  const resize = app.window?.resize ?? null;
  if (!(resize instanceof HTMLElement)) return null;

  resize.classList.add(RESIZE_HANDLE_CLASS);
  if (resize.getAttribute("data-fth-window-affordance") !== RESIZE_AFFORDANCE) {
    resize.setAttribute("data-fth-window-affordance", RESIZE_AFFORDANCE);
  }

  return resize;
}
