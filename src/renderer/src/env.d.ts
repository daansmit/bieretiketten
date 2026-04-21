import { ElectronAPI } from '@electron-toolkit/preload'
import type { Api } from '../preload/index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
