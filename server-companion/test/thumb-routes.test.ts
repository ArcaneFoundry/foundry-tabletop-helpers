import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { buildMultipartBody, makeConfig, makeTempDir, removeTempDir, writeTestImage } from "./helpers.js";

const apps: Array<Awaited<ReturnType<typeof createServer>>> = [];
const tempDirs: string[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()?.close();
  }
  while (tempDirs.length > 0) {
    await removeTempDir(tempDirs.pop() as string);
  }
});

describe("thumbnail routes", () => {
  it("creates and serves cached thumbnails with etag support", async () => {
    const root = await makeTempDir("fth-thumb-");
    tempDirs.push(root);
    await mkdir(join(root, "assets/maps"), { recursive: true });
    await writeTestImage(join(root, "assets/maps/test.png"));
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const first = await app.inject({
      method: "GET",
      url: "/thumb?path=assets/maps/test.png&token=test-token",
    });

    expect(first.statusCode).toBe(200);
    expect(first.headers["content-type"]).toContain("image/webp");
    expect(first.headers.etag).toBeTruthy();

    const thumbPath = join(root, ".fth-thumbs/assets/maps/test.png.webp");
    const thumbStat = await stat(thumbPath);
    expect(thumbStat.isFile()).toBe(true);

    const second = await app.inject({
      method: "GET",
      url: "/thumb?path=assets/maps/test.png&token=test-token",
      headers: {
        "if-none-match": first.headers.etag as string,
      },
    });

    expect(second.statusCode).toBe(304);
  });

  it("returns stats for generated thumbnail cache files", async () => {
    const root = await makeTempDir("fth-thumb-");
    tempDirs.push(root);
    await mkdir(join(root, "assets/maps"), { recursive: true });
    await writeTestImage(join(root, "assets/maps/test.png"));
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    await app.inject({
      method: "GET",
      url: "/thumb?path=assets/maps/test.png&token=test-token",
    });

    const response = await app.inject({
      method: "GET",
      url: "/thumb/stats",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().count).toBe(1);
    expect(response.json().totalBytes).toBeGreaterThan(0);
  });

  it("rejects unsupported thumbnail extensions", async () => {
    const root = await makeTempDir("fth-thumb-");
    tempDirs.push(root);
    await mkdir(join(root, "assets"), { recursive: true });
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/thumb?path=assets/test.txt&token=test-token",
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error).toContain("Unsupported image type");
  });

  it("rejects thumbnail requests outside the configured data root", async () => {
    const root = await makeTempDir("fth-thumb-");
    tempDirs.push(root);
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/thumb?path=../outside.png&token=test-token",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Path is outside the data directory" });
  });

  it("returns 404 when the original thumbnail source is missing", async () => {
    const root = await makeTempDir("fth-thumb-");
    tempDirs.push(root);
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/thumb?path=assets/missing.png&token=test-token",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Original file not found" });
  });

  it("creates ad-hoc thumbnails from multipart uploads", async () => {
    const root = await makeTempDir("fth-thumb-upload-");
    tempDirs.push(root);
    const filePath = join(root, "upload-source.png");
    await writeTestImage(filePath, 24, 24);
    const fileBuffer = await readFile(filePath);
    const app = await createServer(makeConfig());
    apps.push(app);
    const multipart = buildMultipartBody(fileBuffer, "upload-source.png", "image/png", {
      width: "20",
      height: "12",
      fit: "contain",
    });

    const response = await app.inject({
      method: "POST",
      url: "/thumbnail",
      headers: {
        authorization: "Bearer test-token",
        ...multipart.headers,
      },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.headers["x-dimensions"]).toBeTruthy();
    expect(response.rawPayload.length).toBeGreaterThan(0);
  });
});
