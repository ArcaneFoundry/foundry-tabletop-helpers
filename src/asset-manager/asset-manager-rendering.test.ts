import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  Log: { info: vi.fn() },
  MOD: "fth",
}));

vi.mock("./asset-manager-metadata", () => ({
  getMetadataStore: () => ({
    getAllTags: () => [],
    getTagColor: () => "#ffffff",
  }),
}));

import { buildPreviewHTML } from "./asset-manager-preview";
import { buildHTML, buildShellHTML, type AssetManagerRenderState } from "./asset-manager-picker-rendering";
import { showUploadConfirmDialog } from "./asset-manager-upload-dialog";
import { buildUploadQueueHTML, describeUploadFailure } from "./asset-manager-upload";
import type { AssetEntry } from "./asset-manager-types";

const esc = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function buildState(): AssetManagerRenderState {
  const entries: AssetEntry[] = [
    {
      path: "art/goblin.webp",
      name: "goblin.webp",
      ext: "webp",
      isDir: false,
      size: 123,
      type: "image",
    },
  ];

  return {
    currentPath: "art/monsters",
    search: "goblin",
    collection: "images",
    filters: [{ type: "tag", value: "monsters" }],
    entries,
    filteredEntries: entries,
    previewPath: "art/goblin.webp",
    unoptimizedCount: 0,
    density: "medium",
    viewMode: "grid",
    sortField: "name",
    sortDir: "asc",
    sidebarOpen: true,
    serverAvailable: true,
    serverStatusTitle: "Optimizer server connected — images, audio, video",
  };
}

describe("asset manager rendering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).game = {
      settings: {
        get: vi.fn(() => false),
      },
    };
  });

  it("builds shell and populated HTML with the new workspace hierarchy", () => {
    const state = buildState();

    const shell = buildShellHTML(state, { esc });
    const html = buildHTML(state, { esc });

    expect(shell).toContain("am-toolbar-leading");
    expect(shell).toContain("am-toolbar-group-actions");
    expect(shell).toContain("am-breadcrumbs-label");
    expect(shell).toContain("am-status-primary");
    expect(shell).toContain("am-status-secondary");

    expect(html).toContain("am-toolbar-leading");
    expect(html).toContain("am-breadcrumbs-track");
    expect(html).toContain("am-content-wrap am-has-preview");
    expect(html).toContain("am-status-primary");
    expect(html).toContain("am-status-secondary");
  });

  it("renders offline server affordances with disabled server-only controls", () => {
    const state = {
      ...buildState(),
      serverAvailable: false,
      serverStatusTitle: "Optimizer server unavailable. Folder creation and deletion are disabled; uploads fall back to client-side optimization where possible.",
    };

    const html = buildHTML(state, { esc, serverAvailable: false });

    expect(html).toContain("Folder creation requires the optimizer server");
    expect(html).toContain("am-create-folder-btn\" type=\"button\" title=\"Folder creation requires the optimizer server. The current server connection is unavailable.\" disabled");
    expect(html).toContain("am-crumb-delete\" type=\"button\" title=\"Deletion requires the optimizer server. The current server connection is unavailable.\" disabled");
    expect(html).toContain("am-server-note\">Server offline. Folder creation and deletion require the companion server.");
    expect(html).toContain("client-side fallback");
  });

  it("builds preview and upload queue surfaces with the new heading hierarchy", () => {
    const entry: AssetEntry = {
      path: "art/goblin.webp",
      name: "Goblin",
      ext: "webp",
      isDir: false,
      size: 123,
      type: "image",
    };

    const preview = buildPreviewHTML(entry, { size: 123, format: "WEBP" }, esc);
    const queue = buildUploadQueueHTML([
      {
        id: 1,
        file: new File(["a"], "goblin.webp", { type: "image/webp" }),
        originalName: "goblin.png",
        outputName: "goblin.webp",
        preset: "token",
        status: "uploading",
        progress: 42,
        originalSize: 1000,
        optimizedSize: 0,
        note: "Skipped optimizer server: 120 MB exceeds its 100 MB upload limit.",
      },
    ]);

    expect(preview).toContain("am-preview-heading");
    expect(preview).toContain("am-preview-eyebrow");
    expect(queue).toContain("am-uq-heading");
    expect(queue).toContain("am-uq-eyebrow");
    expect(queue).toContain("am-uq-note");
  });

  it("formats 413 upload failures with a specific Foundry limit message", () => {
    const file = new File(["map"], "world-map.webp", { type: "image/webp" });
    Object.defineProperty(file, "size", { value: 180_000_000 });

    const message = describeUploadFailure(new Error("413 Request Entity Too Large"), file);

    expect(message).toContain("Upload exceeded the Foundry server limit");
    expect(message).toContain("world-map.webp");
  });

  it("renders the upload dialog with the compact themed structure", async () => {
    let capturedContent = "";

    class DialogStub {
      #config: {
        content: string;
        close: () => void;
      };

      constructor(config: { content: string; close: () => void }) {
        this.#config = config;
        capturedContent = config.content;
      }

      render(): this {
        this.#config.close();
        return this;
      }
    }

    (globalThis as Record<string, unknown>).Dialog = DialogStub;

    await showUploadConfirmDialog(
      [new File(["image"], "goblin.png", { type: "image/png" })],
      "art/monsters",
    );

    expect(capturedContent).toContain("am-upload-dialog");
    expect(capturedContent).toContain("am-ud-eyebrow");
    expect(capturedContent).toContain("am-ud-row-main");
    expect(capturedContent).toContain("am-ud-row-actions");
    expect(capturedContent).toContain("Destination <code>art/monsters</code>");
  });
});
