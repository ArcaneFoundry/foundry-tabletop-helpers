import { beforeEach, describe, expect, it, vi } from "vitest";

const renderTemplateMock = vi.fn();

vi.mock("../../types", () => ({
  renderTemplate: renderTemplateMock,
}));

class FakeClassList {
  private readonly classes = new Set<string>();

  toggle(name: string, force?: boolean): void {
    if (force === undefined) {
      if (this.classes.has(name)) this.classes.delete(name);
      else this.classes.add(name);
      return;
    }
    if (force) this.classes.add(name);
    else this.classes.delete(name);
  }

  contains(name: string): boolean {
    return this.classes.has(name);
  }

  remove(name: string): void {
    this.classes.delete(name);
  }
}

class FakeElement {
  dataset: Record<string, string> = {};
  classList = new FakeClassList();
  textContent = "";
  src = "";
  alt = "";
  private readonly selectorMap = new Map<string, unknown>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();
  replacedChildren: unknown[] = [];

  setQueryResult(selector: string, value: unknown): void {
    this.selectorMap.set(selector, value);
  }

  querySelector<T>(selector: string): T | null {
    return (this.selectorMap.get(selector) as T | undefined) ?? null;
  }

  querySelectorAll<T>(selector: string): T[] {
    return (this.selectorAllMap.get(selector) as T[] | undefined) ?? [];
  }

  setQuerySelectorAll(selector: string, value: FakeElement[]): void {
    this.selectorAllMap.set(selector, value);
  }

  closest(): FakeElement {
    return this;
  }

  setAttribute(name: string, value: string): void {
    this.dataset[`attr:${name}`] = value;
  }

  replaceChildren(...nodes: unknown[]): void {
    this.replacedChildren = nodes;
  }
}

describe("card select utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (globalThis as Record<string, unknown>).document = {
      createElement: (tagName: string) => {
        if (tagName !== "template") throw new Error(`Unexpected tag ${tagName}`);
        const template = {
          innerHTML: "",
          content: {
            cloneNode: vi.fn(() => {
              return { html: template.innerHTML };
            }),
          },
        };
        return template;
      },
    };
  });

  it("patches selected-card state and the shell preview", async () => {
    const { patchCardSelection } = await import("./card-select-utils");

    const root = new FakeElement();
    const cardA = new FakeElement();
    cardA.dataset.cardUuid = "uuid-a";
    const cardB = new FakeElement();
    cardB.dataset.cardUuid = "uuid-b";
    root.setQuerySelectorAll("[data-card-uuid]", [cardA, cardB]);

    const preview = new FakeElement();
    const previewImg = new FakeElement();
    const previewName = new FakeElement();
    const previewSource = new FakeElement();
    preview.setQueryResult("[data-preview-img]", previewImg);
    preview.setQueryResult("[data-preview-name]", previewName);
    preview.setQueryResult("[data-preview-source]", previewSource);
    root.setQueryResult("[data-selection-preview]", preview);

    patchCardSelection(root as unknown as HTMLElement, "uuid-b", {
      uuid: "uuid-b",
      name: "Wizard",
      img: "wizard.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "wizard",
    });

    expect(cardA.classList.contains("cc-select-card--selected")).toBe(false);
    expect(cardB.classList.contains("cc-select-card--selected")).toBe(true);
    expect(previewImg.src).toBe("wizard.png");
    expect(previewImg.alt).toBe("Wizard");
    expect(previewName.textContent).toBe("Wizard");
    expect(previewSource.textContent).toBe("PHB");
  });

  it("patches detail panes only for the latest in-flight selection request", async () => {
    const { beginCardSelectionUpdate, isCurrentCardSelectionUpdate, patchCardDetailFromTemplate } = await import("./card-select-utils");

    const root = new FakeElement();
    const currentCard = new FakeElement();
    currentCard.dataset.cardUuid = "uuid-a";
    root.setQuerySelectorAll("[data-card-uuid]", [currentCard]);
    const pane = new FakeElement();
    root.setQueryResult(".cc-card-detail-pane", pane);

    renderTemplateMock.mockResolvedValue("<div class=\"patched\">Detail</div>");

    const requestId = beginCardSelectionUpdate(root as unknown as HTMLElement, "uuid-a", {
      uuid: "uuid-a",
      name: "Fighter",
      img: "fighter.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "fighter",
    });

    expect(isCurrentCardSelectionUpdate(root as unknown as HTMLElement, requestId)).toBe(true);

    const applied = await patchCardDetailFromTemplate(root as unknown as HTMLElement, {
      requestId,
      templatePath: "detail.hbs",
      data: { selectedEntry: { name: "Fighter" } },
    });

    expect(applied).toBe(true);
    expect(renderTemplateMock).toHaveBeenCalledWith("detail.hbs", { selectedEntry: { name: "Fighter" } });
    expect(pane.replacedChildren).toHaveLength(1);

    root.dataset.cardSelectionRequestId = "newer-request";
    const staleApplied = await patchCardDetailFromTemplate(root as unknown as HTMLElement, {
      requestId,
      templatePath: "detail.hbs",
      data: { selectedEntry: { name: "Old Fighter" } },
    });

    expect(staleApplied).toBe(false);
  });
});
