export type ImageEntry = {
  name: string;
  imagePath: string;
  imageUrl: string;
  annotationPath: string;
};

export type OpenFolderResult = {
  folderPath: string;
  images: ImageEntry[];
};

export type CircleLabelApi = {
  openImageFolder: () => Promise<OpenFolderResult | null>;
  readAnnotation: (annotationPath: string) => Promise<string>;
  writeAnnotation: (annotationPath: string, text: string) => Promise<void>;
};

declare global {
  interface Window {
    circleLabel?: CircleLabelApi;
  }
}

export {};
