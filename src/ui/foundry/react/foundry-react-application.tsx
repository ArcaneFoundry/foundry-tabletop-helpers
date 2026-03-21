import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

export class FoundryReactRenderer {
  private _root: Root | null = null;
  private _container: HTMLElement | null = null;

  render(container: HTMLElement, node: ReactNode): void {
    if (this._container !== container) {
      this.unmount();
      this._root = createRoot(container);
      this._container = container;
    }

    this._root!.render(node);
  }

  unmount(): void {
    this._root?.unmount();
    this._root = null;
    this._container = null;
  }
}

export function getFoundryReactMount(root: Element | null | undefined): HTMLElement | null {
  const mount = root?.querySelector("[data-fth-react-root]");
  return typeof HTMLElement !== "undefined" && mount instanceof HTMLElement ? mount : null;
}
