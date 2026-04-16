import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { ImageCanvas } from "./components/ImageCanvas";
import {
  clampBoxToImage,
  createBoxAroundPoint,
  createCenteredBox,
  parseYoloAnnotation,
  serializeYoloAnnotation,
  type AnnotationBox,
  type ImageSize,
} from "./lib/annotation";
import { getCircleLabelApi } from "./lib/bridge";
import type { ImageEntry } from "./lib/ipc";

const defaultBoxWidth = "120";
const defaultBoxHeight = "120";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
};

const readPositiveInt = (value: string, fallback: number) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const App = () => {
  const [folderPath, setFolderPath] = useState("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [boxes, setBoxes] = useState<AnnotationBox[]>([]);
  const [draftBox, setDraftBox] = useState<AnnotationBox | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [fixedBoxWidth, setFixedBoxWidth] = useState(defaultBoxWidth);
  const [fixedBoxHeight, setFixedBoxHeight] = useState(defaultBoxHeight);
  const [statusMessage, setStatusMessage] = useState("Open a folder to begin.");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const currentImage = images[currentIndex] ?? null;
  const fixedBoxSize = {
    width: readPositiveInt(fixedBoxWidth, 120),
    height: readPositiveInt(fixedBoxHeight, 120),
  };

  const saveCurrentAnnotations = useEffectEvent(async () => {
    if (!currentImage || !imageSize) {
      return true;
    }

    try {
      setIsBusy(true);
      const api = getCircleLabelApi();
      const text = serializeYoloAnnotation(boxes, imageSize);
      await api.writeAnnotation(currentImage.annotationPath, text);
      setStatusMessage(`Saved ${currentImage.name}`);
      setErrorMessage("");
      return true;
    } catch (error) {
      setErrorMessage(`Save failed: ${getErrorMessage(error)}`);
      return false;
    } finally {
      setIsBusy(false);
    }
  });

  const openFolder = useEffectEvent(async () => {
    const saved = await saveCurrentAnnotations();
    if (!saved) {
      return;
    }

    try {
      setIsBusy(true);
      const result = await getCircleLabelApi().openImageFolder();

      if (!result) {
        return;
      }

      startTransition(() => {
        setFolderPath(result.folderPath);
        setImages(result.images);
        setCurrentIndex(0);
        setBoxes([]);
        setDraftBox(null);
        setPointerPosition(null);
        setSelectedBoxId(null);
        setImageSize(null);
      });

      setErrorMessage("");
      setStatusMessage(
        result.images.length === 0
          ? "Folder opened, but no supported images were found."
          : `Loaded ${result.images.length} image(s) from ${result.folderPath}`,
      );
    } catch (error) {
      setErrorMessage(`Open folder failed: ${getErrorMessage(error)}`);
    } finally {
      setIsBusy(false);
    }
  });

  const navigateTo = useEffectEvent(async (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= images.length || nextIndex === currentIndex) {
      return;
    }

    const saved = await saveCurrentAnnotations();
    if (!saved) {
      return;
    }

    startTransition(() => {
      setCurrentIndex(nextIndex);
      setBoxes([]);
      setDraftBox(null);
      setPointerPosition(null);
      setSelectedBoxId(null);
      setImageSize(null);
    });
  });

  const deleteCurrentBox = useEffectEvent(() => {
    if (draftBox) {
      setDraftBox(null);
      setStatusMessage("Box placement cancelled.");
      return;
    }

    if (!selectedBoxId) {
      return;
    }

    setBoxes((currentBoxes) =>
      currentBoxes.filter((box) => box.id !== selectedBoxId),
    );
    setSelectedBoxId(null);
    setStatusMessage("Selected box removed.");
  });

  const updateDraftBoxPosition = useEffectEvent((point: { x: number; y: number }) => {
    if (!imageSize) {
      return;
    }

    setPointerPosition(point);
    setDraftBox((currentDraftBox) =>
      currentDraftBox
        ? createBoxAroundPoint(imageSize, fixedBoxSize, point, currentDraftBox.id)
        : currentDraftBox,
    );
  });

  const beginBoxPlacement = useEffectEvent(() => {
    if (!imageSize) {
      return;
    }

    const nextBox = pointerPosition
      ? createBoxAroundPoint(
          imageSize,
          fixedBoxSize,
          pointerPosition,
          crypto.randomUUID(),
        )
      : createCenteredBox(imageSize, fixedBoxSize, crypto.randomUUID());

    setDraftBox(nextBox);
    setSelectedBoxId(null);
    setStatusMessage("Move the mouse and click once to place the box.");
  });

  const placeDraftBox = useEffectEvent((point?: { x: number; y: number }) => {
    if (!imageSize) {
      return;
    }

    const nextBox =
      point && draftBox
        ? createBoxAroundPoint(imageSize, fixedBoxSize, point, draftBox.id)
        : draftBox;

    if (!nextBox) {
      return;
    }

    setBoxes((currentBoxes) => [...currentBoxes, nextBox]);
    setDraftBox(null);
    setSelectedBoxId(nextBox.id);
    setStatusMessage("Placed a new box.");
  });

  useEffect(() => {
    let cancelled = false;

    const loadAnnotation = async () => {
      if (!currentImage || !imageSize) {
        setBoxes([]);
        setDraftBox(null);
        setSelectedBoxId(null);
        return;
      }

      try {
        setIsBusy(true);
        const text = await getCircleLabelApi().readAnnotation(
          currentImage.annotationPath,
        );

        if (cancelled) {
          return;
        }

        const loadedBoxes = text
          ? parseYoloAnnotation(text, imageSize)
          : [];

        setBoxes(loadedBoxes);
        setDraftBox(null);
        setSelectedBoxId(null);
        setErrorMessage("");
        setStatusMessage(
          text
            ? `Loaded ${loadedBoxes.length} box(es) from ${currentImage.name}`
            : `Loaded ${currentImage.name} with no existing labels`,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBoxes([]);
        setDraftBox(null);
        setSelectedBoxId(null);
        setErrorMessage(`Load annotation failed: ${getErrorMessage(error)}`);
      } finally {
        if (!cancelled) {
          setIsBusy(false);
        }
      }
    };

    void loadAnnotation();

    return () => {
      cancelled = true;
    };
  }, [currentImage, imageSize]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const editable = isEditableTarget(event.target);

      if ((event.ctrlKey || event.metaKey) && key === "o") {
        event.preventDefault();
        void openFolder();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        void saveCurrentAnnotations();
        return;
      }

      if (editable) {
        return;
      }

      if (key === "a") {
        event.preventDefault();
        void navigateTo(currentIndex - 1);
        return;
      }

      if (key === "d" || event.key === "ArrowRight") {
        event.preventDefault();
        void navigateTo(currentIndex + 1);
        return;
      }

      if (key === "w") {
        event.preventDefault();
        beginBoxPlacement();
        return;
      }

      if (
        key === "s" ||
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        event.preventDefault();
        deleteCurrentBox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    beginBoxPlacement,
    currentIndex,
    deleteCurrentBox,
    navigateTo,
    openFolder,
    saveCurrentAnnotations,
  ]);

  return (
    <div className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Fiber End-Face Annotation</p>
            <h1>Circle Label</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="primary-button"
              onClick={() => {
                void openFolder();
              }}
              type="button"
            >
              Open Folder
            </button>
            <button
              className="secondary-button"
              disabled={!currentImage || isBusy}
              onClick={() => {
                void saveCurrentAnnotations();
              }}
              type="button"
            >
              Save Now
            </button>
          </div>
        </header>

        <div className="status-strip">
          <span>{statusMessage}</span>
          {currentImage ? (
            <strong>
              {currentIndex + 1} / {images.length}
            </strong>
          ) : null}
        </div>

        <ImageCanvas
          boxes={boxes}
          draftBox={draftBox}
          imageName={currentImage?.name ?? null}
          imageSize={imageSize}
          imageUrl={currentImage?.imageUrl ?? null}
          isPlacingBox={Boolean(draftBox)}
          onImageError={(imageUrl) => {
            setDraftBox(null);
            setImageSize(null);
            setErrorMessage(
              `Image load failed for ${currentImage?.name ?? "unknown image"}: ${imageUrl}`,
            );
          }}
          onHoverImage={(point) => {
            setPointerPosition(point);
            if (point) {
              updateDraftBoxPosition(point);
            }
          }}
          onImageLoad={setImageSize}
          onMoveBox={(boxId, nextPosition) => {
            if (!imageSize) {
              return;
            }

            setBoxes((currentBoxes) =>
              currentBoxes.map((box) =>
                box.id === boxId
                  ? clampBoxToImage(
                      {
                        ...box,
                        x: nextPosition.x,
                        y: nextPosition.y,
                      },
                      imageSize,
                    )
                  : box,
              ),
            );
          }}
          onPlaceDraftBox={placeDraftBox}
          onSelectBox={setSelectedBoxId}
          selectedBoxId={selectedBoxId}
        />

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </section>

      <aside className="sidebar">
        <section className="panel">
          <h2>Folder</h2>
          <p className="panel-text">
            {folderPath || "No folder selected yet."}
          </p>
        </section>

        <section className="panel">
          <h2>Fixed Box Size</h2>
          <div className="field-grid">
            <label className="field">
              <span>Width</span>
              <input
                inputMode="numeric"
                onChange={(event) => setFixedBoxWidth(event.target.value)}
                value={fixedBoxWidth}
              />
            </label>
            <label className="field">
              <span>Height</span>
              <input
                inputMode="numeric"
                onChange={(event) => setFixedBoxHeight(event.target.value)}
                value={fixedBoxHeight}
              />
            </label>
          </div>
          <button
            className="primary-button full-width"
            disabled={!imageSize}
            onClick={beginBoxPlacement}
            type="button"
          >
            Start Placement
          </button>
        </section>

        <section className="panel">
          <h2>Navigation</h2>
          <div className="button-row">
            <button
              className="secondary-button"
              disabled={currentIndex <= 0 || isBusy}
              onClick={() => {
                void navigateTo(currentIndex - 1);
              }}
              type="button"
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={currentIndex >= images.length - 1 || isBusy}
              onClick={() => {
                void navigateTo(currentIndex + 1);
              }}
              type="button"
            >
              Next
            </button>
          </div>
          <p className="panel-note">Navigation auto-saves the current image.</p>
        </section>

        <section className="panel">
          <h2>Current Image</h2>
          <p className="panel-text">{currentImage?.name ?? "No image loaded."}</p>
          <p className="panel-note">
            {imageSize
              ? `${imageSize.width} × ${imageSize.height}px`
              : "Image dimensions appear after load."}
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Boxes</h2>
            <button
              className="text-button"
              disabled={!selectedBoxId && !draftBox}
              onClick={deleteCurrentBox}
              type="button"
            >
              Delete Current
            </button>
          </div>
          <div className="box-list">
            {boxes.length === 0 ? (
              <p className="panel-note">No boxes on this image.</p>
            ) : (
              boxes.map((box, index) => (
                <button
                  key={box.id}
                  className={`box-row ${
                    selectedBoxId === box.id ? "box-row-selected" : ""
                  }`}
                  onClick={() => setSelectedBoxId(box.id)}
                  type="button"
                >
                  <strong>Box {index + 1}</strong>
                  <span>
                    x:{Math.round(box.x)} y:{Math.round(box.y)} w:
                    {Math.round(box.width)} h:{Math.round(box.height)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel shortcut-panel">
          <h2>Shortcuts</h2>
          <ul>
            <li>Ctrl+O: open folder</li>
            <li>Ctrl+S: save current image</li>
            <li>W: start a box and let it follow the mouse</li>
            <li>S: delete the current box or cancel placement</li>
            <li>A: previous image</li>
            <li>D: next image</li>
            <li>Mouse wheel: zoom in or out around the pointer</li>
            <li>Hold Space and drag: pan the zoomed image</li>
            <li>Click once on the image: place the box</li>
          </ul>
        </section>
      </aside>
    </div>
  );
};

export default App;
