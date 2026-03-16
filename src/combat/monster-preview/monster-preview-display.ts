export type MonsterPreviewDisplayMode =
  | "remember"
  | "inline"
  | "floating"
  | "floatingMinimized";

export interface MonsterPreviewDisplayState {
  isFloating: boolean;
  isMinimized: boolean;
}

export function getInitialMonsterPreviewDisplayState(
  mode: string | undefined,
  storage: Pick<Storage, "getItem">,
  modeKey: string,
  minimizedKey: string,
): MonsterPreviewDisplayState {
  switch (mode) {
    case "inline":
      return { isFloating: false, isMinimized: false };
    case "floating":
      return { isFloating: true, isMinimized: false };
    case "floatingMinimized":
      return { isFloating: true, isMinimized: true };
    case "remember":
    default:
      return {
        isFloating: storage.getItem(modeKey) === "floating",
        isMinimized: storage.getItem(minimizedKey) === "true",
      };
  }
}
