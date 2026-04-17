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

export const getScrollSpaceSize = (
  contentSize: ImageSize,
  viewportSize: ImageSize,
  padding: number,
): ImageSize => ({
  width: Math.max(contentSize.width + padding * 2, viewportSize.width),
  height: Math.max(contentSize.height + padding * 2, viewportSize.height),
});

export const getAnchoredScrollSpaceLength = (input: {
  contentLength: number;
  viewportLength: number;
  padding: number;
  viewportPoint: number;
  anchoredContentPoint: number;
}): number => {
  const baseLength = Math.max(
    input.contentLength + input.padding * 2,
    input.viewportLength,
  );
  const minLengthForStart =
    input.contentLength + 2 * (input.viewportPoint - input.anchoredContentPoint);
  const minLengthForEnd =
    2 * input.viewportLength -
    input.contentLength +
    2 * (input.anchoredContentPoint - input.viewportPoint);

  return Math.ceil(
    Math.max(baseLength, minLengthForStart, minLengthForEnd),
  );
};

export const clampContentPoint = (
  contentPoint: { x: number; y: number },
  contentSize: ImageSize,
) => ({
  x: Math.max(0, Math.min(contentPoint.x, contentSize.width)),
  y: Math.max(0, Math.min(contentPoint.y, contentSize.height)),
});

export const shouldPreservePaddingOnZoomAxis = (input: {
  padding: number;
  previousContentOrigin: number;
  previousScrollOffset: number;
  nextScrollOffset: number;
}): boolean =>
  // Avoid a jarring first-step jump when the fitted image is already flush to
  // the viewport padding on this axis.
  Math.abs(input.previousContentOrigin - input.padding) <= 1 &&
  input.previousScrollOffset === 0 &&
  input.nextScrollOffset > 0 &&
  input.nextScrollOffset <= input.padding;

export const clampViewportPointToContentBounds = (input: {
  viewportPoint: { x: number; y: number };
  contentOffset: { x: number; y: number };
  contentOrigin: { x: number; y: number };
  contentSize: ImageSize;
}) => ({
  x: Math.max(
    input.contentOrigin.x - input.contentOffset.x,
    Math.min(
      input.viewportPoint.x,
      input.contentOrigin.x - input.contentOffset.x + input.contentSize.width,
    ),
  ),
  y: Math.max(
    input.contentOrigin.y - input.contentOffset.y,
    Math.min(
      input.viewportPoint.y,
      input.contentOrigin.y - input.contentOffset.y + input.contentSize.height,
    ),
  ),
});

export const getCenteredContentOrigin = (
  scrollSpaceSize: ImageSize,
  contentSize: ImageSize,
) => ({
  x: Math.round((scrollSpaceSize.width - contentSize.width) / 2),
  y: Math.round((scrollSpaceSize.height - contentSize.height) / 2),
});

export const shouldKeepFittedContentOriginOnZoomAxis = (input: {
  padding: number;
  previousContentOrigin: number;
  nextCenteredOrigin: number;
  nextContentLength: number;
  viewportLength: number;
}): boolean =>
  Math.abs(input.previousContentOrigin - input.padding) <= 1 &&
  input.nextContentLength + input.padding * 2 <= input.viewportLength &&
  input.nextCenteredOrigin > input.previousContentOrigin;

export const getStableOriginForFittedContentAxis = (input: {
  padding: number;
  previousContentOrigin: number;
  previousScrollOffset: number;
  nextContentLength: number;
  viewportLength: number;
}): number => {
  const minOrigin = input.padding;
  const maxOrigin = Math.max(
    minOrigin,
    input.viewportLength - input.padding - input.nextContentLength,
  );
  const previousVisibleOrigin =
    input.previousContentOrigin - input.previousScrollOffset;

  return Math.round(
    Math.max(minOrigin, Math.min(previousVisibleOrigin, maxOrigin)),
  );
};

export const clampContentOrigin = (input: {
  contentOrigin: { x: number; y: number };
  contentSize: ImageSize;
  viewportSize: ImageSize;
  padding: number;
}) => {
  const clampAxis = (
    origin: number,
    contentLength: number,
    viewportLength: number,
  ) => {
    const minOrigin =
      contentLength + input.padding * 2 <= viewportLength
        ? input.padding
        : viewportLength - input.padding - contentLength;
    const maxOrigin =
      contentLength + input.padding * 2 <= viewportLength
        ? viewportLength - input.padding - contentLength
        : input.padding;

    return Math.round(Math.max(minOrigin, Math.min(origin, maxOrigin)));
  };

  return {
    x: clampAxis(
      input.contentOrigin.x,
      input.contentSize.width,
      input.viewportSize.width,
    ),
    y: clampAxis(
      input.contentOrigin.y,
      input.contentSize.height,
      input.viewportSize.height,
    ),
  };
};

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

export const clampScrollOffset = (input: {
  scrollOffset: { left: number; top: number };
  scrollSpaceSize: ImageSize;
  viewportSize: ImageSize;
}) => ({
  left: Math.max(
    0,
    Math.min(
      input.scrollOffset.left,
      Math.max(0, input.scrollSpaceSize.width - input.viewportSize.width),
    ),
  ),
  top: Math.max(
    0,
    Math.min(
      input.scrollOffset.top,
      Math.max(0, input.scrollSpaceSize.height - input.viewportSize.height),
    ),
  ),
});
