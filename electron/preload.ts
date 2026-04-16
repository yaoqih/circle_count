import { contextBridge, ipcRenderer } from "electron";

import type { CircleLabelApi } from "../src/lib/ipc";

const api: CircleLabelApi = {
  openImageFolder: () => ipcRenderer.invoke("folder:open"),
  readAnnotation: (annotationPath) =>
    ipcRenderer.invoke("annotation:read", annotationPath),
  writeAnnotation: (annotationPath, text) =>
    ipcRenderer.invoke("annotation:write", { annotationPath, text }),
};

contextBridge.exposeInMainWorld("circleLabel", api);
