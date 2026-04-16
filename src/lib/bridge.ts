import type { CircleLabelApi } from "./ipc";

const missingBridgeMessage =
  "Electron bridge is unavailable. Start the app through Electron and ensure the preload script loads correctly.";

export const getCircleLabelApi = (): CircleLabelApi => {
  if (!window.circleLabel) {
    throw new Error(missingBridgeMessage);
  }

  return window.circleLabel;
};
