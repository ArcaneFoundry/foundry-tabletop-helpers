import { beforeEach, describe, expect, it, vi } from "vitest";

describe("template guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).foundry;
    delete (globalThis as Record<string, unknown>).loadTemplates;
    delete (globalThis as Record<string, unknown>).renderTemplate;
  });

  it("prefers the namespaced Foundry template loader over the deprecated global", async () => {
    const namespacedLoadTemplates = vi.fn().mockResolvedValue(undefined);
    const globalLoadTemplates = vi.fn().mockResolvedValue(undefined);

    (globalThis as Record<string, unknown>).foundry = {
      applications: {
        handlebars: {
          loadTemplates: namespacedLoadTemplates,
        },
      },
    };
    (globalThis as Record<string, unknown>).loadTemplates = globalLoadTemplates;

    const { loadTemplates } = await import("./guards");
    loadTemplates(["foo.hbs"]);

    expect(namespacedLoadTemplates).toHaveBeenCalledWith(["foo.hbs"]);
    expect(globalLoadTemplates).not.toHaveBeenCalled();
  });

  it("prefers the namespaced Foundry template renderer over the deprecated global", async () => {
    const namespacedRenderTemplate = vi.fn().mockResolvedValue("<section>Namespaced</section>");
    const globalRenderTemplate = vi.fn().mockResolvedValue("<section>Global</section>");

    (globalThis as Record<string, unknown>).foundry = {
      applications: {
        handlebars: {
          renderTemplate: namespacedRenderTemplate,
        },
      },
    };
    (globalThis as Record<string, unknown>).renderTemplate = globalRenderTemplate;

    const { renderTemplate } = await import("./guards");
    await expect(renderTemplate("foo.hbs", { step: "review" })).resolves.toBe("<section>Namespaced</section>");

    expect(namespacedRenderTemplate).toHaveBeenCalledWith("foo.hbs", { step: "review" });
    expect(globalRenderTemplate).not.toHaveBeenCalled();
  });
});
