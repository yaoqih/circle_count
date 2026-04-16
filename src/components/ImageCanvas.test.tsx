import { act } from "react";
import ReactDOM from "react-dom/client";

import { ImageCanvas } from "./ImageCanvas";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

const readPixels = (value: string | null | undefined): number => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

const getScrollLimits = (element: HTMLElement) => {
  const scrollSpace = element.firstElementChild;
  if (!(scrollSpace instanceof HTMLElement)) {
    return { left: 0, top: 0 };
  }

  return {
    left: Math.max(0, readPixels(scrollSpace.style.width) - element.clientWidth),
    top: Math.max(0, readPixels(scrollSpace.style.height) - element.clientHeight),
  };
};

const getCanvasMetrics = (
  container: HTMLElement,
  stage: HTMLElement,
  imageSize: { width: number; height: number },
) => {
  const scrollSpace = container.querySelector(".canvas-scroll-space");
  const image = container.querySelector(".canvas-image");

  if (!(scrollSpace instanceof HTMLElement) || !(image instanceof HTMLElement)) {
    throw new Error("Canvas metrics unavailable");
  }

  const contentWidth = readPixels(image.style.width);
  const contentHeight = readPixels(image.style.height);
  const scrollSpaceWidth = readPixels(scrollSpace.style.width);
  const scrollSpaceHeight = readPixels(scrollSpace.style.height);

  return {
    origin: {
      x: (scrollSpaceWidth - contentWidth) / 2,
      y: (scrollSpaceHeight - contentHeight) / 2,
    },
    scroll: {
      left: stage.scrollLeft,
      top: stage.scrollTop,
    },
    scale: {
      x: contentWidth / imageSize.width,
      y: contentHeight / imageSize.height,
    },
  };
};

const getImagePointAtViewportPoint = (
  metrics: ReturnType<typeof getCanvasMetrics>,
  viewportPoint: { x: number; y: number },
) => ({
  x: (viewportPoint.x + metrics.scroll.left - metrics.origin.x) / metrics.scale.x,
  y: (viewportPoint.y + metrics.scroll.top - metrics.origin.y) / metrics.scale.y,
});

const getViewportPointForImagePoint = (
  metrics: ReturnType<typeof getCanvasMetrics>,
  imagePoint: { x: number; y: number },
) => ({
  x: metrics.origin.x + imagePoint.x * metrics.scale.x - metrics.scroll.left,
  y: metrics.origin.y + imagePoint.y * metrics.scale.y - metrics.scroll.top,
});

const clampViewportPointToImageBounds = (
  metrics: ReturnType<typeof getCanvasMetrics>,
  imageSize: { width: number; height: number },
  viewportPoint: { x: number; y: number },
) => {
  const imageLeft = metrics.origin.x - metrics.scroll.left;
  const imageTop = metrics.origin.y - metrics.scroll.top;
  const imageRight = imageLeft + imageSize.width * metrics.scale.x;
  const imageBottom = imageTop + imageSize.height * metrics.scale.y;

  return {
    x: clamp(viewportPoint.x, imageLeft, imageRight),
    y: clamp(viewportPoint.y, imageTop, imageBottom),
  };
};

const expectAnchorStable = (
  container: HTMLElement,
  stage: HTMLElement,
  imageSize: { width: number; height: number },
  imagePoint: { x: number; y: number },
  viewportPoint: { x: number; y: number },
) => {
  const nextMetrics = getCanvasMetrics(container, stage, imageSize);
  const anchoredViewportPoint = getViewportPointForImagePoint(
    nextMetrics,
    imagePoint,
  );

  expect(Math.abs(anchoredViewportPoint.x - viewportPoint.x)).toBeLessThanOrEqual(
    1,
  );
  expect(Math.abs(anchoredViewportPoint.y - viewportPoint.y)).toBeLessThanOrEqual(
    1,
  );
};

const expectHorizontalAnchorStable = (
  container: HTMLElement,
  stage: HTMLElement,
  imageSize: { width: number; height: number },
  imagePoint: { x: number; y: number },
  viewportX: number,
) => {
  const nextMetrics = getCanvasMetrics(container, stage, imageSize);
  const anchoredViewportPoint = getViewportPointForImagePoint(
    nextMetrics,
    imagePoint,
  );

  expect(Math.abs(anchoredViewportPoint.x - viewportX)).toBeLessThanOrEqual(1);
};

