import type { ReactNode } from "react";

import { cn } from "../../../../ui/lib/cn";
import type {
  CreatorIndexEntry,
  EquipmentSelection,
  ReactWizardStepProps,
  WizardState,
} from "../../../character-creator-types";
import {
  deriveEquipmentState,
  formatCurrencyCp,
  type DerivedEquipmentItem,
  type DerivedEquipmentState,
  type EquipmentFlowResolution,
} from "../../../steps/equipment-flow-utils";

type EquipmentShopStepViewModel = {
  resolution?: EquipmentFlowResolution;
  selection?: EquipmentSelection;
  derived?: DerivedEquipmentState;
};

const EQUIPMENT_LEDGER_STEP_ID = "equipment";

export function mergeEquipmentShopSelection(
  current: EquipmentSelection | undefined,
  patch: Partial<EquipmentSelection>,
): EquipmentSelection {
  return {
    ...(current ?? {}),
    ...patch,
  };
}

export function updateEquipmentLedgerStepData(
  controller: ReactWizardStepProps["controller"],
  value: EquipmentSelection,
  options?: { silent?: boolean },
): void {
  controller.updateStepData(EQUIPMENT_LEDGER_STEP_ID, value, options);
}

export function updateEquipmentTransactionSelection(
  current: EquipmentSelection | undefined,
  kind: "purchase" | "sale",
  uuid: string,
  nextQuantity: number,
): EquipmentSelection {
  const selection = normalizeEquipmentShopSelection(current);
  const currentMap = kind === "purchase"
    ? { ...(selection.purchases ?? {}) }
    : { ...(selection.sales ?? {}) };

  if (nextQuantity > 0) currentMap[uuid] = nextQuantity;
  else delete currentMap[uuid];

  return mergeEquipmentShopSelection(selection, kind === "purchase"
    ? { purchases: currentMap }
    : { sales: currentMap });
}

