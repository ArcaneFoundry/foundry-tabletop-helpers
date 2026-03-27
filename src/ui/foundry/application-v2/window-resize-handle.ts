export interface ApplicationV2Like {
  hasFrame?: boolean;
  window?: {
    resize?: HTMLElement | null;
  };
}

export function ensureNativeWindowResizeHandle(app: ApplicationV2Like): HTMLElement | null {
  if (app?.hasFrame === false) return null;

  const resize = app.window?.resize ?? null;
  if (!(resize instanceof HTMLElement)) return null;

  return resize;
}
