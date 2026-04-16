import {
  clampContentPoint,
  clampScrollOffset,
  clampZoom,
  clampViewportPointToContentBounds,
  fitImageIntoViewport,
  getAnchoredScrollSpaceLength,
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

  it("expands only the axis that exceeds the viewport", () => {
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

  it("keeps the fitted scroll space flush until zoom exceeds the viewport", () => {
    expect(
      getScrollSpaceSize(
        { width: 752, height: 376 },
        { width: 800, height: 600 },
        24,
      ),
    ).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("clamps scroll offsets into the scrollable range", () => {
    expect(
      clampScrollOffset({
        scrollOffset: { left: 41, top: -3 },
        scrollSpaceSize: { width: 848, height: 648 },
        viewportSize: { width: 800, height: 600 },
      }),
    ).toEqual({
      left: 41,
      top: 0,
    });
  });

  it("expands one axis only as much as needed to keep the zoom anchor scrollable", () => {
    expect(
      getAnchoredScrollSpaceLength({
        contentLength: 414,
        viewportLength: 600,
        padding: 24,
        viewportPoint: 300,
        anchoredContentPoint: 205.3,
      }),
    ).toBe(604);
  });

  it("clamps the zoom anchor into the visible content bounds", () => {
    expect(
      clampContentPoint(
        { x: 840, y: -20 },
        { width: 752, height: 376 },
      ),
    ).toEqual({
      x: 752,
      y: 0,
    });
  });

  it("clamps a viewport point to the currently visible image bounds", () => {
    expect(
      clampViewportPointToContentBounds({
        viewportPoint: { x: 400, y: 40 },
        contentOffset: { x: 0, y: 0 },
        contentOrigin: { x: 24, y: 112 },
        contentSize: { width: 752, height: 376 },
      }),
    ).toEqual({
      x: 400,
      y: 112,
    });
  });
});
