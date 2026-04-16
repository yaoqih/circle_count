export type ImageSize = {
  width: number;
  height: number;
};

export type AnnotationBox = {
  id: string;
  classId: 0;
  x: number;
  y: number;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export const clampBoxToImage = (
  box: AnnotationBox,
  imageSize: ImageSize,
): AnnotationBox => {
  const width = clamp(box.width, 1, imageSize.width);
  const height = clamp(box.height, 1, imageSize.height);
  const x = clamp(box.x, 0, imageSize.width - width);
  const y = clamp(box.y, 0, imageSize.height - height);

  return {
    ...box,
    x,
    y,
    width,
    height,
  };
};

export const createBoxAroundPoint = (
  imageSize: ImageSize,
  boxSize: ImageSize,
  point: { x: number; y: number },
  id: string,
): AnnotationBox =>
  clampBoxToImage(
    {
      id,
      classId: 0,
      x: Math.round(point.x - boxSize.width / 2),
      y: Math.round(point.y - boxSize.height / 2),
      width: boxSize.width,
      height: boxSize.height,
    },
    imageSize,
  );

export const createCenteredBox = (
  imageSize: ImageSize,
  boxSize: ImageSize,
  id: string,
): AnnotationBox => {
  const width = clamp(boxSize.width, 1, imageSize.width);
  const height = clamp(boxSize.height, 1, imageSize.height);

  return {
    id,
    classId: 0,
    x: Math.round((imageSize.width - width) / 2),
    y: Math.round((imageSize.height - height) / 2),
    width,
    height,
  };
};

export const serializeYoloAnnotation = (
  boxes: AnnotationBox[],
  imageSize: ImageSize,
): string =>
  boxes
    .map((box) => {
      const centerX = (box.x + box.width / 2) / imageSize.width;
      const centerY = (box.y + box.height / 2) / imageSize.height;
      const width = box.width / imageSize.width;
      const height = box.height / imageSize.height;

      return [
        box.classId,
        centerX.toFixed(6),
        centerY.toFixed(6),
        width.toFixed(6),
        height.toFixed(6),
      ].join(" ");
    })
    .join("\n");

export const parseYoloAnnotation = (
  text: string,
  imageSize: ImageSize,
): AnnotationBox[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [classIdText, centerXText, centerYText, widthText, heightText] =
        line.split(/\s+/);

      const classId = Number(classIdText);
      const centerX = Number(centerXText);
      const centerY = Number(centerYText);
      const width = Number(widthText);
      const height = Number(heightText);

      if (
        !Number.isFinite(classId) ||
        !Number.isFinite(centerX) ||
        !Number.isFinite(centerY) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        throw new Error(`Invalid YOLO row at line ${index + 1}`);
      }

      return clampBoxToImage(
        {
          id: `parsed-${index}`,
          classId: 0,
          x: Math.round((centerX - width / 2) * imageSize.width),
          y: Math.round((centerY - height / 2) * imageSize.height),
          width: Math.round(width * imageSize.width),
          height: Math.round(height * imageSize.height),
        },
        imageSize,
      );
    });
