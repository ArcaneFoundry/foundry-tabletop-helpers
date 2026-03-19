import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("loadConfig", () => {
  it("parses configured values and creates the temp directory", async () => {
    process.env.FTH_AUTH_TOKEN = "abc123";
    process.env.FTH_PORT = "9000";
    process.env.FTH_HOST = "127.0.0.1";
    process.env.FTH_ALLOWED_ORIGINS = "https://a.example, https://b.example ";
    process.env.FTH_MAX_FILE_SIZE = "4096";
    process.env.FTH_TEMP_DIR = "/tmp/fth-config-test";
    process.env.FTH_LOG_LEVEL = "debug";
    process.env.FTH_FFMPEG_PATH = "/usr/bin/ffmpeg";
    process.env.FTH_FFPROBE_PATH = "/usr/bin/ffprobe";
    process.env.FTH_FOUNDRY_DATA_PATH = "/var/foundrydata/Data";
    process.env.FTH_GEMINI_API_KEY = "gem-key";
    process.env.FTH_GEMINI_MODEL = "gemini-custom";

    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig();

    expect(config).toEqual({
      authToken: "abc123",
      port: 9000,
      host: "127.0.0.1",
      allowedOrigins: ["https://a.example", "https://b.example"],
      maxFileSize: 4096,
      tempDir: "/tmp/fth-config-test",
      logLevel: "debug",
      ffmpegPath: "/usr/bin/ffmpeg",
      ffprobePath: "/usr/bin/ffprobe",
      foundryDataPath: "/var/foundrydata/Data",
      geminiApiKey: "gem-key",
      geminiModel: "gemini-custom",
    });
    expect(existsSync("/tmp/fth-config-test")).toBe(true);
  });

  it("uses defaults for optional values", async () => {
    process.env.FTH_AUTH_TOKEN = "abc123";
    delete process.env.FTH_PORT;
    delete process.env.FTH_HOST;
    delete process.env.FTH_ALLOWED_ORIGINS;
    delete process.env.FTH_MAX_FILE_SIZE;
    delete process.env.FTH_TEMP_DIR;
    delete process.env.FTH_LOG_LEVEL;
    delete process.env.FTH_FFMPEG_PATH;
    delete process.env.FTH_FFPROBE_PATH;
    delete process.env.FTH_FOUNDRY_DATA_PATH;
    delete process.env.FTH_GEMINI_API_KEY;
    delete process.env.FTH_GEMINI_MODEL;

    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig();

    expect(config.port).toBe(7890);
    expect(config.host).toBe("0.0.0.0");
    expect(config.allowedOrigins).toEqual([]);
    expect(config.maxFileSize).toBe(104857600);
    expect(config.tempDir).toBe("/tmp/fth-optimizer");
    expect(config.logLevel).toBe("info");
    expect(config.ffmpegPath).toBeUndefined();
    expect(config.ffprobePath).toBeUndefined();
    expect(config.foundryDataPath).toBeUndefined();
    expect(config.geminiApiKey).toBeUndefined();
    expect(config.geminiModel).toBe("gemini-2.0-flash-exp");
  });

  it("exits when the auth token is missing or defaulted", async () => {
    delete process.env.FTH_AUTH_TOKEN;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as never);

    const { loadConfig } = await import("../src/config.js");

    expect(() => loadConfig()).toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
