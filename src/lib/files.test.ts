import {
  annotationPathForImage,
  imagePathFromResourceUrl,
  imageResourceUrlForPath,
  isSupportedImageFile,
  sortImagePaths,
} from "./files";

describe("file helpers", () => {
  it("detects supported image files case-insensitively", () => {
    expect(isSupportedImageFile("/tmp/a.JPG")).toBe(true);
    expect(isSupportedImageFile("/tmp/b.webp")).toBe(true);
    expect(isSupportedImageFile("/tmp/c.txt")).toBe(false);
  });

  it("maps an image path to a sibling yolo txt path", () => {
    expect(annotationPathForImage("/tmp/demo/image_01.png")).toBe(
      "/tmp/demo/image_01.txt",
    );
  });

  it("sorts image paths using numeric name ordering", () => {
    expect(
      sortImagePaths([
        "/tmp/folder/image10.jpg",
        "/tmp/folder/image2.jpg",
        "/tmp/folder/image1.jpg",
      ]),
    ).toEqual([
      "/tmp/folder/image1.jpg",
      "/tmp/folder/image2.jpg",
      "/tmp/folder/image10.jpg",
    ]);
  });

  it("round-trips image paths through the custom resource url", () => {
    const imagePath =
      "/Users/huyaoqi/Documents/fiber/已完成采样/采样标本 CD/IMG 01.jpg";

    const resourceUrl = imageResourceUrlForPath(imagePath);

    expect(resourceUrl).toContain("circle-label-image://asset?path=");
    expect(imagePathFromResourceUrl(resourceUrl)).toBe(imagePath);
  });
});
