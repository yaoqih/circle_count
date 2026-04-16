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
});
