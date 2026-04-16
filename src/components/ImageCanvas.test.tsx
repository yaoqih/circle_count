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
    window.HTMLElement.prototype.scrollTo = vi.fn();
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
});
