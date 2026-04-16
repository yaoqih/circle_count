# Circle Label

Windows-friendly desktop annotation tool for fiber connector end-face images.

## Features

- Open one image folder at a time.
- Navigate with previous and next controls.
- Add multiple fixed-size boxes and drag them to the right place.
- Zoom in to inspect edge alignment and pan around the image.
- Auto-save YOLO `.txt` labels when switching images.
- Load existing YOLO labels automatically.
- Single-class annotations using class `0`.
- Keyboard shortcuts for fast labeling.

## YOLO Output

For an image like `sample_001.jpg`, the app writes labels to `sample_001.txt` in the same folder.

Each line is stored as:

```txt
0 x_center y_center width height
```

All coordinates are normalized to the original image size.

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Windows Packaging

Local packaging command:

```bash
npm run dist
```

Generated artifacts are written to `release/`.

## GitHub Actions

The workflow at `.github/workflows/windows-build.yml` builds the app on `windows-latest`, runs tests, and uploads the packaged Windows artifacts.

## Shortcuts

- `Ctrl+O`: open image folder
- `Ctrl+S`: save current image immediately
- `W`: start a fixed-size box that follows the mouse
- `S`: delete the current box or cancel active placement
- `A`: previous image
- `D`: next image
- Mouse wheel: zoom in or out around the pointer
- Hold `Space` and drag: pan the zoomed image
- Click once on the image: place the box at the current mouse position
