import { getCircleLabelApi } from "./bridge";

describe("getCircleLabelApi", () => {
  it("returns the injected electron bridge when present", () => {
    const api = {
      openImageFolder: vi.fn(),
      readAnnotation: vi.fn(),
      writeAnnotation: vi.fn(),
    };

    window.circleLabel = api;

    expect(getCircleLabelApi()).toBe(api);
  });

  it("throws a clear error when preload did not inject the bridge", () => {
    delete window.circleLabel;

    expect(() => getCircleLabelApi()).toThrow(
      "Electron bridge is unavailable. Start the app through Electron and ensure the preload script loads correctly.",
    );
  });
});
