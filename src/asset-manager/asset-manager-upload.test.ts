import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processUploadQueueItemOptimization: vi.fn(),
}));

vi.mock("./asset-manager-upload-processing", () => ({
  processUploadQueueItemOptimization: mocks.processUploadQueueItemOptimization,
}));

import { UploadManager, buildUploadQueueHTML, describeEmptyUploadPathFailure, describeUploadFailure } from "./asset-manager-upload";
import type { UploadQueueItem } from "./asset-manager-upload";

function makeItem(overrides: Partial<UploadQueueItem> = {}): UploadQueueItem {
  return {
    id: 1,
    file: new File(["x"], "Huge Map.png", { type: "image/png" }),
    originalName: "Huge Map.png",
    outputName: "huge-map.webp",
    preset: "map",
    status: "done",
    progress: 100,
    originalSize: 120_000_000,
    optimizedSize: 15_000_000,
    ...overrides,
  };
}

describe("asset manager upload helpers", () => {
  it("marks an upload as failed when Foundry returns no upload path", async () => {
    mocks.processUploadQueueItemOptimization.mockResolvedValue(new File(["x"], "Huge Map.png", { type: "image/png" }));

    const updates: UploadQueueItem[][] = [];
    const manager = new UploadManager(
      (queue) => {
        updates.push(queue.map((item) => ({ ...item })));
      },
      async () => "",
      vi.fn(),
    );

    manager.enqueue([new File(["x"], "Huge Map.png", { type: "image/png" })], "map");

    for (let i = 0; i < 20; i += 1) {
      if (updates.at(-1)?.[0]?.status === "error") break;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const last = updates.at(-1)?.[0];
    expect(last?.status).toBe("error");
    expect(last?.error).toContain("returned no file path");
    expect(last?.error).toContain("Foundry server upload limit");
    expect(last?.error).toContain("Huge Map.png");
  });

  it("renders queue notes alongside the upload status", () => {
    const html = buildUploadQueueHTML([
      makeItem({
        note: "Skipped optimizer server: 120 MB exceeds its 100 MB upload limit.",
      }),
    ]);

    expect(html).toContain("Upload queue");
    expect(html).toContain("Skipped optimizer server");
    expect(html).toContain("am-uq-note");
  });

  it("turns 413 upload failures into a Foundry size-limit message", () => {
    const message = describeUploadFailure({
      statusCode: 413,
      message: "Request Entity Too Large",
    }, new File(["x"], "Huge Map.png", { type: "image/png" }));

    expect(message).toContain("Huge Map.png");
    expect(message).toContain("Foundry server limit");
    expect(message).toContain("Request Entity Too Large");
  });

  it("describes an empty upload path as a Foundry size-limit failure", () => {
    const message = describeEmptyUploadPathFailure(
      new File(["x"], "Huge Map.png", { type: "image/png" }),
      "huge-map.webp",
    );

    expect(message).toContain("huge-map.webp");
    expect(message).toContain("returned no file path");
    expect(message).toContain("Foundry server upload limit");
  });
});
