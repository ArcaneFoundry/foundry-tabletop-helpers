import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  attachElementToKioskHost,
  detachElementFromKioskHost,
  ensureKioskHost,
  getKioskWindowOptions,
  KIOSK_BODY_CLASS,
  KIOSK_HOST_CLASS,
  KIOSK_HOST_ID,
  removeKioskHost,
  setKioskUiSuppressed,
} from "./kiosk-window-service";

describe("kiosk-window-service", () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;

  beforeEach(() => {
    Object.defineProperty(globalThis, "HTMLElement", {
      value: FakeElement,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "document", {
      value: new FakeDocument(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    document.body.classList.remove(KIOSK_BODY_CLASS);
    document.body.innerHTML = "";

    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "HTMLElement", {
      value: originalHTMLElement,
      configurable: true,
      writable: true,
    });
  });

  it("creates the kiosk host once and reuses it across repeated calls", () => {
    const first = ensureKioskHost();
    const second = ensureKioskHost();

    expect(second).toBe(first);
    expect(first.id).toBe(KIOSK_HOST_ID);
    expect(first.classList.contains(KIOSK_HOST_CLASS)).toBe(true);
    expect(countElementsById(KIOSK_HOST_ID)).toBe(1);
  });

  it("attaches an application element into the kiosk host outside the default window stack", () => {
    const uiWindows = document.createElement("div");
    uiWindows.id = "ui-windows";
    const appElement = document.createElement("section");
    uiWindows.appendChild(appElement);
    document.body.appendChild(uiWindows);

    const host = attachElementToKioskHost(appElement);

    expect(appElement.parentElement).toBe(host);
    expect(host.parentElement).toBe(document.body);
    expect(host.id).toBe(KIOSK_HOST_ID);
    expect(uiWindows.contains(appElement)).toBe(false);
  });

  it("detaches an application element and removes the host once it is empty", () => {
    const appElement = document.createElement("section");
    const host = attachElementToKioskHost(appElement);

    detachElementFromKioskHost(appElement);

    expect(host.isConnected).toBe(false);
    expect(appElement.isConnected).toBe(false);
    expect(document.getElementById(KIOSK_HOST_ID)).toBeNull();
  });

  it("toggles kiosk UI suppression through the shared body class", () => {
    setKioskUiSuppressed(true);
    expect(document.body.classList.contains(KIOSK_BODY_CLASS)).toBe(true);

    setKioskUiSuppressed(true);
    expect(document.body.classList.contains(KIOSK_BODY_CLASS)).toBe(true);

    setKioskUiSuppressed(false);
    expect(document.body.classList.contains(KIOSK_BODY_CLASS)).toBe(false);
  });

  it("can attach and detach repeatedly without leaking duplicate hosts or body classes", () => {
    const first = document.createElement("section");
    attachElementToKioskHost(first, { suppressUi: true });
    detachElementFromKioskHost(first, { suppressUi: true });

    const second = document.createElement("section");
    const host = attachElementToKioskHost(second, { suppressUi: true });

    expect(countElementsById(KIOSK_HOST_ID)).toBe(1);
    expect(second.parentElement).toBe(host);
    expect(document.body.classList.contains(KIOSK_BODY_CLASS)).toBe(true);

    detachElementFromKioskHost(second, { suppressUi: true });

    expect(document.getElementById(KIOSK_HOST_ID)).toBeNull();
    expect(document.body.classList.contains(KIOSK_BODY_CLASS)).toBe(false);
  });

  it("merges kiosk window defaults while preserving other window options", () => {
    expect(getKioskWindowOptions({ resizable: true, icon: "fa-solid fa-wand" })).toEqual({
      resizable: true,
      icon: "fa-solid fa-wand",
      frame: false,
      positioned: false,
    });
  });

  it("can remove the kiosk host explicitly", () => {
    ensureKioskHost();
    removeKioskHost();
    expect(document.getElementById(KIOSK_HOST_ID)).toBeNull();
  });
});

function makeClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (...values: string[]) => values.forEach((value) => classes.add(value)),
    remove: (...values: string[]) => values.forEach((value) => classes.delete(value)),
    contains: (value: string) => classes.has(value),
    toggle: (value: string, force?: boolean) => {
      if (force === true) {
        classes.add(value);
        return true;
      }
      if (force === false) {
        classes.delete(value);
        return false;
      }
      if (classes.has(value)) {
        classes.delete(value);
        return false;
      }
      classes.add(value);
      return true;
    },
  };
}

class FakeElement {
  public id = "";
  public children: FakeElement[] = [];
  public parentElement: FakeElement | null = null;
  public classList = makeClassList();

  constructor(public tagName = "div") {}

  get isConnected(): boolean {
    return this.parentElement !== null || this === (document as unknown as FakeDocument).body;
  }

  get childElementCount(): number {
    return this.children.length;
  }

  get innerHTML(): string {
    return "";
  }

  set innerHTML(_value: string) {
    for (const child of [...this.children]) {
      child.parentElement = null;
    }
    this.children = [];
  }

  appendChild(child: FakeElement): FakeElement {
    if (child.parentElement) {
      child.parentElement.children = child.parentElement.children.filter((candidate) => candidate !== child);
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((candidate) => candidate !== this);
    this.parentElement = null;
  }

  contains(candidate: FakeElement): boolean {
    if (this.children.includes(candidate)) return true;
    return this.children.some((child) => child.contains(candidate));
  }
}

class FakeDocument {
  public body = new FakeElement("body");

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  getElementById(id: string): FakeElement | null {
    const visit = (node: FakeElement): FakeElement | null => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const match = visit(child);
        if (match) return match;
      }
      return null;
    };

    return visit(this.body);
  }
}

function countElementsById(id: string): number {
  return document.getElementById(id) ? 1 : 0;
}
