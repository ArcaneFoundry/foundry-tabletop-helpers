export interface WindowSizeConstraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface ApplicationPositionLike {
  width?: number;
  height?: number;
  top?: number;
  left?: number;
  scale?: number;
  zIndex?: number;
  [key: string]: unknown;
}

export interface ApplicationV2PositionLike {
  position?: Partial<ApplicationPositionLike> | null;
  setPosition?(position?: Partial<ApplicationPositionLike>): void | ApplicationPositionLike;
  _updatePosition?(position: ApplicationPositionLike): ApplicationPositionLike;
}

const CONSTRAINTS_SYMBOL: unique symbol = Symbol("fth.windowSizeConstraints");
const ORIGINAL_UPDATE_POSITION_SYMBOL: unique symbol = Symbol("fth.originalUpdatePosition");
const WRAPPED_UPDATE_POSITION_SYMBOL: unique symbol = Symbol("fth.hasWrappedUpdatePosition");

interface WrappedApplicationV2PositionLike extends ApplicationV2PositionLike {
  [CONSTRAINTS_SYMBOL]?: WindowSizeConstraints;
  [ORIGINAL_UPDATE_POSITION_SYMBOL]?: (position: ApplicationPositionLike) => ApplicationPositionLike;
  [WRAPPED_UPDATE_POSITION_SYMBOL]?: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasSizeConstraints(constraints: WindowSizeConstraints): boolean {
  return [constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight].some(isFiniteNumber);
}

function clampDimension(value: number, min?: number, max?: number): number {
  let next = value;
  if (isFiniteNumber(min)) next = Math.max(next, min);
  if (isFiniteNumber(max)) next = Math.min(next, max);
  return next;
}

export function clampApplicationPosition<T extends Partial<ApplicationPositionLike>>(
  position: T,
  constraints: WindowSizeConstraints,
): T {
  if (!hasSizeConstraints(constraints)) return { ...position };

  const next = { ...position };

  if (isFiniteNumber(next.width)) {
    next.width = clampDimension(next.width, constraints.minWidth, constraints.maxWidth);
  }

  if (isFiniteNumber(next.height)) {
    next.height = clampDimension(next.height, constraints.minHeight, constraints.maxHeight);
  }

  return next;
}

function hasClampedSizeChange(
  current: Partial<ApplicationPositionLike>,
  next: Partial<ApplicationPositionLike>,
): boolean {
  return current.width !== next.width || current.height !== next.height;
}

function normalizeCurrentPosition(app: ApplicationV2PositionLike, constraints: WindowSizeConstraints): void {
  const currentPosition = app.position;
  if (!currentPosition) return;

  const normalizedPosition = clampApplicationPosition(currentPosition, constraints);
  if (!hasClampedSizeChange(currentPosition, normalizedPosition)) return;

  if (typeof app.setPosition === "function") {
    app.setPosition(normalizedPosition);
    return;
  }

  app.position = normalizedPosition;
}

export function ensureWindowSizeConstraints(
  app: ApplicationV2PositionLike,
  constraints: WindowSizeConstraints,
): void {
  if (!hasSizeConstraints(constraints)) return;

  const wrappedApp = app as WrappedApplicationV2PositionLike;
  wrappedApp[CONSTRAINTS_SYMBOL] = { ...constraints };

  if (!wrappedApp[WRAPPED_UPDATE_POSITION_SYMBOL]) {
    wrappedApp[ORIGINAL_UPDATE_POSITION_SYMBOL] =
      typeof wrappedApp._updatePosition === "function"
        ? wrappedApp._updatePosition.bind(app)
        : undefined;

    wrappedApp._updatePosition = ((position: ApplicationPositionLike): ApplicationPositionLike => {
      const resolvedPosition = wrappedApp[ORIGINAL_UPDATE_POSITION_SYMBOL]?.(position) ?? position;
      return clampApplicationPosition(resolvedPosition, wrappedApp[CONSTRAINTS_SYMBOL] ?? {});
    }) as (position: ApplicationPositionLike) => ApplicationPositionLike;

    wrappedApp[WRAPPED_UPDATE_POSITION_SYMBOL] = true;
  }

  normalizeCurrentPosition(app, wrappedApp[CONSTRAINTS_SYMBOL]);
}
