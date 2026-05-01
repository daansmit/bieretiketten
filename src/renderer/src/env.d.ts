import { ElectronAPI } from "@electron-toolkit/preload";

export interface BierApi {
  selectFile: () => Promise<string | null>;
  getLastFile: () => Promise<string | null>;
  selectPhotosDir: () => Promise<string | null>;
  getPhotosDir: () => Promise<string | null>;
  readExcel: (
    filePath: string,
  ) => Promise<{
    success: boolean;
    rows?: Record<string, unknown>[];
    error?: string;
  }>;
  listImages: (dirPath: string, pagina: string | number) => Promise<string[]>;
  openFile: (filePath: string) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
  onUpdateAvailable: (
    cb: (info: { version: string; releaseDate?: string }) => void,
  ) => () => void;
  onUpdateNotAvailable: (cb: () => void) => () => void;
  onDownloadProgress: (
    cb: (progress: {
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }) => void,
  ) => () => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void;
  onUpdaterError: (cb: (msg: string) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: BierApi;
  }
}
