import { ElectronAPI } from '@electron-toolkit/preload'

export interface BierApi {
  selectFile: () => Promise<string | null>
  getLastFile: () => Promise<string | null>
  readExcel: (filePath: string) => Promise<{ success: boolean; rows?: Record<string, unknown>[]; error?: string }>
  listImages: (dirPath: string, pagina: string | number) => Promise<string[]>
  openFile: (filePath: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: BierApi
  }
}
