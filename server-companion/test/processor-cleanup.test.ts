import { beforeEach, describe, expect, it, vi } from "vitest";

const unlinkMock = vi.fn();
const writeFileMock = vi.fn();
const readFileMock = vi.fn();
const setFfmpegPathMock = vi.fn();
const setFfprobePathMock = vi.fn();
const randomUUIDMock = vi.fn(() => "test-id");

type FfmpegMode = "end" | "error";

const ffmpegState = {
  mode: "end" as FfmpegMode,
  error: new Error("ffmpeg failed"),
  lastInput: "",
  lastOutput: "",
  lastVideoCodec: "",
  lastAudioCodec: "",
  lastAudioBitrate: 0,
  lastOutputOptions: [] as string[],
  noVideoCalled: false,
};

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}));

vi.mock("node:fs/promises", () => ({
  writeFile: writeFileMock,
  readFile: readFileMock,
  unlink: unlinkMock,
}));

vi.mock("fluent-ffmpeg", () => {
  const ffmpeg = (inputPath: string) => {
    ffmpegState.lastInput = inputPath;
    const handlers: Record<string, (() => void) | ((err: Error) => void)> = {};

    const chain = {
      noVideo() {
        ffmpegState.noVideoCalled = true;
        return chain;
      },
      audioCodec(codec: string) {
        ffmpegState.lastAudioCodec = codec;
        return chain;
      },
      audioBitrate(rate: number) {
        ffmpegState.lastAudioBitrate = rate;
        return chain;
      },
      videoCodec(codec: string) {
        ffmpegState.lastVideoCodec = codec;
        return chain;
      },
      addOutputOptions(options: string[]) {
        ffmpegState.lastOutputOptions = options;
        return chain;
      },
      output(outputPath: string) {
        ffmpegState.lastOutput = outputPath;
        return chain;
      },
      on(event: string, handler: (() => void) | ((err: Error) => void)) {
        handlers[event] = handler;
        return chain;
      },
      run() {
        if (ffmpegState.mode === "error") {
          (handlers.error as ((err: Error) => void) | undefined)?.(ffmpegState.error);
        } else {
          (handlers.end as (() => void) | undefined)?.();
        }
      },
    };

    return chain;
  };

  return {
    default: Object.assign(ffmpeg, {
      setFfmpegPath: setFfmpegPathMock,
      setFfprobePath: setFfprobePathMock,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  ffmpegState.mode = "end";
  ffmpegState.error = new Error("ffmpeg failed");
  ffmpegState.lastInput = "";
  ffmpegState.lastOutput = "";
  ffmpegState.lastVideoCodec = "";
  ffmpegState.lastAudioCodec = "";
  ffmpegState.lastAudioBitrate = 0;
  ffmpegState.lastOutputOptions = [];
  ffmpegState.noVideoCalled = false;
});

describe("media processor cleanup", () => {
  it("cleans up temp files after successful audio optimization", async () => {
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from("optimized-audio"));
    unlinkMock.mockResolvedValue(undefined);

    const { optimizeAudio } = await import("../src/processors/audio-processor.js");
    const result = await optimizeAudio(Buffer.from("original-audio-content"), 160, "/tmp/fth-audio", {
      ffmpegPath: "/usr/bin/ffmpeg",
      ffprobePath: "/usr/bin/ffprobe",
    });

    expect(setFfmpegPathMock).toHaveBeenCalledWith("/usr/bin/ffmpeg");
    expect(setFfprobePathMock).toHaveBeenCalledWith("/usr/bin/ffprobe");
    expect(ffmpegState.lastInput).toBe("/tmp/fth-audio/test-id-input");
    expect(ffmpegState.lastOutput).toBe("/tmp/fth-audio/test-id-output.ogg");
    expect(ffmpegState.noVideoCalled).toBe(true);
    expect(ffmpegState.lastAudioCodec).toBe("libvorbis");
    expect(ffmpegState.lastAudioBitrate).toBe(160);
    expect(result.format).toBe("ogg");
    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-audio/test-id-input");
    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-audio/test-id-output.ogg");
  });

  it("cleans up temp files when audio optimization fails", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    ffmpegState.mode = "error";
    ffmpegState.error = new Error("boom");

    const { optimizeAudio } = await import("../src/processors/audio-processor.js");

    await expect(
      optimizeAudio(Buffer.from("original-audio-content"), 128, "/tmp/fth-audio"),
    ).rejects.toThrow("boom");

    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-audio/test-id-input");
    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-audio/test-id-output.ogg");
  });

  it("returns the original video when optimization output is larger and still cleans up", async () => {
    const original = Buffer.from("small-video");
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from("much-larger-video-output"));
    unlinkMock.mockResolvedValue(undefined);

    const { optimizeVideo } = await import("../src/processors/video-processor.js");
    const result = await optimizeVideo(original, 24, "/tmp/fth-video", {
      audioBitrate: 96,
      format: "mp4",
    });

    expect(ffmpegState.lastInput).toBe("/tmp/fth-video/test-id-input");
    expect(ffmpegState.lastOutput).toBe("/tmp/fth-video/test-id-output.mp4");
    expect(ffmpegState.lastVideoCodec).toBe("libx264");
    expect(ffmpegState.lastAudioCodec).toBe("aac");
    expect(ffmpegState.lastAudioBitrate).toBe(96);
    expect(ffmpegState.lastOutputOptions).toEqual(["-crf", "24", "-preset", "medium"]);
    expect(result.skipped).toBe(true);
    expect(result.buffer).toBe(original);
    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-video/test-id-input");
    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-video/test-id-output.mp4");
  });

  it("cleans up temp files when video optimization fails", async () => {
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    ffmpegState.mode = "error";
    ffmpegState.error = new Error("video-broke");

    const { optimizeVideo } = await import("../src/processors/video-processor.js");

    await expect(
      optimizeVideo(Buffer.from("original-video-content"), 30, "/tmp/fth-video"),
    ).rejects.toThrow("video-broke");

    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-video/test-id-input");
    expect(unlinkMock).toHaveBeenCalledWith("/tmp/fth-video/test-id-output.webm");
  });
});