describe("ImageCanvas", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.HTMLElement.prototype.scrollTo = vi.fn(function scrollToMock(
      this: HTMLElement,
      input?: ScrollToOptions | number,
      _y?: number,
    ) {
      if (
        typeof input === "object" &&
        input !== null &&
        "left" in input &&
        "top" in input
      ) {
        const limits = getScrollLimits(this);
        this.scrollLeft = clamp(input.left ?? this.scrollLeft, 0, limits.left);
        this.scrollTop = clamp(input.top ?? this.scrollTop, 0, limits.top);
      }
    }) as HTMLElement["scrollTo"];
    Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 800;
      },
    });
    Object.defineProperty(window.HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 600;
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("renders the image element before natural image size is known", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="demo.jpg"
          imageSize={null}
          imageUrl="circle-label-image://asset?path=/tmp/demo.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    expect(container.querySelector("img")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("reports the natural size when the image is already complete on mount", async () => {
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);
    const naturalWidthSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(1600);
    const naturalHeightSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalHeight", "get")
      .mockReturnValue(900);

    const onImageLoad = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="cached.jpg"
          imageSize={null}
          imageUrl="circle-label-image://asset?path=/tmp/cached.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={onImageLoad}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    expect(onImageLoad).toHaveBeenCalledWith({
      width: 1600,
      height: 900,
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
    completeSpy.mockRestore();
    naturalWidthSpy.mockRestore();
    naturalHeightSpy.mockRestore();
  });

  it("eventually reports the natural size when the image becomes complete after mount", async () => {
    vi.useFakeTimers();

    let isComplete = false;
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockImplementation(() => isComplete);
    const naturalWidthSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(1600);
    const naturalHeightSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalHeight", "get")
      .mockReturnValue(900);

    const onImageLoad = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="delayed-cache.jpg"
          imageSize={null}
          imageUrl="circle-label-image://asset?path=/tmp/delayed-cache.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={onImageLoad}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    expect(onImageLoad).not.toHaveBeenCalled();

    isComplete = true;

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(onImageLoad).toHaveBeenCalledWith({
      width: 1600,
      height: 900,
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
    completeSpy.mockRestore();
    naturalWidthSpy.mockRestore();
    naturalHeightSpy.mockRestore();
    vi.useRealTimers();
  });

  it("keeps the current zoom when parent callbacks get a new identity", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const renderCanvas = (hoverCallback: (point: { x: number; y: number } | null) => void) =>
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="demo.jpg"
          imageSize={{ width: 200, height: 100 }}
          imageUrl="circle-label-image://asset?path=/tmp/demo.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={hoverCallback}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );

    await act(async () => {
      renderCanvas(() => {});
    });

    const zoomLabelBefore = container.querySelector(".canvas-toolbar-meta strong");
    expect(zoomLabelBefore?.textContent).toBe("376%");

    const plusButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "+",
    );
    expect(plusButton).not.toBeUndefined();

    await act(async () => {
      plusButton?.click();
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "451%",
    );

    await act(async () => {
      renderCanvas(() => {});
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "451%",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the pointer anchored when zoom grows past the fitted viewport width", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 200, height: 100 };
    const viewportPoint = { x: 700, y: 300 };

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="demo.jpg"
          imageSize={imageSize}
          imageUrl="circle-label-image://asset?path=/tmp/demo.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    expect(stage).not.toBeNull();

    const scrollToMock = vi.mocked(window.HTMLElement.prototype.scrollTo);
    scrollToMock.mockClear();

    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });

    const anchoredImagePoint = getImagePointAtViewportPoint(
      getCanvasMetrics(container, stage as HTMLElement, imageSize),
      viewportPoint,
    );

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: viewportPoint.x,
          clientY: viewportPoint.y,
          deltaY: -100,
        }),
      );
    });

    expect(scrollToMock).toHaveBeenCalled();
    expectAnchorStable(
      container,
      stage as HTMLElement,
      imageSize,
      anchoredImagePoint,
      viewportPoint,
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the zoom anchor stable across consecutive wheel zoom steps", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 200, height: 100 };
    const viewportPoint = { x: 680, y: 260 };

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="demo.jpg"
          imageSize={imageSize}
          imageUrl="circle-label-image://asset?path=/tmp/demo.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    expect(stage).not.toBeNull();

    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });

    const anchoredImagePoint = getImagePointAtViewportPoint(
      getCanvasMetrics(container, stage as HTMLElement, imageSize),
      viewportPoint,
    );

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: viewportPoint.x,
          clientY: viewportPoint.y,
          deltaY: -100,
        }),
      );
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "414%",
    );
    expectAnchorStable(
      container,
      stage as HTMLElement,
      imageSize,
      anchoredImagePoint,
      viewportPoint,
    );

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: viewportPoint.x,
          clientY: viewportPoint.y,
          deltaY: -100,
        }),
      );
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "455%",
    );
    expectAnchorStable(
      container,
      stage as HTMLElement,
      imageSize,
      anchoredImagePoint,
      viewportPoint,
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("clamps wheel zoom on blank stage space to the nearest image edge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 200, height: 100 };
    const viewportPoint = { x: 400, y: 40 };

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="demo.jpg"
          imageSize={imageSize}
          imageUrl="circle-label-image://asset?path=/tmp/demo.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    expect(stage).not.toBeNull();

    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });

    const metricsBefore = getCanvasMetrics(
      container,
      stage as HTMLElement,
      imageSize,
    );
    const effectiveViewportPoint = clampViewportPointToImageBounds(
      metricsBefore,
      imageSize,
      viewportPoint,
    );
    const anchoredImagePoint = getImagePointAtViewportPoint(
      metricsBefore,
      effectiveViewportPoint,
    );

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: viewportPoint.x,
          clientY: viewportPoint.y,
          deltaY: -100,
        }),
      );
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "414%",
    );
    expectAnchorStable(
      container,
      stage as HTMLElement,
      imageSize,
      anchoredImagePoint,
      effectiveViewportPoint,
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps square images visually anchored instead of dropping downward on zoom", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 2048, height: 2048 };
    const viewportPoint = { x: 400, y: 260 };

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="square.jpg"
          imageSize={imageSize}
          imageUrl="circle-label-image://asset?path=/tmp/square.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    expect(stage).not.toBeNull();

    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });

    const beforeMetrics = getCanvasMetrics(
      container,
      stage as HTMLElement,
      imageSize,
    );
    const imageTopBefore = beforeMetrics.origin.y - beforeMetrics.scroll.top;
    const anchoredImagePoint = getImagePointAtViewportPoint(
      beforeMetrics,
      viewportPoint,
    );

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: viewportPoint.x,
          clientY: viewportPoint.y,
          deltaY: -100,
        }),
      );
    });

    const afterMetrics = getCanvasMetrics(
      container,
      stage as HTMLElement,
      imageSize,
    );
    const imageTopAfter = afterMetrics.origin.y - afterMetrics.scroll.top;

    expect(Math.abs(imageTopAfter - imageTopBefore)).toBeLessThanOrEqual(4);
    expectHorizontalAnchorStable(
      container,
      stage as HTMLElement,
      imageSize,
      anchoredImagePoint,
      viewportPoint.x,
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders existing boxes and still zooms when wheeling over a box", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[
            {
              id: "box-1",
              classId: 0,
              x: 40,
              y: 20,
              width: 60,
              height: 40,
            },
          ]}
          draftBox={null}
          imageName="demo.jpg"
          imageSize={{ width: 200, height: 100 }}
          imageUrl="circle-label-image://asset?path=/tmp/demo.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPanModifierChange={() => {}}
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    const box = container.querySelector(".canvas-box");
    expect(stage).not.toBeNull();
    expect(box).not.toBeNull();
    expect(box?.tagName).toBe("DIV");

    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });

    await act(async () => {
      box!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: 260,
          clientY: 180,
          deltaY: -100,
        }),
      );
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "414%",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
