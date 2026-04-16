import path from "node:path";

import { buildMainWindowOptions } from "./window-options";

describe("buildMainWindowOptions", () => {
  it("uses an ESM preload path with sandbox disabled", () => {
    const options = buildMainWindowOptions(
      path.resolve(process.cwd(), "out/main/index.js"),
    );

    expect(options.webPreferences?.sandbox).toBe(false);
    expect(options.webPreferences?.preload?.replaceAll("\\", "/")).toContain(
      "out/preload/preload.mjs",
    );
    expect(options.webPreferences?.contextIsolation).toBe(true);
  });
});
