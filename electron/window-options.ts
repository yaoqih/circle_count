import type { BrowserWindowConstructorOptions } from "electron";
import path from "node:path";

export const buildMainWindowOptions = (
  mainEntryPath: string,
): BrowserWindowConstructorOptions => ({
  width: 1440,
  height: 920,
  minWidth: 1120,
  minHeight: 760,
  title: "Circle Label",
  backgroundColor: "#f6f0e5",
  webPreferences: {
    preload: path.join(path.dirname(mainEntryPath), "../preload/preload.mjs"),
    contextIsolation: true,
    nodeIntegration: false,
    // Electron's sandboxed preload does not support ESM imports. The app uses
    // an ESM preload bundle, so sandbox must be disabled for the bridge to load.
    sandbox: false,
  },
});
