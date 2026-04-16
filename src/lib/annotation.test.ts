import {
  clampBoxToImage,
  createBoxAroundPoint,
  createCenteredBox,
  parseYoloAnnotation,
  serializeYoloAnnotation,
} from "./annotation";

describe("annotation utilities", () => {
  it("serializes pixel boxes into YOLO rows", () => {
    const text = serializeYoloAnnotation(
      [
        {
          id: "box-1",
          classId: 0,
          x: 20,
          y: 10,
          width: 40,
          height: 20,
        },
      ],
      { width: 100, height: 50 },
    );

    expect(text).toBe("0 0.400000 0.400000 0.400000 0.400000");
  });

  it("parses YOLO rows into clamped pixel boxes", () => {
    const boxes = parseYoloAnnotation("0 0.500000 0.500000 0.400000 0.200000", {
      width: 100,
      height: 80,
    });

    expect(boxes).toEqual([
      {
        id: "parsed-0",
        classId: 0,
        x: 30,
        y: 32,
        width: 40,
        height: 16,
      },
    ]);
  });

  it("clamps boxes into the image bounds", () => {
    const box = clampBoxToImage(
      {
        id: "box-1",
        classId: 0,
        x: -5,
        y: 90,
        width: 20,
        height: 20,
      },
      { width: 100, height: 100 },
    );

    expect(box).toEqual({
      id: "box-1",
      classId: 0,
      x: 0,
      y: 80,
      width: 20,
      height: 20,
    });
  });

  it("creates a centered fixed-size box", () => {
    const box = createCenteredBox(
      { width: 160, height: 120 },
      { width: 60, height: 40 },
      "new-box",
    );

    expect(box).toEqual({
      id: "new-box",
      classId: 0,
      x: 50,
      y: 40,
      width: 60,
      height: 40,
    });
  });

  it("creates a fixed-size box around the pointer and clamps it into the image", () => {
    const centered = createBoxAroundPoint(
      { width: 200, height: 100 },
      { width: 60, height: 40 },
      { x: 110, y: 30 },
      "pointer-box",
    );

    expect(centered).toEqual({
      id: "pointer-box",
      classId: 0,
      x: 80,
      y: 10,
      width: 60,
      height: 40,
    });

    const clamped = createBoxAroundPoint(
      { width: 200, height: 100 },
      { width: 60, height: 40 },
      { x: 5, y: 90 },
      "pointer-box-edge",
    );

    expect(clamped).toEqual({
      id: "pointer-box-edge",
      classId: 0,
      x: 0,
      y: 60,
      width: 60,
      height: 40,
    });
  });
});
