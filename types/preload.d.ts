export {};

declare global {
  interface LocalMediaFile {
    path: string;
    name: string;
    size: number;
    extension: string;
  }

  interface Window {
    simultaneousInterpretation?: {
      appName: string;
      version: string;
      selectLocalMediaFile: () => Promise<LocalMediaFile | null>;
    };
  }
}
