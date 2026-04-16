import type { ImageSize } from "./annotation";

export const clampZoom = (zoom: number): number =>
  Math.min(8, Math.max(0.25, zoom));

export const fitImageIntoViewport = (
  imageSize: ImageSize,
  viewportSize: ImageSize,
): ImageSize => {
  if (imageSize.width <= 0 || imageSize.height <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(
    viewportSize.width / imageSize.width,
    viewportSize.height / imageSize.height,
  );

  return {
    width: Math.round(imageSize.width * scale),
    height: Math.round(imageSize.height * scale),
  };
};

export const getCenteredContentOrigin = (
  scrollSpaceSize: ImageSize,
  contentSize: ImageSize,
) => ({
  x: Math.round((scrollSpaceSize.width - contentSize.width) / 2),
  y: Math.round((scrollSpaceSize.height - contentSize.height) / 2),
});

export const getScrollForZoomAtPoint = (input: {
  viewportPoint: { x: number; y: number };
  contentOffset: { x: number; y: number };
  previousContentOrigin: { x: number; y: number };
  nextContentOrigin: { x: number; y: number };
  previousZoom: number;
  nextZoom: number;
}) => {
  const contentX =
    (input.viewportPoint.x +
      input.contentOffset.x -
      input.previousContentOrigin.x) /
    input.previousZoom;
  const contentY =
    (input.viewportPoint.y +
      input.contentOffset.y -
      input.previousContentOrigin.y) /
    input.previousZoom;

  return {
    left: Math.round(
      input.nextContentOrigin.x +
        contentX * input.nextZoom -
        input.viewportPoint.x,
    ),
    top: Math.round(
      input.nextContentOrigin.y +
        contentY * input.nextZoom -
        input.viewportPoint.y,
    ),
  };
};
