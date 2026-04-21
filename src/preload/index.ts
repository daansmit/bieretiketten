import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface BierRow {
  naam: string
  soort: string
  brouwerij: string
  plaatsnaam: string
  land: string
  alcohol: string | number
  pagina: string | number
  letter: string
}

export interface Api {
  selectFile: () => Promise<string | null>
  getLastFile: () => Promise<string | null>
  readExcel: (filePath: string) => Promise<{ success: boolean; rows?: BierRow[]; error?: string }>
  listImages: (dirPath: string, pagina: string | number) => Promise<string[]>
  openFile: (filePath: string) => Promise<void>
}

const api: Api = {
  selectFile: () => ipcRenderer.invoke('dialog:openFile'),
  getLastFile: () => ipcRenderer.invoke('store:getLastFile'),
  readExcel: (filePath: string) => ipcRenderer.invoke('excel:read', filePath),
  listImages: (dirPath: string, pagina: string | number) =>
    ipcRenderer.invoke('files:listImages', dirPath, pagina),
  openFile: (filePath: string) => ipcRenderer.invoke('shell:openFile', filePath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
