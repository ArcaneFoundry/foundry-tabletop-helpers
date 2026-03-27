import { MOD } from "../logger";
import { SOUNDSCAPE_SETTINGS } from "./soundscape-settings-shared";

export function registerSoundscapeSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
}): void {
  settings.register(MOD, SOUNDSCAPE_SETTINGS.LIBRARY, {
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });

  settings.register(MOD, SOUNDSCAPE_SETTINGS.WORLD_DEFAULT_PROFILE_ID, {
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });
}
