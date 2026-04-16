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
  clampContentPoint,
  clampScrollOffset,
  clampZoom,
  clampViewportPointToContentBounds,
  fitImageIntoViewport,
  getAnchoredScrollSpaceLength,
  getCenteredContentOrigin,
  getScrollForZoomAtPoint,
  getScrollSpaceSize,
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
  onPanModifierChange: (active: boolean) => void;
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
  startScrollLeft: number;
  startScrollTop: number;
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
  onPanModifierChange,
  onPlaceDraftBox,
  onSelectBox,
}: ImageCanvasProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);
  const [viewportSize, setViewportSize] = useState<ImageSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollSpaceOverride, setScrollSpaceOverride] =
    useState<ImageSize | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isPointerInsideViewport, setIsPointerInsideViewport] = useState(false);

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

  const contentSize =
    fittedSize && imageSize
      ? {
          width: Math.max(1, Math.round(fittedSize.width * zoom)),
          height: Math.max(1, Math.round(fittedSize.height * zoom)),
        }
      : null;

  const baseScrollSpaceSize =
    contentSize && viewportSize
      ? getScrollSpaceSize(contentSize, viewportSize, viewportPadding)
      : null;
  const scrollSpaceSize = baseScrollSpaceSize
    ? {
        width: Math.max(baseScrollSpaceSize.width, scrollSpaceOverride?.width ?? 0),
        height: Math.max(
          baseScrollSpaceSize.height,
          scrollSpaceOverride?.height ?? 0,
        ),
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
  const contentOrigin =
    contentSize && scrollSpaceSize
      ? getCenteredContentOrigin(scrollSpaceSize, contentSize)
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
  const panModifierChangeEvent = useEffectEvent((active: boolean) => {
    onPanModifierChange(active);
  });

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

  const resetView = useEffectEvent((nextZoom: number) => {
    pendingScrollRef.current = { left: 0, top: 0 };
    setScrollSpaceOverride(null);
    setZoom(clampZoom(nextZoom));
  });

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    if (
      !viewportRef.current ||
      !viewportSize ||
      !fittedSize ||
      !contentOrigin ||
      !contentSize
    ) {
      return;
    }

    event.preventDefault();

    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = clampZoom(zoom * factor);
    if (nextZoom === zoom) {
      return;
    }

    const nextContentSize = {
      width: Math.max(1, Math.round(fittedSize.width * nextZoom)),
      height: Math.max(1, Math.round(fittedSize.height * nextZoom)),
    };
    const rect = viewportRef.current.getBoundingClientRect();
    const viewportPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const anchoredViewportPoint = clampViewportPointToContentBounds({
      viewportPoint,
      contentOffset: {
        x: viewportRef.current.scrollLeft,
        y: viewportRef.current.scrollTop,
      },
      contentOrigin,
      contentSize,
    });
    const anchoredContentPoint = clampContentPoint(
      {
        x:
          (anchoredViewportPoint.x +
            viewportRef.current.scrollLeft -
            contentOrigin.x) /
          zoom,
        y:
          (anchoredViewportPoint.y +
            viewportRef.current.scrollTop -
            contentOrigin.y) /
          zoom,
      },
      contentSize,
    );
    const nextScrollSpaceSize = {
      width: getAnchoredScrollSpaceLength({
        contentLength: nextContentSize.width,
        viewportLength: viewportSize.width,
        padding: viewportPadding,
        viewportPoint: anchoredViewportPoint.x,
        anchoredContentPoint: anchoredContentPoint.x * nextZoom,
      }),
      height: getAnchoredScrollSpaceLength({
        contentLength: nextContentSize.height,
        viewportLength: viewportSize.height,
        padding: viewportPadding,
        viewportPoint: anchoredViewportPoint.y,
        anchoredContentPoint: anchoredContentPoint.y * nextZoom,
      }),
    };
    pendingScrollRef.current = clampScrollOffset({
      scrollOffset: getScrollForZoomAtPoint({
        viewportPoint: anchoredViewportPoint,
        contentOffset: {
          x: viewportRef.current.scrollLeft,
          y: viewportRef.current.scrollTop,
        },
        previousContentOrigin: contentOrigin,
        nextContentOrigin: getCenteredContentOrigin(
          nextScrollSpaceSize,
          nextContentSize,
        ),
        previousZoom: zoom,
        nextZoom,
      }),
      scrollSpaceSize: nextScrollSpaceSize,
      viewportSize,
    });
    setScrollSpaceOverride(nextScrollSpaceSize);
    setZoom(nextZoom);
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
    panModifierChangeEvent(isSpacePressed);
  }, [isSpacePressed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shouldHandleSpace =
        isPointerInsideViewport ||
        viewportRef.current?.contains(document.activeElement) ||
        false;

      if (
        event.code === "Space" &&
        shouldHandleSpace &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
      panStateRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isPointerInsideViewport]);

  useEffect(() => {
    setZoom(1);
    setScrollSpaceOverride(null);
    dragStateRef.current = null;
    panStateRef.current = null;
    pendingScrollRef.current = null;
    setIsPanning(false);
    hoverImageEvent(null);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
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
    if (pendingScrollRef.current && viewportRef.current) {
      const nextScroll = pendingScrollRef.current;
      viewportRef.current.scrollTo({
        left: nextScroll.left,
        top: nextScroll.top,
      });
      pendingScrollRef.current = null;
    }
  }, [zoom, contentSize]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const panState = panStateRef.current;
      if (panState && viewportRef.current) {
        viewportRef.current.scrollLeft =
          panState.startScrollLeft - (event.clientX - panState.startClientX);
        viewportRef.current.scrollTop =
          panState.startScrollTop - (event.clientY - panState.startClientY);
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
  }, [moveBoxEvent, scaleX, scaleY]);

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
            onClick={() => resetView(zoom / 1.2)}
            type="button"
          >
            -
          </button>
          <button
            className="secondary-button"
            onClick={() => resetView(zoom * 1.2)}
            type="button"
          >
            +
          </button>
          <button
            className="secondary-button"
            onClick={() => resetView(1)}
            type="button"
          >
            Fit
          </button>
          <button
            className="secondary-button"
            onClick={() => resetView(naturalZoom)}
            type="button"
          >
            100%
          </button>
        </div>
        <div className="canvas-toolbar-meta">
          <strong>{zoomPercent}%</strong>
          <span>Wheel to zoom, hold Space to pan</span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`canvas-stage ${
          isPanning ? "canvas-stage-panning" : ""
        } ${isSpacePressed ? "canvas-stage-pan-ready" : ""}`}
          onClick={() => {
          if (!isPlacingBox && !isPanning && !isSpacePressed) {
            onSelectBox(null);
          }
        }}
        onPointerEnter={() => {
          setIsPointerInsideViewport(true);
        }}
        onPointerLeave={() => {
          setIsPointerInsideViewport(false);
        }}
        onPointerDown={(event) => {
          if (!isSpacePressed || zoom <= 1 || !viewportRef.current) {
            return;
          }

          event.preventDefault();
          panStateRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startScrollLeft: viewportRef.current.scrollLeft,
            startScrollTop: viewportRef.current.scrollTop,
          };
          setIsPanning(true);
        }}
        onWheelCapture={handleWheelZoom}
      >
        {contentSize && scrollSpaceSize ? (
          <div
            className="canvas-scroll-space"
            style={{
              width: scrollSpaceSize.width,
              height: scrollSpaceSize.height,
            }}
          >
            <div
              className="canvas-image-shell"
              style={{
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
                  if (!isPlacingBox || isPanning || isSpacePressed) {
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
                  if (isPanning || isSpacePressed) {
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
                      if (isPlacingBox || isPanning || isSpacePressed) {
                        return;
                      }

                      event.stopPropagation();
                      onSelectBox(box.id);
                    }}
                    onPointerDown={(event) => {
                      if (isPlacingBox || isPanning || isSpacePressed) {
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
