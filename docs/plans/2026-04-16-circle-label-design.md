# Circle Label Desktop Tool Design

**Date:** 2026-04-16

## Goal

Build a Windows-friendly desktop tool for batch annotation of fiber connector end-face images. The tool must load an image folder, create and move fixed-size bounding boxes, navigate between images, and auto-save annotations in YOLO format whenever the current image changes.

## User-Facing Requirements

- Open a folder that contains images.
- Show one image at a time.
- Add multiple fixed-size boxes on the current image.
- Move existing boxes with the mouse.
- Delete selected boxes.
- Go to previous and next image.
- Auto-save the current image annotations when navigating away.
- Load existing YOLO `.txt` annotations automatically.
- Keep a global fixed box width and height that apply to newly created boxes.
- Provide keyboard shortcuts for high-frequency actions.
- Package for direct Windows use.

## Recommended Architecture

Use `Electron + React + TypeScript + Vite`.

Why this approach:
- Electron provides direct file-system access for folder selection and auto-save behavior.
- React is sufficient for a compact single-window annotation UI.
- TypeScript keeps annotation data, coordinate transforms, and IPC contracts explicit.
- Vite keeps renderer build speed high and setup light in an empty repository.

## Functional Design

### Main Window

Single-window layout with two areas:
- Left: image canvas with overlay boxes.
- Right: controls for folder state, image navigation, fixed box size, image metadata, and box list.

### Annotation Interaction

- `Add Box` creates a new box centered in the visible image area using the current global width and height.
- Each box is rendered in image coordinates and can be dragged within image bounds.
- Clicking a box selects it.
- `Delete` removes the selected box.
- New boxes always use the current global width and height.
- Existing boxes keep their stored size unless future resize support is explicitly added.

### Persistence

- Annotation filename: same basename as image, extension `.txt`.
- Format: one YOLO row per box, single class `0`.
- Values are normalized by original image width and height.
- Navigation flow:
  1. Save current image annotations.
  2. Switch image index.
  3. Load target image.
  4. Load its existing YOLO file if present.

### Supported Image Inputs

- `.jpg`
- `.jpeg`
- `.png`
- `.bmp`
- `.webp`

## Keyboard Shortcuts

- `Ctrl+O`: open image folder.
- `A`: add box.
- `Delete` / `Backspace`: delete selected box.
- `Left Arrow`: previous image.
- `Right Arrow`: next image.
- `Ctrl+S`: save current image immediately.
- `W`: focus fixed width input.
- `H`: focus fixed height input.

Shortcuts only fire when they do not conflict with direct text input editing.

## Data Model

```ts
type AnnotationBox = {
  id: string;
  classId: 0;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageEntry = {
  name: string;
  imagePath: string;
  annotationPath: string;
};
```

Coordinate rules:
- `x` and `y` are top-left coordinates in original image pixels.
- `width` and `height` are pixel dimensions in original image space.
- Renderer converts between displayed canvas coordinates and original image coordinates.

## Error Handling

- Empty folder: show explicit empty-state message.
- Non-image files: ignore during folder scan.
- Malformed YOLO file: show a non-blocking error banner and keep current image usable.
- Save failure: keep in-memory annotations unchanged and show the path-specific error.

## Packaging

- Use `electron-builder` for Windows packaging.
- Generate a portable archive and NSIS installer from GitHub Actions on `windows-latest`.
- Keep packaging metadata inside the repository so the user can push and build on GitHub later.

## Testing Strategy

- Unit test YOLO parse/serialize logic.
- Unit test box clamping and coordinate conversion helpers.
- Build-test Electron main process, preload bridge, and renderer bundle.
- Keep UI behavior simple enough that core correctness is covered by utility tests plus production build verification.
