import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkOptimizerServer: vi.fn(),
  serverCreateFolder: vi.fn(),
}));

vi.mock("./asset-manager-optimizer-client", () => ({
  checkOptimizerServer: mocks.checkOptimizerServer,
  serverCreateFolder: mocks.serverCreateFolder,
}));

vi.mock("./asset-manager-browse-cache", () => ({
  getBrowseCache: () => ({
    invalidate: vi.fn(),
  }),
}));

vi.mock("./asset-manager-metadata", () => ({
  getMetadataStore: () => ({
    addTag: vi.fn(),
  }),
}));

vi.mock("./asset-manager-upload-dialog", () => ({
  showUploadConfirmDialog: vi.fn(),
}));

import { AssetManagerUploadController } from "./asset-manager-picker-upload";

describe("asset manager upload controller", () => {
  beforeEach(() => {
    mocks.checkOptimizerServer.mockReset();
    mocks.serverCreateFolder.mockReset();
    (globalThis as Record<string, unknown>).ui = { notifications: { warn: vi.fn() } };
    (globalThis as Record<string, unknown>).Dialog = undefined;
  });

  it("blocks folder creation and explains why when the optimizer server is unavailable", async () => {
    mocks.checkOptimizerServer.mockResolvedValue(null);

    const statusCount = { textContent: "7 items" };
    const root = {
      querySelector(selector: string) {
        if (selector === ".am-status-count") return statusCount;
        return null;
      },
    } as unknown as HTMLElement;

    const controller = new AssetManagerUploadController({
      getCurrentPath: () => "art",
      getActiveSource: () => "data",
      getEntries: () => [],
      getBatchRunning: () => false,
      setBatchRunning: vi.fn(),
      getUploader: () => null,
      setUploader: vi.fn(),
      browse: vi.fn(),
      suppressInfoNotifications: () => () => {},
      baseFilePickerUpload: vi.fn(),
    });

    await controller.promptCreateFolder(root);

    expect(mocks.serverCreateFolder).not.toHaveBeenCalled();
    expect(statusCount.textContent).toBe(
      "Folder creation requires the optimizer server. The current server connection is unavailable.",
    );
    expect(((globalThis as Record<string, unknown>).ui as { notifications: { warn: ReturnType<typeof vi.fn> } }).notifications.warn)
      .toHaveBeenCalledWith("Folder creation requires the optimizer server. The current server connection is unavailable.");
  });
});
