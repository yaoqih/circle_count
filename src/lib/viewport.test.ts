import {
  clampZoom,
  fitImageIntoViewport,
  getScrollForZoomAtPoint,
} from "./viewport";

describe("viewport helpers", () => {
  it("fits the image into the available viewport while preserving aspect ratio", () => {
    expect(
      fitImageIntoViewport(
        { width: 4000, height: 2000 },
        { width: 1000, height: 700 },
      ),
    ).toEqual({
      width: 1000,
      height: 500,
    });
  });

  it("clamps zoom into the supported range", () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(20)).toBe(8);
  });

  it("keeps the pointer anchored when zooming", () => {
    expect(
      getScrollForZoomAtPoint({
        viewportPoint: { x: 250, y: 100 },
        contentOffset: { x: 40, y: 10 },
        previousZoom: 1,
        nextZoom: 2,
      }),
    ).toEqual({
      left: 330,
      top: 120,
    });
  });
});
