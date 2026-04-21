import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import ExcelJS from 'exceljs'

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

/**
 * Convert an ExcelJS CellValue to a plain string or number.
 * ExcelJS can return rich-text objects, formula objects, hyperlink objects,
 * error objects, or Dates — none of which JSON-serialise to readable text.
 */
function extractCellValue(value: ExcelJS.CellValue): string | number {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toLocaleDateString('nl-NL')

  // RichText: { richText: Array<{ text: string, font?: ... }> }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('')
  }

  // Formula: { formula: string, result?: CellValue }
  if (typeof value === 'object' && 'formula' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result
    if (result === null || result === undefined) return ''
    return extractCellValue(result as ExcelJS.CellValue)
  }

  // Hyperlink: { text: string | CellRichTextValue, hyperlink: string }
  if (typeof value === 'object' && 'hyperlink' in value) {
    const text = (value as ExcelJS.CellHyperlinkValue).text
    return typeof text === 'string' ? text : extractCellValue(text as ExcelJS.CellValue)
  }

  // Error: { error: string }
  if (typeof value === 'object' && 'error' in value) return ''

  return String(value)
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
  ipcMain.handle('excel:read', async (_event, filePath: string) => {
    try {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(filePath)
      const sheet = workbook.worksheets[0]

      // Read header row (row 1) to build column-name map
      const headerRow = sheet.getRow(1)
      const headers: string[] = []
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').toLowerCase().trim()
      })

      const rows: Record<string, unknown>[] = []
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return // skip header
        const obj: Record<string, unknown> = {}
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const key = headers[colNumber - 1]
          if (key) obj[key] = extractCellValue(cell.value)
        })
        rows.push(obj)
      })

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
