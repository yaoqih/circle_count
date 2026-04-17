import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";

import type { AnnotationBox, ImageSize } from "../lib/annotation";
import {
  clampContentOrigin,
  clampContentPoint,
  clampZoom,
  clampViewportPointToContentBounds,
  fitImageIntoViewport,
  getCenteredContentOrigin,
  getScrollSpaceSize,
  getStableOriginForFittedContentAxis,
} from "../lib/viewport";

type ImageCanvasProps = {
  boxes: AnnotationBox[];
  draftBox: AnnotationBox | null;
  imageName: string | null;
  imageSize: ImageSize | null;
  imageUrl: string | null;
  isPlacingBox: boolean;
  selectedBoxId: string | null;
  onImageError: (imageUrl: string) => void;
  onHoverImage: (point: { x: number; y: number } | null) => void;
  onImageLoad: (imageSize: ImageSize) => void;
  onMoveBox: (boxId: string, nextPosition: { x: number; y: number }) => void;
  onPlaceDraftBox: (point: { x: number; y: number }) => void;
  onSelectBox: (boxId: string | null) => void;
};

type DragState = {
  boxId: string;
  originX: number;
  originY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
};

type PanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOriginX: number;
  startOriginY: number;
};

const viewportPadding = 24;

export const ImageCanvas = ({
  boxes,
  draftBox,
  imageName,
  imageSize,
  imageUrl,
  isPlacingBox,
  selectedBoxId,
  onImageError,
  onHoverImage,
  onImageLoad,
  onMoveBox,
  onPlaceDraftBox,
  onSelectBox,
}: ImageCanvasProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const didPanRef = useRef(false);
  const [viewportSize, setViewportSize] = useState<ImageSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [contentOriginOverride, setContentOriginOverride] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const viewportInnerSize = viewportSize
    ? {
        width: Math.max(1, viewportSize.width - viewportPadding * 2),
        height: Math.max(1, viewportSize.height - viewportPadding * 2),
      }
    : null;

  const fittedSize =
    imageSize && viewportInnerSize
      ? fitImageIntoViewport(imageSize, viewportInnerSize)
      : null;

  const naturalZoom =
    imageSize && fittedSize && fittedSize.width > 0
      ? imageSize.width / fittedSize.width
      : 1;
  const clampCanvasZoom = (nextZoom: number) => clampZoom(Math.max(1, nextZoom));

  const contentSize =
    fittedSize && imageSize
      ? {
          width: Math.max(1, Math.round(fittedSize.width * zoom)),
          height: Math.max(1, Math.round(fittedSize.height * zoom)),
        }
      : null;

  const scaleX =
    imageSize && contentSize ? contentSize.width / imageSize.width : 1;
  const scaleY =
    imageSize && contentSize ? contentSize.height / imageSize.height : 1;
  const zoomPercent =
    imageSize && contentSize
      ? Math.round((contentSize.width / imageSize.width) * 100)
      : 100;
  const defaultContentOrigin =
    contentSize && viewportSize
      ? getCenteredContentOrigin(
          getScrollSpaceSize(contentSize, viewportSize, viewportPadding),
          contentSize,
        )
      : null;
  const contentOrigin =
    contentSize && viewportSize && defaultContentOrigin
      ? contentOriginOverride ?? defaultContentOrigin
      : null;

  const moveBoxEvent = useEffectEvent(
    (boxId: string, nextPosition: { x: number; y: number }) => {
      onMoveBox(boxId, nextPosition);
    },
  );
  const hoverImageEvent = useEffectEvent(
    (point: { x: number; y: number } | null) => {
      onHoverImage(point);
    },
  );

  const imagePointFromPointerEvent = (
    event: ReactPointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  ) => {
    if (!imageSize || !contentSize) {
      return null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    return {
      x: Math.round((x / rect.width) * imageSize.width),
      y: Math.round((y / rect.height) * imageSize.height),
    };
  };

  const normalizeContentOrigin = (
    nextOrigin: { x: number; y: number },
    nextDefaultOrigin: { x: number; y: number },
  ) =>
    Math.abs(nextOrigin.x - nextDefaultOrigin.x) <= 1 &&
    Math.abs(nextOrigin.y - nextDefaultOrigin.y) <= 1
      ? null
      : nextOrigin;

  const zoomAtPoint = useEffectEvent(
    (nextZoomInput: number, viewportPoint: { x: number; y: number }) => {
      const nextZoom = clampCanvasZoom(nextZoomInput);
      if (
        !viewportSize ||
        !fittedSize ||
        !contentOrigin ||
        !contentSize ||
        !imageSize ||
        nextZoom === zoom
      ) {
        return;
      }

      const nextContentSize = {
        width: Math.max(1, Math.round(fittedSize.width * nextZoom)),
        height: Math.max(1, Math.round(fittedSize.height * nextZoom)),
      };
      const nextDefaultOrigin = getCenteredContentOrigin(
        getScrollSpaceSize(nextContentSize, viewportSize, viewportPadding),
        nextContentSize,
      );
      const anchoredViewportPoint = clampViewportPointToContentBounds({
        viewportPoint,
        contentOffset: { x: 0, y: 0 },
        contentOrigin,
        contentSize,
      });
      const anchoredImagePoint = clampContentPoint(
        {
          x: (anchoredViewportPoint.x - contentOrigin.x) / scaleX,
          y: (anchoredViewportPoint.y - contentOrigin.y) / scaleY,
        },
        imageSize,
      );
      const rawNextOrigin = {
        x:
          anchoredViewportPoint.x -
          anchoredImagePoint.x * (nextContentSize.width / imageSize.width),
        y:
          anchoredViewportPoint.y -
          anchoredImagePoint.y * (nextContentSize.height / imageSize.height),
      };
      const stabilizedNextOrigin =
        nextZoom < zoom &&
        nextContentSize.height + viewportPadding * 2 <= viewportSize.height
          ? {
              ...rawNextOrigin,
              y: getStableOriginForFittedContentAxis({
                padding: viewportPadding,
                previousContentOrigin: contentOrigin.y,
                previousScrollOffset: 0,
                nextContentLength: nextContentSize.height,
                viewportLength: viewportSize.height,
              }),
            }
          : rawNextOrigin;
      const nextContentOrigin = clampContentOrigin({
        contentOrigin: stabilizedNextOrigin,
        contentSize: nextContentSize,
        viewportSize,
        padding: viewportPadding,
      });

      setContentOriginOverride(
        normalizeContentOrigin(nextContentOrigin, nextDefaultOrigin),
      );
      setZoom(nextZoom);
    },
  );

  const zoomFromToolbar = useEffectEvent((nextZoom: number) => {
    if (!viewportSize) {
      setContentOriginOverride(null);
      setZoom(clampCanvasZoom(nextZoom));
      return;
    }

    zoomAtPoint(nextZoom, {
      x: viewportSize.width / 2,
      y: viewportSize.height / 2,
    });
  });

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    if (!viewportRef.current || !viewportSize) {
      return;
    }

    event.preventDefault();

    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const rect = viewportRef.current.getBoundingClientRect();
    zoomAtPoint(zoom * factor, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return;
    }

    const syncSize = () => {
      setViewportSize({
        width: viewportElement.clientWidth,
        height: viewportElement.clientHeight,
      });
    };

    syncSize();

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(viewportElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageUrl]);

  useEffect(() => {
    const handleBlur = () => {
      panStateRef.current = null;
      didPanRef.current = false;
      setIsPanning(false);
    };

    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    setZoom(1);
    setContentOriginOverride(null);
    dragStateRef.current = null;
    panStateRef.current = null;
    didPanRef.current = false;
    setIsPanning(false);
    hoverImageEvent(null);
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl || imageSize) {
      return;
    }

    let cancelled = false;

    const syncLoadedImageSize = () => {
      const imageElement = imageElementRef.current;
      if (
        imageElement &&
        imageElement.complete &&
        imageElement.naturalWidth > 0 &&
        imageElement.naturalHeight > 0
      ) {
        onImageLoad({
          width: imageElement.naturalWidth,
          height: imageElement.naturalHeight,
        });
        return true;
      }

      return false;
    };

    if (syncLoadedImageSize()) {
      return;
    }

    const pollHandle = window.setInterval(() => {
      if (cancelled) {
        return;
      }

      if (syncLoadedImageSize()) {
        window.clearInterval(pollHandle);
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(pollHandle);
    };
  }, [imageUrl, imageSize, onImageLoad]);

  useEffect(() => {
    if (!contentOriginOverride || !contentSize || !viewportSize) {
      return;
    }

    const nextDefaultOrigin = getCenteredContentOrigin(
      getScrollSpaceSize(contentSize, viewportSize, viewportPadding),
      contentSize,
    );
    const nextContentOrigin = clampContentOrigin({
      contentOrigin: contentOriginOverride,
      contentSize,
      viewportSize,
      padding: viewportPadding,
    });
    const nextOverride = normalizeContentOrigin(
      nextContentOrigin,
      nextDefaultOrigin,
    );

    if (
      nextOverride === null &&
      contentOriginOverride !== null
    ) {
      setContentOriginOverride(null);
      return;
    }

    if (
      nextOverride &&
      (nextOverride.x !== contentOriginOverride.x ||
        nextOverride.y !== contentOriginOverride.y)
    ) {
      setContentOriginOverride(nextOverride);
    }
  }, [
    contentOriginOverride,
    contentSize?.height,
    contentSize?.width,
    viewportSize?.height,
    viewportSize?.width,
  ]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const panState = panStateRef.current;
      if (panState && contentSize && viewportSize && defaultContentOrigin) {
        const nextContentOrigin = clampContentOrigin({
          contentOrigin: {
            x: panState.startOriginX + (event.clientX - panState.startClientX),
            y: panState.startOriginY + (event.clientY - panState.startClientY),
          },
          contentSize,
          viewportSize,
          padding: viewportPadding,
        });
        didPanRef.current =
          didPanRef.current ||
          Math.abs(event.clientX - panState.startClientX) > 2 ||
          Math.abs(event.clientY - panState.startClientY) > 2;
        setContentOriginOverride(
          normalizeContentOrigin(nextContentOrigin, defaultContentOrigin),
        );
        return;
      }

      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      moveBoxEvent(dragState.boxId, {
        x: Math.round(
          dragState.originX + (event.clientX - dragState.startClientX) / scaleX,
        ),
        y: Math.round(
          dragState.originY + (event.clientY - dragState.startClientY) / scaleY,
        ),
      });
    };

    const handlePointerRelease = (event: PointerEvent) => {
      const panState = panStateRef.current;
      if (panState && panState.pointerId === event.pointerId) {
        panStateRef.current = null;
        setIsPanning(false);
      }

      const dragState = dragStateRef.current;
      if (dragState && dragState.pointerId === event.pointerId) {
        dragStateRef.current = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [contentSize, defaultContentOrigin, moveBoxEvent, scaleX, scaleY, viewportSize]);

  if (!imageUrl) {
    return (
      <div className="canvas-empty">
        <div className="canvas-empty-card">
          <p>No image loaded</p>
          <span>Use Ctrl+O to open an image folder.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-panel">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-buttons">
          <button
            className="secondary-button"
            disabled={zoom <= 1}
            onClick={() => zoomFromToolbar(zoom / 1.2)}
            type="button"
          >
            -
          </button>
          <button
            className="secondary-button"
            onClick={() => zoomFromToolbar(zoom * 1.2)}
            type="button"
          >
            +
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setContentOriginOverride(null);
              setZoom(1);
            }}
            type="button"
          >
            Fit
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setContentOriginOverride(null);
              setZoom(clampCanvasZoom(naturalZoom));
            }}
            type="button"
          >
            100%
          </button>
        </div>
        <div className="canvas-toolbar-meta">
          <strong>{zoomPercent}%</strong>
          <span>Wheel to zoom, drag to pan</span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`canvas-stage ${
          isPanning ? "canvas-stage-panning" : ""
        } ${zoom > 1 && !isPlacingBox ? "canvas-stage-pan-ready" : ""}`}
        onClick={() => {
          if (didPanRef.current) {
            didPanRef.current = false;
            return;
          }

          if (!isPlacingBox && !isPanning) {
            onSelectBox(null);
          }
        }}
        onPointerDown={(event) => {
          if (isPlacingBox || zoom <= 1 || !contentOrigin) {
            return;
          }

          event.preventDefault();
          didPanRef.current = false;
          panStateRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startOriginX: contentOrigin.x,
            startOriginY: contentOrigin.y,
          };
          setIsPanning(true);
        }}
        onWheelCapture={handleWheelZoom}
      >
        {contentSize && contentOrigin ? (
          <div className="canvas-scroll-space">
            <div
              className="canvas-image-shell"
              style={{
                left: contentOrigin.x,
                top: contentOrigin.y,
                width: contentSize.width,
                height: contentSize.height,
              }}
            >
              <img
                alt={imageName ?? "annotation image"}
                className="canvas-image"
                ref={imageElementRef}
                onError={() => {
                  onImageError(imageUrl);
                }}
                onLoad={(event) => {
                  onImageLoad({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
                src={imageUrl}
                style={{
                  width: contentSize.width,
                  height: contentSize.height,
                }}
              />
              <div
                className="canvas-overlay"
                onClick={(event) => {
                  if (!isPlacingBox || isPanning) {
                    return;
                  }

                  event.stopPropagation();
                  const point = imagePointFromPointerEvent(event);
                  if (point) {
                    onPlaceDraftBox(point);
                  }
                }}
                onPointerLeave={() => {
                  hoverImageEvent(null);
                }}
                onPointerMove={(event) => {
                  if (isPanning) {
                    return;
                  }

                  const point = imagePointFromPointerEvent(event);
                  hoverImageEvent(point);
                }}
                style={{
                  width: contentSize.width,
                  height: contentSize.height,
                }}
              >
                {boxes.map((box, index) => (
                  <div
                    key={box.id}
                    className={`canvas-box ${
                      selectedBoxId === box.id ? "canvas-box-selected" : ""
                    }`}
                    onClick={(event) => {
                      if (isPlacingBox || isPanning) {
                        return;
                      }

                      event.stopPropagation();
                      onSelectBox(box.id);
                    }}
                    onPointerDown={(event) => {
                      if (isPlacingBox || isPanning) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      dragStateRef.current = {
                        boxId: box.id,
                        originX: box.x,
                        originY: box.y,
                        pointerId: event.pointerId,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                      };
                      onSelectBox(box.id);
                    }}
                    role="button"
                    style={{
                      left: box.x * scaleX,
                      top: box.y * scaleY,
                      width: box.width * scaleX,
                      height: box.height * scaleY,
                    }}
                    tabIndex={-1}
                  >
                    <span className="canvas-box-label">{index + 1}</span>
                  </div>
                ))}
                {draftBox ? (
                  <div
                    className="canvas-box canvas-box-draft canvas-box-selected"
                    style={{
                      left: draftBox.x * scaleX,
                      top: draftBox.y * scaleY,
                      width: draftBox.width * scaleX,
                      height: draftBox.height * scaleY,
                    }}
                  >
                    <span className="canvas-box-label">New</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="canvas-loading-shell">
            <img
              alt={imageName ?? "annotation image"}
              className="canvas-image canvas-image-loading"
              ref={imageElementRef}
              onError={() => {
                onImageError(imageUrl);
              }}
              onLoad={(event) => {
                onImageLoad({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
              src={imageUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
};
