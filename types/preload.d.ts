export {};

declare global {
  interface Window {
    simultaneousInterpretation?: {
      appName: string;
      version: string;
    };
  }
}
