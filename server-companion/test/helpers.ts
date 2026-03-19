import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { Config } from "../src/config.js";

export async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeTempDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    authToken: "test-token",
    port: 7890,
    host: "127.0.0.1",
    allowedOrigins: [],
    maxFileSize: 10 * 1024 * 1024,
    tempDir: join(tmpdir(), "fth-optimizer-tests"),
    logLevel: "error",
    ffmpegPath: undefined,
    ffprobePath: undefined,
    foundryDataPath: undefined,
    geminiApiKey: undefined,
    geminiModel: "gemini-2.0-flash-exp",
    ...overrides,
  };
}

export async function writeTestImage(targetPath: string, width = 16, height = 16): Promise<void> {
  await mkdir(join(targetPath, ".."), { recursive: true }).catch(() => {});
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 120, g: 80, b: 200, alpha: 1 },
    },
  }).png().toBuffer();
  await writeFile(targetPath, buffer);
}

export function buildMultipartBody(
  file: Buffer,
  filename: string,
  contentType: string,
  fields: Record<string, string>,
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = "----fth-test-boundary";
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="${name}"\r\n\r\n`
      + `${value}\r\n`,
    ));
  }

  chunks.push(Buffer.from(
    `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`
    + `Content-Type: ${contentType}\r\n\r\n`,
  ));
  chunks.push(file);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    payload: Buffer.concat(chunks),
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  };
}
