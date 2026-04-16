import {
  clampZoom,
  fitImageIntoViewport,
  getCenteredContentOrigin,
  getScrollForZoomAtPoint,
  getScrollSpaceSize,
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
        previousContentOrigin: { x: 24, y: 24 },
        nextContentOrigin: { x: 24, y: 24 },
        previousZoom: 1,
        nextZoom: 2,
      }),
    ).toEqual({
      left: 306,
      top: 96,
    });
  });

  it("computes the centered content origin inside the scroll space", () => {
    expect(
      getCenteredContentOrigin(
        { width: 900, height: 600 },
        { width: 500, height: 200 },
      ),
    ).toEqual({
      x: 200,
      y: 200,
    });
  });

  it("expands the scroll space once the zoomed image exceeds the viewport", () => {
    expect(
      getScrollSpaceSize(
        { width: 827, height: 414 },
        { width: 800, height: 600 },
        24,
      ),
    ).toEqual({
      width: 875,
      height: 600,
    });
  });
});
