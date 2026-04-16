# Circle Label Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Windows-packaged Electron desktop application that annotates image folders with fixed-size YOLO boxes and keyboard shortcuts.

**Architecture:** Use Electron for desktop shell and filesystem access, React for the renderer UI, and a small shared TypeScript domain layer for annotation parsing, coordinate math, and IPC typing. Keep annotation logic isolated from UI so the save/load path is testable without the GUI.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, electron-builder, GitHub Actions

---

### Task 1: Scaffold the desktop app

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

**Step 1: Write the failing test**

Create a basic domain test shell that imports shared code from `src/lib`.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because project files do not exist yet.

**Step 3: Write minimal implementation**

Add the base project structure, scripts, and an initial renderer that can mount.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the initial domain test shell.

### Task 2: Implement annotation domain logic with TDD

**Files:**
- Create: `src/lib/annotation.ts`
- Create: `src/lib/annotation.test.ts`

**Step 1: Write the failing test**

Add tests for:
- serialize pixel boxes to YOLO rows
- parse YOLO rows back to pixel boxes
- clamp boxes within image bounds
- create a centered fixed-size box

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/annotation.test.ts`
Expected: FAIL because the functions are not implemented.

**Step 3: Write minimal implementation**

Implement the utility functions and types used by the renderer and main process.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/annotation.test.ts`
Expected: PASS

### Task 3: Add file-system and IPC bridge

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Create: `src/lib/ipc.ts`

**Step 1: Write the failing test**

Add a renderer-safe contract test for folder scan and annotation path generation helpers.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/annotation.test.ts`
Expected: FAIL for missing folder scan helper coverage.

**Step 3: Write minimal implementation**

Implement:
- folder picker
- image file scan
- read image annotation
- write image annotation
- typed preload bridge

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/annotation.test.ts`
Expected: PASS

### Task 4: Build the annotation UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/ImageCanvas.tsx`

**Step 1: Write the failing test**

Add a minimal renderer test or utility-backed interaction coverage for selected box and navigation state transitions if needed.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL for the new behavior coverage.

**Step 3: Write minimal implementation**

Implement:
- folder loading flow
- image display
- box overlay rendering
- drag-to-move behavior
- box selection and deletion
- previous and next navigation
- auto-save on image switch
- load existing YOLO annotations
- keyboard shortcuts

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

### Task 5: Add Windows packaging and CI

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/windows-build.yml`
- Create: `electron-builder.yml`
- Create: `README.md`

**Step 1: Write the failing test**

Use build verification as the failure gate for packaging config correctness.

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: FAIL until packaging configuration is complete.

**Step 3: Write minimal implementation**

Add:
- Electron builder config
- portable and NSIS targets
- GitHub Actions workflow on Windows
- usage notes in README

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS
