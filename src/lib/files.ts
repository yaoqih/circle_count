import path from "node:path";

const imageExtensionPattern = /\.(jpg|jpeg|png|bmp|webp)$/i;
const imageResourceScheme = "circle-label-image";

export const isSupportedImageFile = (filePath: string): boolean =>
  imageExtensionPattern.test(filePath);

export const annotationPathForImage = (imagePath: string): string => {
  const directory = path.dirname(imagePath);
  const basename = path.basename(imagePath, path.extname(imagePath));

  return path.join(directory, `${basename}.txt`);
};

export const sortImagePaths = (imagePaths: string[]): string[] =>
  [...imagePaths].sort((left, right) =>
    path
      .basename(left)
      .localeCompare(path.basename(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
  );

export const imageResourceUrlForPath = (imagePath: string): string =>
  `${imageResourceScheme}://asset?path=${encodeURIComponent(imagePath)}`;

export const imagePathFromResourceUrl = (resourceUrl: string): string => {
  const url = new URL(resourceUrl);

  if (url.protocol !== `${imageResourceScheme}:`) {
    throw new Error(`Unsupported image resource protocol: ${url.protocol}`);
  }

  const imagePath = url.searchParams.get("path");
  if (!imagePath) {
    throw new Error("Missing path in image resource url");
  }

  return imagePath;
};
