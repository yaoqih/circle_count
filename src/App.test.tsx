import { act } from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

describe("App", () => {
  const imageDataUrl =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  const waitFor = async (assertion: () => void, attempts = 20) => {
    let lastError: unknown;

    for (let index = 0; index < attempts; index += 1) {
      try {
        assertion();
        return;
      } catch (error) {
        lastError = error;
      }

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
    }

    throw lastError;
  };

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.HTMLElement.prototype.scrollTo = vi.fn(function scrollToMock(
      this: HTMLElement,
      input?: ScrollToOptions | number,
    ) {
      if (typeof input === "object" && input !== null) {
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
    delete (
      window as typeof window & {
        circleLabel?: unknown;
      }
    ).circleLabel;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("loads existing yolo boxes and keeps zoom working for already-complete images", async () => {
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);
    const naturalWidthSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(5488);
    const naturalHeightSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalHeight", "get")
      .mockReturnValue(3672);

    const openImageFolder = vi.fn().mockResolvedValue({
      folderPath: "/tmp/fiber",
      images: [
        {
          name: "IMG_20260127161603.jpg",
          imagePath: "/tmp/fiber/IMG_20260127161603.jpg",
          imageUrl: imageDataUrl,
          annotationPath: "/tmp/fiber/IMG_20260127161603.txt",
        },
      ],
    });
    const readAnnotation = vi
      .fn()
      .mockResolvedValue("0 0.450073 0.341503 0.145773 0.217865");
    const writeAnnotation = vi.fn().mockResolvedValue(undefined);

    (
      window as typeof window & {
        circleLabel: {
          openImageFolder: typeof openImageFolder;
          readAnnotation: typeof readAnnotation;
          writeAnnotation: typeof writeAnnotation;
        };
      }
    ).circleLabel = {
      openImageFolder,
      readAnnotation,
      writeAnnotation,
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const openFolderButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open Folder",
    );
    expect(openFolderButton).not.toBeUndefined();

    await act(async () => {
      openFolderButton?.click();
    });

    await waitFor(() => {
      expect(readAnnotation).toHaveBeenCalledWith("/tmp/fiber/IMG_20260127161603.txt");
    });

    // Debug the full app state before the canvas assertions.
    expect(container.querySelector(".box-row")).not.toBeNull();
    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "14%",
    );
    expect(container.querySelector(".canvas-box")).not.toBeNull();

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

    await act(async () => {
      stage!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: 400,
          clientY: 260,
          deltaY: -100,
        }),
      );
    });

    expect(container.querySelector(".canvas-toolbar-meta strong")?.textContent).toBe(
      "15%",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
    completeSpy.mockRestore();
    naturalWidthSpy.mockRestore();
    naturalHeightSpy.mockRestore();
  });

  it("renders the status message in a dedicated wrapper for stable truncation", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const statusMessage = container.querySelector(".status-message");

    expect(statusMessage).not.toBeNull();
    expect(statusMessage?.textContent).toBe("Open a folder to begin.");
    expect(statusMessage?.getAttribute("title")).toBe("Open a folder to begin.");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
