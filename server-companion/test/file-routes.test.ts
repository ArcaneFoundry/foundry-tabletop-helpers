import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { makeConfig, makeTempDir, removeTempDir } from "./helpers.js";

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

describe("mkdir and delete routes", () => {
  it("creates folders inside the configured data root", async () => {
    const root = await makeTempDir("fth-mkdir-");
    tempDirs.push(root);
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/mkdir",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/shared/icons/new-folder" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, path: "assets/shared/icons/new-folder" });

    const created = await stat(join(root, "assets/shared/icons/new-folder"));
    expect(created.isDirectory()).toBe(true);
  });

  it("rejects unsafe mkdir path segments", async () => {
    const root = await makeTempDir("fth-mkdir-");
    tempDirs.push(root);
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/mkdir",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/.fth-thumbs/new-folder" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Invalid path segment");
  });

  it("returns conflicts when mkdir target already exists", async () => {
    const root = await makeTempDir("fth-mkdir-");
    tempDirs.push(root);
    await mkdir(join(root, "assets/shared/icons/existing"), { recursive: true });
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/mkdir",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/shared/icons/existing" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Folder already exists" });
  });

  it("deletes files and removes matching thumbnail cache entries", async () => {
    const root = await makeTempDir("fth-delete-");
    tempDirs.push(root);
    await mkdir(join(root, "assets/shared"), { recursive: true });
    await mkdir(join(root, ".fth-thumbs/assets/shared"), { recursive: true });
    await writeFile(join(root, "assets/shared/test.txt"), "hello");
    await writeFile(join(root, ".fth-thumbs/assets/shared/test.txt.webp"), "thumb");
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/delete",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/shared/test.txt" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, path: "assets/shared/test.txt" });

    await expect(stat(join(root, "assets/shared/test.txt"))).rejects.toThrow();
    await expect(stat(join(root, ".fth-thumbs/assets/shared/test.txt.webp"))).rejects.toThrow();
  });

  it("requires recursive deletion for folders", async () => {
    const root = await makeTempDir("fth-delete-");
    tempDirs.push(root);
    await mkdir(join(root, "assets/shared/folder"), { recursive: true });
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/delete",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/shared/folder" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Path is a directory. Set recursive: true to delete." });
  });

  it("deletes folders recursively and removes matching thumbnail subtrees", async () => {
    const root = await makeTempDir("fth-delete-");
    tempDirs.push(root);
    await mkdir(join(root, "assets/shared/folder"), { recursive: true });
    await mkdir(join(root, ".fth-thumbs/assets/shared/folder"), { recursive: true });
    await writeFile(join(root, "assets/shared/folder/file.txt"), "hello");
    await writeFile(join(root, ".fth-thumbs/assets/shared/folder/file.txt.webp"), "thumb");
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/delete",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/shared/folder", recursive: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, path: "assets/shared/folder" });

    await expect(stat(join(root, "assets/shared/folder"))).rejects.toThrow();
    await expect(stat(join(root, ".fth-thumbs/assets/shared/folder"))).rejects.toThrow();
  });

  it("rejects delete attempts outside the configured data root", async () => {
    const root = await makeTempDir("fth-delete-");
    tempDirs.push(root);
    const app = await createServer(makeConfig({ foundryDataPath: root }));
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/delete",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "../outside.txt" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Path is outside the data directory" });
  });

  it("returns 501 for file operations when no data root is configured", async () => {
    const app = await createServer(makeConfig());
    apps.push(app);

    const mkdirResponse = await app.inject({
      method: "POST",
      url: "/mkdir",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/new-folder" },
    });

    const deleteResponse = await app.inject({
      method: "POST",
      url: "/delete",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      payload: { path: "assets/file.txt" },
    });

    expect(mkdirResponse.statusCode).toBe(501);
    expect(deleteResponse.statusCode).toBe(501);
  });
});
