import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMultipartBody, makeConfig } from "./helpers.js";

const optimizeImageMock = vi.fn();
const optimizeAudioMock = vi.fn();
const detectAudioBitrateMock = vi.fn();
const optimizeVideoMock = vi.fn();

vi.mock("../src/processors/image-processor.js", () => ({
  optimizeImage: optimizeImageMock,
}));

vi.mock("../src/processors/audio-processor.js", () => ({
  optimizeAudio: optimizeAudioMock,
  detectAudioBitrate: detectAudioBitrateMock,
}));

vi.mock("../src/processors/video-processor.js", () => ({
  optimizeVideo: optimizeVideoMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  vi.resetModules();
});

describe("optimization routes", () => {
  it("rejects non-multipart optimize/image requests before route handling", async () => {
    const { createServer } = await import("../src/server.js");
    const app = await createServer(makeConfig());

    const response = await app.inject({
      method: "POST",
      url: "/optimize/image",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(406);
    await app.close();
  });

  it("passes merged image preset options to optimizeImage and returns headers", async () => {
    optimizeImageMock.mockResolvedValue({
      buffer: Buffer.from("image-output"),
      originalSize: 1000,
      optimizedSize: 400,
      format: "avif",
      width: 320,
      height: 240,
      skipped: false,
    });

    const { createServer } = await import("../src/server.js");
    const app = await createServer(makeConfig());

    const multipart = buildMultipartBody(
      Buffer.from("fake-image"),
      "portrait.png",
      "image/png",
      {
        preset: "portrait",
        maxWidth: "320",
        maxHeight: "240",
        quality: "70",
        format: "avif",
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/optimize/image",
      headers: {
        authorization: "Bearer test-token",
        ...multipart.headers,
      },
      payload: multipart.payload,
    });

    expect(optimizeImageMock).toHaveBeenCalledWith(expect.any(Buffer), {
      maxWidth: 320,
      maxHeight: 240,
      quality: 70,
      format: "avif",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/avif");
    expect(response.headers["x-original-size"]).toBe("1000");
    expect(response.headers["x-optimized-size"]).toBe("400");
    expect(response.headers["x-dimensions"]).toBe("320x240");
    expect(response.headers["x-skipped"]).toBe("false");
    await app.close();
  });

  it("uses explicit audio bitrate when provided", async () => {
    optimizeAudioMock.mockResolvedValue({
      buffer: Buffer.from("audio-output"),
      originalSize: 1000,
      optimizedSize: 500,
      format: "ogg",
      skipped: false,
    });

    const { createServer } = await import("../src/server.js");
    const app = await createServer(makeConfig({ tempDir: "/tmp/audio-tests" }));

    const multipart = buildMultipartBody(
      Buffer.from("fake-audio"),
      "battle-theme.mp3",
      "audio/mpeg",
      { bitrate: "192" },
    );

    const response = await app.inject({
      method: "POST",
      url: "/optimize/audio",
      headers: {
        authorization: "Bearer test-token",
        ...multipart.headers,
      },
      payload: multipart.payload,
    });

    expect(detectAudioBitrateMock).not.toHaveBeenCalled();
    expect(optimizeAudioMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      192,
      "/tmp/audio-tests",
      { ffmpegPath: undefined, ffprobePath: undefined },
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("audio/ogg");
    await app.close();
  });

  it("falls back to detectAudioBitrate when bitrate is omitted", async () => {
    detectAudioBitrateMock.mockReturnValue(160);
    optimizeAudioMock.mockResolvedValue({
      buffer: Buffer.from("audio-output"),
      originalSize: 1000,
      optimizedSize: 500,
      format: "ogg",
      skipped: false,
    });

    const { createServer } = await import("../src/server.js");
    const app = await createServer(makeConfig({ tempDir: "/tmp/audio-tests" }));

    const multipart = buildMultipartBody(
      Buffer.from("fake-audio"),
      "battle-theme.mp3",
      "audio/mpeg",
      {},
    );

    const response = await app.inject({
      method: "POST",
      url: "/optimize/audio",
      headers: {
        authorization: "Bearer test-token",
        ...multipart.headers,
      },
      payload: multipart.payload,
    });

    expect(detectAudioBitrateMock).toHaveBeenCalledWith("battle-theme.mp3");
    expect(optimizeAudioMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      160,
      "/tmp/audio-tests",
      { ffmpegPath: undefined, ffprobePath: undefined },
    );
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("passes parsed video options through and returns the correct content type", async () => {
    optimizeVideoMock.mockResolvedValue({
      buffer: Buffer.from("video-output"),
      originalSize: 2000,
      optimizedSize: 900,
      format: "mp4",
      skipped: false,
    });

    const { createServer } = await import("../src/server.js");
    const app = await createServer(makeConfig({ tempDir: "/tmp/video-tests" }));

    const multipart = buildMultipartBody(
      Buffer.from("fake-video"),
      "scene.mov",
      "video/quicktime",
      {
        crf: "24",
        format: "mp4",
        audioBitrate: "96",
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/optimize/video",
      headers: {
        authorization: "Bearer test-token",
        ...multipart.headers,
      },
      payload: multipart.payload,
    });

    expect(optimizeVideoMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      24,
      "/tmp/video-tests",
      {
        ffmpegPath: undefined,
        ffprobePath: undefined,
        audioBitrate: 96,
        format: "mp4",
      },
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("video/mp4");
    expect(response.headers["x-original-size"]).toBe("2000");
    expect(response.headers["x-optimized-size"]).toBe("900");
    await app.close();
  });
});
