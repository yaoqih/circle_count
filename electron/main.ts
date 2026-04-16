import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  annotationPathForImage,
  imagePathFromResourceUrl,
  imageResourceUrlForPath,
  isSupportedImageFile,
  sortImagePaths,
} from "../src/lib/files";
import type { ImageEntry, OpenFolderResult } from "../src/lib/ipc";
import { buildMainWindowOptions } from "./window-options";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "circle-label-image",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const buildImageEntries = async (folderPath: string): Promise<ImageEntry[]> => {
  const dirEntries = await readdir(folderPath, { withFileTypes: true });
  const imagePaths = sortImagePaths(
    dirEntries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(folderPath, entry.name))
      .filter(isSupportedImageFile),
  );

  return imagePaths.map((imagePath) => ({
    name: path.basename(imagePath),
    imagePath,
    imageUrl: imageResourceUrlForPath(imagePath),
    annotationPath: annotationPathForImage(imagePath),
  }));
};

const createWindow = () => {
  const window = new BrowserWindow(buildMainWindowOptions(__filename));

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  void window.loadFile(path.join(__dirname, "../renderer/index.html"));
};

app.whenReady().then(() => {
  protocol.handle("circle-label-image", (request) =>
    net.fetch(pathToFileURL(imagePathFromResourceUrl(request.url)).href),
  );

  ipcMain.handle("folder:open", async (): Promise<OpenFolderResult | null> => {
    const result = await dialog.showOpenDialog({
      title: "Select image folder",
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    const images = await buildImageEntries(folderPath);

    return {
      folderPath,
      images,
    };
  });

  ipcMain.handle("annotation:read", async (_event, annotationPath: string) => {
    try {
      return await readFile(annotationPath, "utf8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return "";
      }

      throw error;
    }
  });

  ipcMain.handle(
    "annotation:write",
    async (
      _event,
      payload: {
        annotationPath: string;
        text: string;
      },
    ) => {
      await mkdir(path.dirname(payload.annotationPath), { recursive: true });
      await writeFile(payload.annotationPath, payload.text, "utf8");
    },
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
