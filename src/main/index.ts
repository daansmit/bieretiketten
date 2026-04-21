import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs'
import * as XLSX from 'xlsx'

// Simple JSON-based persistent store (avoids extra dependency)
const storePath = join(app.getPath('userData'), 'settings.json')

function readStore(): Record<string, unknown> {
  try {
    if (existsSync(storePath)) {
      return JSON.parse(readFileSync(storePath, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return {}
}

function writeStore(data: Record<string, unknown>): void {
  try {
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch {
    // ignore
  }
}

function storeGet(key: string): unknown {
  return readStore()[key] ?? null
}

function storeSet(key: string, value: unknown): void {
  const data = readStore()
  data[key] = value
  writeStore(data)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Bieretiketten',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.daansmit.bieretiketten')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: Select Excel file via dialog
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecteer Excel bestand',
      filters: [{ name: 'Excel bestanden', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    storeSet('lastFile', filePaths[0])
    return filePaths[0]
  })

  // IPC: Get last opened file path
  ipcMain.handle('store:getLastFile', () => {
    return storeGet('lastFile')
  })

  // IPC: Read Excel file and return rows as JSON
  ipcMain.handle('excel:read', (_event, filePath: string) => {
    try {
      const buffer = readFileSync(filePath)
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      return { success: true, rows }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // IPC: List image/pdf files in a directory matching a pagina value
  ipcMain.handle('files:listImages', (_event, dirPath: string, pagina: string | number) => {
    try {
      const allFiles = readdirSync(dirPath)
      const paginaStr = String(pagina).trim()
      const paginaPadded = paginaStr.padStart(3, '0')

      const matched = allFiles.filter((f) => {
        const lower = f.toLowerCase()
        const isImage = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')
        const isPdf = lower.endsWith('.pdf')
        if (!isImage && !isPdf) return false

        const nameWithoutExt = f.substring(0, f.lastIndexOf('.')).toLowerCase()
        return nameWithoutExt.includes(paginaStr) || nameWithoutExt.includes(paginaPadded)
      })

      return matched.map((f) => join(dirPath, f))
    } catch {
      return []
    }
  })

  // IPC: Open a file with the system default application
  ipcMain.handle('shell:openFile', (_event, filePath: string) => {
    shell.openPath(filePath)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Auto-updater (only in production)
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
