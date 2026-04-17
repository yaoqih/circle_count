import { act } from "react";
import ReactDOM from "react-dom/client";

import { ImageCanvas } from "./ImageCanvas";

class ResizeObserverStub {
  private static readonly instances = new Set<ResizeObserverStub>();

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.add(this);
  }

  observe() {}

  disconnect() {
    ResizeObserverStub.instances.delete(this);
  }

  static flush() {
    for (const instance of ResizeObserverStub.instances) {
      instance.callback([], instance as unknown as ResizeObserver);
    }
  }

  static reset() {
    ResizeObserverStub.instances.clear();
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

const readPixels = (value: string | null | undefined): number => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCanvasMetrics = (
  container: HTMLElement,
  stage: HTMLElement,
  imageSize: { width: number; height: number },
) => {
  const scrollSpace = container.querySelector(".canvas-scroll-space");
  const imageShell = container.querySelector(".canvas-image-shell");
  const image = container.querySelector(".canvas-image");

  if (
    !(scrollSpace instanceof HTMLElement) ||
    !(imageShell instanceof HTMLElement) ||
    !(image instanceof HTMLElement)
  ) {
    throw new Error("Canvas metrics unavailable");
  }

  const contentWidth = readPixels(image.style.width);
  const contentHeight = readPixels(image.style.height);

  return {
    origin: {
      x: readPixels(imageShell.style.left),
      y: readPixels(imageShell.style.top),
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
  let mockClientWidth = 800;
  let mockClientHeight = 600;

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
        this.scrollLeft = input.left ?? this.scrollLeft;
        this.scrollTop = input.top ?? this.scrollTop;
      }
    }) as HTMLElement["scrollTo"];
    Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return mockClientWidth;
      },
    });
    Object.defineProperty(window.HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return mockClientHeight;
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    ResizeObserverStub.reset();
    mockClientWidth = 800;
    mockClientHeight = 600;
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

  it("keeps square images from dropping downward when zooming out near the lower half", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 2048, height: 2048 };
    const viewportPoint = { x: 400, y: 420 };

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
          deltaY: 100,
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

  it("keeps square images pinned near the top padding after zooming in and then shrinking below fit", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 2048, height: 2048 };
    const viewportPoint = { x: 400, y: 500 };

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

    const dispatchWheel = async (deltaY: number) => {
      await act(async () => {
        stage!.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: viewportPoint.x,
            clientY: viewportPoint.y,
            deltaY,
          }),
        );
      });
    };

    await dispatchWheel(-100);
    await dispatchWheel(-100);
    await dispatchWheel(100);
    await dispatchWheel(100);

    const fittedTop = (() => {
      const metrics = getCanvasMetrics(container, stage as HTMLElement, imageSize);
      return metrics.origin.y - metrics.scroll.top;
    })();
    expect(fittedTop).toBeLessThanOrEqual(28);

    await dispatchWheel(100);
    const furtherZoomOutTop = (() => {
      const metrics = getCanvasMetrics(container, stage as HTMLElement, imageSize);
      return metrics.origin.y - metrics.scroll.top;
    })();
    expect(furtherZoomOutTop).toBeLessThanOrEqual(28);

    await dispatchWheel(100);
    const smallestTop = (() => {
      const metrics = getCanvasMetrics(container, stage as HTMLElement, imageSize);
      return metrics.origin.y - metrics.scroll.top;
    })();
    expect(smallestTop).toBeLessThanOrEqual(28);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps square images pinned near the top padding when shrinking with toolbar buttons", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 2048, height: 2048 };

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
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    expect(stage).not.toBeNull();

    const minusButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "-",
    );
    expect(minusButton).not.toBeUndefined();

    await act(async () => {
      minusButton?.click();
    });

    const topAfterFirstShrink = (() => {
      const metrics = getCanvasMetrics(container, stage as HTMLElement, imageSize);
      return metrics.origin.y - metrics.scroll.top;
    })();
    expect(topAfterFirstShrink).toBeLessThanOrEqual(28);

    await act(async () => {
      minusButton?.click();
    });

    const topAfterSecondShrink = (() => {
      const metrics = getCanvasMetrics(container, stage as HTMLElement, imageSize);
      return metrics.origin.y - metrics.scroll.top;
    })();
    expect(topAfterSecondShrink).toBeLessThanOrEqual(28);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not zoom out below the fitted base size", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
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

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "376%",
    );

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: 400,
          clientY: 300,
          deltaY: 100,
        }),
      );
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "376%",
    );

    const minusButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "-",
    );
    expect(minusButton).not.toBeUndefined();
    expect(minusButton?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps landscape images from drifting downward when zooming out", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 2400, height: 1200 };
    const viewportPoint = { x: 400, y: 300 };

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={null}
          imageName="landscape.jpg"
          imageSize={imageSize}
          imageUrl="circle-label-image://asset?path=/tmp/landscape.jpg"
          isPlacingBox={false}
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
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

    const topBefore = (() => {
      const metrics = getCanvasMetrics(container, stage as HTMLElement, imageSize);
      return metrics.origin.y - metrics.scroll.top;
    })();

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: viewportPoint.x,
          clientY: viewportPoint.y,
          deltaY: 100,
        }),
      );
    });

    const topAfter = (() => {
      const metrics = getCanvasMetrics(container, stage as HTMLElement, imageSize);
      return metrics.origin.y - metrics.scroll.top;
    })();
    expect(Math.abs(topAfter - topBefore)).toBeLessThanOrEqual(4);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("pans the zoomed image by dragging directly without holding space", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 200, height: 100 };

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
          onPlaceDraftBox={() => {}}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    expect(stage).not.toBeNull();

    const plusButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "+",
    );
    expect(plusButton).not.toBeUndefined();

    await act(async () => {
      plusButton?.click();
    });

    const beforeMetrics = getCanvasMetrics(
      container,
      stage as HTMLElement,
      imageSize,
    );

    await act(async () => {
      stage!.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          clientX: 400,
          clientY: 300,
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 350,
          clientY: 250,
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          clientX: 350,
          clientY: 250,
        }),
      );
    });

    const afterMetrics = getCanvasMetrics(
      container,
      stage as HTMLElement,
      imageSize,
    );

    expect(afterMetrics.origin.x).toBeLessThan(beforeMetrics.origin.x);
    expect(afterMetrics.origin.y).toBeLessThan(beforeMetrics.origin.y);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the visible image position stable when the viewport height changes during placement", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    const imageSize = { width: 2048, height: 2048 };

    const onPlaceDraftBox = vi.fn();

    await act(async () => {
      root.render(
        <ImageCanvas
          boxes={[]}
          draftBox={{
            id: "draft-1",
            classId: 0,
            x: 924,
            y: 924,
            width: 200,
            height: 200,
          }}
          imageName="square.jpg"
          imageSize={imageSize}
          imageUrl="circle-label-image://asset?path=/tmp/square.jpg"
          isPlacingBox
          selectedBoxId={null}
          onHoverImage={() => {}}
          onImageError={() => {}}
          onImageLoad={() => {}}
          onMoveBox={() => {}}
          onPlaceDraftBox={onPlaceDraftBox}
          onSelectBox={() => {}}
        />,
      );
    });

    const stage = container.querySelector(".canvas-stage");
    const overlay = container.querySelector(".canvas-overlay");
    expect(stage).not.toBeNull();
    expect(overlay).not.toBeNull();

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
    vi.spyOn(overlay!, "getBoundingClientRect").mockReturnValue({
      x: 24,
      y: 24,
      left: 24,
      top: 24,
      right: 576,
      bottom: 576,
      width: 552,
      height: 552,
      toJSON: () => ({}),
    });

    const plusButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "+",
    );
    expect(plusButton).not.toBeUndefined();

    await act(async () => {
      plusButton?.click();
    });

    const beforeMetrics = getCanvasMetrics(
      container,
      stage as HTMLElement,
      imageSize,
    );
    const visibleTopBefore = beforeMetrics.origin.y - beforeMetrics.scroll.top;

    mockClientHeight = 520;
    await act(async () => {
      ResizeObserverStub.flush();
    });

    await act(async () => {
      overlay!.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: 300,
          clientY: 300,
        }),
      );
    });

    expect(onPlaceDraftBox).toHaveBeenCalledOnce();

    const afterMetrics = getCanvasMetrics(
      container,
      stage as HTMLElement,
      imageSize,
    );
    const visibleTopAfter = afterMetrics.origin.y - afterMetrics.scroll.top;

    expect(Math.abs(visibleTopAfter - visibleTopBefore)).toBeLessThanOrEqual(1);

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
