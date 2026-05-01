import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

export interface BierRow {
  naam: string;
  soort: string;
  brouwerij: string;
  plaatsnaam: string;
  land: string;
  alcohol: string | number;
  pagina: string | number;
  letter: string;
}

export interface Api {
  selectFile: () => Promise<string | null>;
  getLastFile: () => Promise<string | null>;
  selectPhotosDir: () => Promise<string | null>;
  getPhotosDir: () => Promise<string | null>;
  readExcel: (
    filePath: string,
  ) => Promise<{ success: boolean; rows?: BierRow[]; error?: string }>;
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

const api: Api = {
  selectFile: () => ipcRenderer.invoke("dialog:openFile"),
  getLastFile: () => ipcRenderer.invoke("store:getLastFile"),
  selectPhotosDir: () => ipcRenderer.invoke("dialog:selectPhotosDir"),
  getPhotosDir: () => ipcRenderer.invoke("store:getPhotosDir"),
  readExcel: (filePath: string) => ipcRenderer.invoke("excel:read", filePath),
  listImages: (dirPath: string, pagina: string | number) =>
    ipcRenderer.invoke("files:listImages", dirPath, pagina),
  openFile: (filePath: string) =>
    ipcRenderer.invoke("shell:openFile", filePath),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  quitAndInstall: () => ipcRenderer.invoke("updater:quit-and-install"),
  onUpdateAvailable: (cb) => {
    const listener = (
      _e: IpcRendererEvent,
      info: { version: string; releaseDate?: string },
    ) => cb(info);
    ipcRenderer.on("updater:update-available", listener);
    return () =>
      ipcRenderer.removeListener("updater:update-available", listener);
  },
  onUpdateNotAvailable: (cb) => {
    const listener = () => cb();
    ipcRenderer.on("updater:update-not-available", listener);
    return () =>
      ipcRenderer.removeListener("updater:update-not-available", listener);
  },
  onDownloadProgress: (cb) => {
    const listener = (
      _e: IpcRendererEvent,
      progress: {
        percent: number;
        bytesPerSecond: number;
        transferred: number;
        total: number;
      },
    ) => cb(progress);
    ipcRenderer.on("updater:download-progress", listener);
    return () =>
      ipcRenderer.removeListener("updater:download-progress", listener);
  },
  onUpdateDownloaded: (cb) => {
    const listener = (_e: IpcRendererEvent, info: { version: string }) =>
      cb(info);
    ipcRenderer.on("updater:update-downloaded", listener);
    return () =>
      ipcRenderer.removeListener("updater:update-downloaded", listener);
  },
  onUpdaterError: (cb) => {
    const listener = (_e: IpcRendererEvent, msg: string) => cb(msg);
    ipcRenderer.on("updater:error", listener);
    return () => ipcRenderer.removeListener("updater:error", listener);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