export function EquipmentShopStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as EquipmentShopStepViewModel | undefined;
  if (!viewModel?.resolution) return null;

  const selection = normalizeEquipmentShopSelection(state.selections.equipment ?? viewModel.selection);
  const liveState = withEquipmentSelection(state, selection);
  const liveDerived = deriveEquipmentState(liveState, viewModel.resolution);
  const preSaleDerived = deriveEquipmentState(withEquipmentSelection(state, {
    ...selection,
    sales: {},
  }), viewModel.resolution);
  const shopMode = selection.shopMode ?? "buy";
  const totalPurchased = sumSelectionQuantities(selection.purchases);
  const totalSold = sumSelectionQuantities(selection.sales);
  const shopLookup = new Map(viewModel.resolution.shopInventory.map((entry) => [entry.uuid, entry]));
  const sellableInventory = preSaleDerived.inventory
    .map((item) => {
      const shopEntry = shopLookup.get(item.uuid);
      return {
        item,
        priceCp: shopEntry?.priceCp ?? item.priceCp ?? 0,
      };
    })
    .filter((entry) => entry.priceCp > 0);

  const updateSelection = (patch: Partial<EquipmentSelection>) => {
    updateEquipmentLedgerStepData(controller, mergeEquipmentShopSelection(selection, patch));
  };

  const updateTransaction = (kind: "purchase" | "sale", uuid: string, nextQuantity: number) => {
    updateEquipmentLedgerStepData(controller, updateEquipmentTransactionSelection(selection, kind, uuid, nextQuantity));
  };

  return (
    <section className="flex flex-col px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="cc-theme-header cc-theme-header--hero rounded-[1.65rem] px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-2">
              <MicroLabel>Build / Shop</MicroLabel>
              <h2 className="cc-theme-title m-0 font-fth-cc-display text-[1.7rem] leading-[1.02] md:text-[1.95rem]">
                Spend the coin your loadout leaves behind
              </h2>
              <p className="cc-theme-copy m-0 font-fth-cc-body text-[0.98rem] leading-7">
                Use the resolved mundane shop inventory to buy essentials or sell surplus gear. All changes write back through the existing equipment selection ledger.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryBadge label="Starting funds" value={formatCurrencyCp(liveDerived.baseGoldCp)} />
              <SummaryBadge label="Remaining funds" value={formatCurrencyCp(liveDerived.remainingGoldCp)} />
              <SummaryBadge
                label="Transaction ledger"
                value={`${totalPurchased} bought / ${totalSold} sold`}
              />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(21rem,0.82fr)]">
          <div className="pr-1">
            <section className="cc-theme-panel rounded-[1.45rem] p-4 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <MicroLabel>Trade mode</MicroLabel>
                  <h3 className="cc-theme-title m-0 mt-2 font-fth-cc-display text-[1.45rem] leading-none">
                    {shopMode === "buy" ? "Provision the expedition" : "Sell down the loadout"}
                  </h3>
                  <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6">
                    Buying spends from the current purse. Selling returns item value from the inventory you currently own, including anything already marked for purchase.
                  </p>
                </div>
                <ValueBadge>{shopMode === "buy" ? "Buy mode" : "Sell mode"}</ValueBadge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ModeToggleButton
                  active={shopMode === "buy"}
                  description="Browse the resolved shop inventory and add what the march still needs."
                  icon="fa-solid fa-bag-shopping"
                  label="Buy Equipment"
                  onClick={() => updateSelection({ shopMode: "buy" })}
                />
                <ModeToggleButton
                  active={shopMode === "sell"}
                  description="Recover coin by marking owned mundane items for sale."
                  icon="fa-solid fa-coins"
                  label="Sell Equipment"
                  onClick={() => updateSelection({ shopMode: "sell" })}
                />
              </div>

              <div className="mt-5">
                {shopMode === "buy" ? (
                  <ShopInventoryPanel
                    inventory={viewModel.resolution.shopInventory}
                    purchases={selection.purchases ?? {}}
                    remainingGoldCp={liveDerived.remainingGoldCp}
                    onAdjustQuantity={(uuid, nextQuantity) => updateTransaction("purchase", uuid, nextQuantity)}
                  />
                ) : (
                  <SellInventoryPanel
                    inventory={sellableInventory}
                    sales={selection.sales ?? {}}
                    onAdjustQuantity={(uuid, nextQuantity) => updateTransaction("sale", uuid, nextQuantity)}
                  />
                )}
              </div>
            </section>
          </div>

          <aside className="cc-theme-panel cc-theme-panel--accent rounded-[1.5rem] p-4 md:p-5">
            <div className="space-y-4">
              <div>
                <MicroLabel>Trade summary</MicroLabel>
                <h3 className="cc-theme-title m-0 mt-2 font-fth-cc-display text-[1.35rem] leading-none">
                  {liveDerived.remainingGoldCp > 0 ? "Funds still in purse" : "All coin committed"}
                </h3>
                <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6">
                  The summary rail reflects the live derived equipment state after purchases and sales. Review and actor creation will consume the same ledger.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SelectionLedger
                  description={liveDerived.selectedClassOption?.description ?? "No class provision selected."}
                  label="Class provision"
                  value={liveDerived.selectedClassOption?.title ?? "Unchosen"}
                />
                <SelectionLedger
                  description={liveDerived.selectedBackgroundOption?.description ?? "No background provision selected."}
                  label="Background provision"
                  value={liveDerived.selectedBackgroundOption?.title ?? "Unchosen"}
                />
              </div>

              <div className="cc-theme-panel cc-theme-panel--soft rounded-[1.2rem] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <MicroLabel>Remaining gold</MicroLabel>
                    <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.15rem] leading-none">
                      {formatCurrencyCp(liveDerived.remainingGoldCp)}
                    </div>
                  </div>
                  <ValueBadge>{liveDerived.inventory.length} item line{liveDerived.inventory.length === 1 ? "" : "s"}</ValueBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TokenPill>{totalPurchased} bought</TokenPill>
                  <TokenPill>{totalSold} sold</TokenPill>
                  <TokenPill muted={liveDerived.baseGoldCp <= 0}>Started with {formatCurrencyCp(liveDerived.baseGoldCp)}</TokenPill>
                </div>
              </div>

              <div className="space-y-3">
                <MicroLabel>Projected inventory</MicroLabel>
                {liveDerived.inventory.length > 0 ? (
                  <div className="grid gap-2">
                    {liveDerived.inventory.map((item) => (
                      <InventorySummaryRow key={item.uuid} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyPanelCopy>
                    No inventory lines remain after the current shop ledger. Advance with coin only, or change the transaction mix above.
                  </EmptyPanelCopy>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function normalizeEquipmentShopSelection(selection: EquipmentSelection | undefined): EquipmentSelection {
  return {
    purchases: {},
    sales: {},
    shopMode: "buy",
    ...(selection ?? {}),
  };
}

function withEquipmentSelection(state: WizardState, selection: EquipmentSelection): WizardState {
  return {
    ...state,
    selections: {
      ...state.selections,
      equipment: selection,
    },
  };
}

function sumSelectionQuantities(entries: Record<string, number> | undefined): number {
  return Object.values(entries ?? {}).reduce((total, quantity) => total + quantity, 0);
}

function ShopInventoryPanel({
  inventory,
  purchases,
  remainingGoldCp,
  onAdjustQuantity,
}: {
  inventory: CreatorIndexEntry[];
  purchases: Record<string, number>;
  remainingGoldCp: number;
  onAdjustQuantity: (uuid: string, nextQuantity: number) => void;
}) {
  if (inventory.length === 0) {
    return (
      <EmptyPanelCopy>
        No supported mundane shop inventory is currently available from the enabled item packs. The step still preserves your current purse and starting loadout.
      </EmptyPanelCopy>
    );
  }

  return (
    <div className="grid gap-3">
      {inventory.map((entry) => {
        const quantity = purchases[entry.uuid] ?? 0;
        const priceCp = entry.priceCp ?? 0;
        const canIncrease = priceCp > 0 && remainingGoldCp >= priceCp;

        return (
          <TradeRow
            actionLabel="Marked to buy"
            entry={entry}
            key={entry.uuid}
            onDecrease={() => onAdjustQuantity(entry.uuid, Math.max(0, quantity - 1))}
            onIncrease={() => onAdjustQuantity(entry.uuid, quantity + 1)}
            quantity={quantity}
            quantityCanIncrease={canIncrease}
            quantityCanDecrease={quantity > 0}
            valueLabel={priceCp > 0 ? formatCurrencyCp(priceCp) : "No price"}
          >
            <TokenPill muted={quantity === 0}>{quantity} selected</TokenPill>
            {priceCp > 0 ? null : <TokenPill muted>Unavailable to buy</TokenPill>}
            {!canIncrease && priceCp > 0 ? <TokenPill muted>Insufficient funds</TokenPill> : null}
          </TradeRow>
        );
      })}
    </div>
  );
}

function SellInventoryPanel({
  inventory,
  sales,
  onAdjustQuantity,
}: {
  inventory: Array<{ item: DerivedEquipmentItem; priceCp: number }>;
  sales: Record<string, number>;
  onAdjustQuantity: (uuid: string, nextQuantity: number) => void;
}) {
  if (inventory.length === 0) {
    return (
      <EmptyPanelCopy>
        Nothing in the current loadout can be sold through the resolved shop catalog. Start by buying gear or keep the provisions you already carry.
      </EmptyPanelCopy>
    );
  }

  return (
    <div className="grid gap-3">
      {inventory.map(({ item, priceCp }) => {
        const quantity = sales[item.uuid] ?? 0;
        const maxSellable = item.quantity;

        return (
          <TradeRow
            actionLabel="Marked to sell"
            entry={{
              uuid: item.uuid,
              name: item.name,
              img: item.img ?? "",
              itemType: item.itemType,
              priceCp,
              packLabel: "Current inventory",
            }}
            key={item.uuid}
            onDecrease={() => onAdjustQuantity(item.uuid, Math.max(0, quantity - 1))}
            onIncrease={() => onAdjustQuantity(item.uuid, Math.min(maxSellable, quantity + 1))}
            quantity={quantity}
            quantityCanIncrease={quantity < maxSellable}
            quantityCanDecrease={quantity > 0}
            valueLabel={`Recovers ${formatCurrencyCp(priceCp)}`}
          >
            <TokenPill muted={quantity === 0}>{quantity} marked</TokenPill>
            <TokenPill muted>Own {item.quantity}</TokenPill>
          </TradeRow>
        );
      })}
    </div>
  );
}

function TradeRow({
  entry,
  valueLabel,
  quantity,
  quantityCanIncrease,
  quantityCanDecrease,
  actionLabel,
  onIncrease,
  onDecrease,
  children,
}: {
  entry: Pick<CreatorIndexEntry, "uuid" | "name" | "img" | "itemType" | "packLabel" | "priceCp">;
  valueLabel: string;
  quantity: number;
  quantityCanIncrease: boolean;
  quantityCanDecrease: boolean;
  actionLabel: string;
  onIncrease: () => void;
  onDecrease: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="cc-theme-card cc-theme-card--soft rounded-[1.15rem] px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="cc-theme-title font-fth-cc-display text-[1.08rem] leading-none">
              {entry.name}
            </div>
            {entry.itemType ? <TokenPill muted>{entry.itemType}</TokenPill> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <TokenPill>{valueLabel}</TokenPill>
            {entry.packLabel ? <TokenPill muted>{entry.packLabel}</TokenPill> : null}
            {children}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-[5.5rem] text-right">
            <MicroLabel>{actionLabel}</MicroLabel>
            <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.08rem] leading-none">{quantity}</div>
          </div>
          <div className="flex items-center gap-2">
            <QuantityButton disabled={!quantityCanDecrease} label={`Decrease ${entry.name}`} onClick={onDecrease}>-</QuantityButton>
            <QuantityButton disabled={!quantityCanIncrease} label={`Increase ${entry.name}`} onClick={onIncrease}>+</QuantityButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventorySummaryRow({ item }: { item: DerivedEquipmentItem }) {
  return (
    <div className="cc-theme-card cc-theme-card--soft flex items-center justify-between gap-3 rounded-[1rem] px-3 py-3">
      <div className="min-w-0">
        <div className="cc-theme-body truncate font-fth-cc-body text-[0.95rem] leading-6">
          {item.name}
        </div>
        <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]">
          {item.itemType ?? "Gear"}
        </div>
      </div>
      <TokenPill>x{item.quantity}</TokenPill>
    </div>
  );
}

function ModeToggleButton({
  active,
  icon,
  label,
  description,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-[1.2rem] px-4 py-4 text-left transition",
        "cc-theme-toggle",
        active && "cc-theme-toggle--active",
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-3">
        <div className={cn("cc-theme-icon-chip flex h-10 w-10 items-center justify-center rounded-full border", active && "cc-theme-icon-chip--active")}>
          <i className={`${icon} text-sm`} />
        </div>
        <div>
          <div className="cc-theme-title font-fth-cc-display text-[1rem] leading-none">{label}</div>
          <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.88rem] leading-6">{description}</p>
        </div>
      </div>
    </button>
  );
}

function QuantityButton({
  disabled,
  label,
  onClick,
  children,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border font-fth-cc-display text-[1.05rem] leading-none transition",
        "cc-theme-sigil",
        disabled ? "cursor-not-allowed opacity-45" : "hover:border-fth-border-strong",
        !disabled && "cc-theme-sigil--selected",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-theme-card cc-theme-card--soft min-w-[11rem] rounded-[1.1rem] px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="cc-theme-body mt-2 font-fth-cc-body text-[0.96rem] leading-6">{value}</div>
    </div>
  );
}

function SelectionLedger({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="cc-theme-card cc-theme-card--soft rounded-[1.1rem] px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.08rem] leading-none">{value}</div>
      <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.88rem] leading-6">{description}</p>
    </div>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
      <div className="cc-theme-kicker font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.22em]">
        {children}
      </div>
  );
}

function ValueBadge({ children }: { children: ReactNode }) {
  return (
    <div className="cc-theme-badge inline-flex items-center rounded-full px-3 py-1 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.18em]">
      {children}
    </div>
  );
}

function TokenPill({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 font-fth-cc-ui text-[0.63rem] uppercase tracking-[0.18em]",
        muted ? "cc-theme-pill--muted" : "cc-theme-pill",
      )}
    >
      {children}
    </span>
  );
}

function EmptyPanelCopy({ children }: { children: ReactNode }) {
  return (
    <div className="cc-theme-empty rounded-[1.05rem] border border-dashed px-4 py-4 font-fth-cc-body text-[0.92rem] leading-7">
      {children}
    </div>
  );
}
