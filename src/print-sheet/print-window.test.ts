import { beforeEach, describe, expect, it, vi } from "vitest";

const { warnMock, infoMock, getUIMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
  infoMock: vi.fn(),
  getUIMock: vi.fn(),
}));

vi.mock("../logger", () => ({
  Log: {
    warn: warnMock,
    info: infoMock,
  },
}));

vi.mock("../types", () => ({
  getUI: getUIMock,
}));

interface FakeOpenedWindow {
  document: {
    open: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  setTimeout: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  print: ReturnType<typeof vi.fn>;
}

function makeOpenedWindow(): FakeOpenedWindow {
  return {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
    setTimeout: vi.fn((callback: () => void) => {
      callback();
      return 1;
    }),
    focus: vi.fn(),
    print: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getUIMock.mockReturnValue({ notifications: { warn: vi.fn() } });
  (globalThis as Record<string, unknown>).window = {
    open: vi.fn(),
  };
});

describe("print window", () => {
  it("warns when the browser blocks opening a new window", async () => {
    const blockedOpen = vi.fn(() => null);
    (globalThis as Record<string, unknown>).window = { open: blockedOpen };

    const { openPrintWindow } = await import("./print-window");
    openPrintWindow("<div>Body</div>", ".sheet{}", "Blocked");

    expect(blockedOpen).toHaveBeenCalledWith("", "_blank");
    expect(warnMock).toHaveBeenCalledWith("window blocked by browser popup blocker");
    expect(getUIMock().notifications.warn).toHaveBeenCalledWith(
      "Window was blocked. Please allow popups for this site.",
    );
  });

  it("writes the document and triggers print after focusing the new window", async () => {
    const opened = makeOpenedWindow();
    const open = vi.fn(() => opened);
    (globalThis as Record<string, unknown>).window = { open };

    const { openPrintWindow } = await import("./print-window");
    openPrintWindow("<article>Sheet</article>", ".sheet{color:black;}", "Hero");

    expect(opened.document.open).toHaveBeenCalledTimes(1);
    expect(opened.document.write).toHaveBeenCalledWith(expect.stringContaining("<title>Foundry Tabletop Helpers - Hero</title>"));
    expect(opened.document.write).toHaveBeenCalledWith(expect.stringContaining("<article>Sheet</article>"));
    expect(opened.document.write).toHaveBeenCalledWith(expect.stringContaining(".sheet{color:black;}"));
    expect(opened.document.close).toHaveBeenCalledTimes(1);
    expect(opened.setTimeout).toHaveBeenCalledWith(expect.any(Function), 400);
    expect(opened.focus).toHaveBeenCalledTimes(1);
    expect(opened.print).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith("print window opened");
  });

  it("opens a preview window without printing and focuses it after a short delay", async () => {
    const opened = makeOpenedWindow();
    const open = vi.fn(() => opened);
    (globalThis as Record<string, unknown>).window = { open };

    const { openPreviewWindow } = await import("./print-window");
    openPreviewWindow("<article>Preview</article>", ".sheet{}", "Preview");

    expect(opened.document.write).toHaveBeenCalledWith(expect.stringContaining("<article>Preview</article>"));
    expect(opened.setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(opened.focus).toHaveBeenCalledTimes(1);
    expect(opened.print).not.toHaveBeenCalled();
    expect(infoMock).toHaveBeenCalledWith("preview window opened");
  });
});
