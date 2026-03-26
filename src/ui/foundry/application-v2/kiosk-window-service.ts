export const KIOSK_HOST_ID = "fth-kiosk-container";
export const KIOSK_HOST_CLASS = "fth-kiosk-host";
export const KIOSK_BODY_CLASS = "fth-kiosk";

export interface KioskWindowOptions {
  frame?: boolean;
  positioned?: boolean;
  [key: string]: unknown;
}

export interface KioskAttachOptions {
  suppressUi?: boolean;
}

export function getKioskWindowOptions<T extends KioskWindowOptions | undefined>(
  windowOptions?: T,
): (T extends undefined ? Record<string, never> : T) & { frame: false; positioned: false } {
  return {
    ...(windowOptions ?? {}),
    frame: false,
    positioned: false,
  } as (T extends undefined ? Record<string, never> : T) & { frame: false; positioned: false };
}

export function ensureKioskHost(): HTMLElement {
  const existing = document.getElementById(KIOSK_HOST_ID);
  if (existing instanceof HTMLElement) {
    existing.classList.add(KIOSK_HOST_CLASS);
    return existing;
  }

  const host = document.createElement("div");
  host.id = KIOSK_HOST_ID;
  host.classList.add(KIOSK_HOST_CLASS);
  document.body.appendChild(host);
  return host;
}

export function removeKioskHost(): void {
  document.getElementById(KIOSK_HOST_ID)?.remove();
}

export function setKioskUiSuppressed(active: boolean): void {
  document.body.classList.toggle(KIOSK_BODY_CLASS, active);
}

export function attachElementToKioskHost(
  element: HTMLElement,
  options: KioskAttachOptions = {},
): HTMLElement {
  const host = ensureKioskHost();
  if (element.parentElement !== host) {
    host.appendChild(element);
  }

  if (options.suppressUi) {
    setKioskUiSuppressed(true);
  }

  return host;
}

export function detachElementFromKioskHost(
  element: HTMLElement | null | undefined,
  options: KioskAttachOptions = {},
): void {
  if (!(element instanceof HTMLElement)) return;

  const host = document.getElementById(KIOSK_HOST_ID);
  if (host instanceof HTMLElement && element.parentElement === host) {
    element.remove();
    if (!host.childElementCount) {
      host.remove();
    }
  }

  if (options.suppressUi) {
    setKioskUiSuppressed(false);
  }
}
