import { act } from "react";
import ReactDOM from "react-dom/client";

import { ImageCanvas } from "./ImageCanvas";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

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
        this.scrollLeft = input.left ?? this.scrollLeft;
        this.scrollTop = input.top ?? this.scrollTop;
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

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: 700,
          clientY: 300,
          deltaY: -100,
        }),
      );
    });

    const lastScrollCall = scrollToMock.mock.calls.at(-1)?.[0];
    expect(typeof lastScrollCall).toBe("object");
    expect(lastScrollCall).not.toBeNull();

    const scrollOptions = lastScrollCall as ScrollToOptions;
    expect(scrollOptions).toMatchObject({
      left: 68,
    });
    expect(Math.abs(scrollOptions.top ?? Number.NaN)).toBe(0);

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
