import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
} from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { autoUpdater } from "electron-updater";
import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import ExcelJS from "exceljs";

// Simple JSON-based persistent store (avoids extra dependency)
const storePath = join(app.getPath("userData"), "settings.json");

function readStore(): Record<string, unknown> {
  try {
    if (existsSync(storePath)) {
      return JSON.parse(readFileSync(storePath, "utf-8"));
    }
  } catch {
    // ignore
  }
  return {};
}

function writeStore(data: Record<string, unknown>): void {
  try {
    writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

function storeGet(key: string): unknown {
  return readStore()[key] ?? null;
}

function storeSet(key: string, value: unknown): void {
  const data = readStore();
  data[key] = value;
  writeStore(data);
}

/**
 * Convert an ExcelJS CellValue to a plain string or number.
 * ExcelJS can return rich-text objects, formula objects, hyperlink objects,
 * error objects, or Dates — none of which JSON-serialise to readable text.
 */
function extractCellValue(value: ExcelJS.CellValue): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toLocaleDateString("nl-NL");

  // RichText: { richText: Array<{ text: string, font?: ... }> }
  if (typeof value === "object" && "richText" in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join("");
  }

  // Formula: { formula: string, result?: CellValue }
  if (typeof value === "object" && "formula" in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    if (result === null || result === undefined) return "";
    return extractCellValue(result as ExcelJS.CellValue);
  }

  // Hyperlink: { text: string | CellRichTextValue, hyperlink: string }
  if (typeof value === "object" && "hyperlink" in value) {
    const text = (value as ExcelJS.CellHyperlinkValue).text;
    return typeof text === "string"
      ? text
      : extractCellValue(text as ExcelJS.CellValue);
  }

  // Error: { error: string }
  if (typeof value === "object" && "error" in value) return "";

  return String(value);
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: "Bieretiketten",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  // Register custom protocol so the renderer can load local files
  // (needed because in dev the page loads from http://localhost which blocks file://)
  protocol.handle("local-file", (request) => {
    const filePath = decodeURIComponent(
      request.url.slice("local-file://".length),
    );
    return net.fetch(`file://${filePath}`);
  });

  electronApp.setAppUserModelId("com.daansmit.bieretiketten");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC: Select Excel file via dialog
  ipcMain.handle("dialog:openFile", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Selecteer Excel bestand",
      filters: [{ name: "Excel bestanden", extensions: ["xlsx", "xls"] }],
      properties: ["openFile"],
    });
    if (canceled || filePaths.length === 0) return null;
    storeSet("lastFile", filePaths[0]);
    return filePaths[0];
  });

  // IPC: Get last opened file path
  ipcMain.handle("store:getLastFile", () => {
    return storeGet("lastFile");
  });

  // IPC: Read Excel file and return rows as JSON
  ipcMain.handle("excel:read", async (_event, filePath: string) => {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.worksheets[0];

      // Map known Excel header names (normalised) to canonical field keys.
      // The sheet has a header row (row 1) with 10 columns:
      //   Naam bieren | Soort bier | Brouwerij | Plaatsnaam | Land |
      //   Alcoh.%     | Categorie  | Kleur      | Pagina     | Lettercode
      const HEADER_MAP: Record<string, string> = {
        "naam bieren": "naam",
        "soort bier": "soort",
        brouwerij: "brouwerij",
        plaatsnaam: "plaatsnaam",
        land: "land",
        "alcoh.%": "alcohol",
        categorie: "categorie",
        kleur: "kleur",
        pagina: "pagina",
        lettercode: "letter",
      };

      // Build column-index → canonical-key map from the header row
      const headerRow = sheet.getRow(1);
      const colKeyMap: Record<number, string> = {};
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const raw = String(cell.value ?? "")
          .toLowerCase()
          .trim();
        const key = HEADER_MAP[raw];
        if (key) colKeyMap[colNumber] = key;
      });

      const rows: Record<string, unknown>[] = [];
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const obj: Record<string, unknown> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const key = colKeyMap[colNumber];
          if (!key) return;
          // Percentage cells are stored as decimals (e.g. 0.065 for 6,5%).
          // Format them as Dutch percentage strings.
          if (
            cell.numFmt &&
            cell.numFmt.includes("%") &&
            typeof cell.value === "number"
          ) {
            const pct = cell.value * 100;
            obj[key] =
              pct.toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + "%";
          } else {
            obj[key] = extractCellValue(cell.value);
          }
        });
        rows.push(obj);
      });

      return { success: true, rows };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // IPC: Select a photos parent directory and persist it
  ipcMain.handle("dialog:selectPhotosDir", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Selecteer fotos map",
      properties: ["openDirectory"],
    });
    if (canceled || filePaths.length === 0) return null;
    storeSet("photosDir", filePaths[0]);
    return filePaths[0];
  });

  // IPC: Get last selected photos directory
  ipcMain.handle("store:getPhotosDir", () => {
    return storeGet("photosDir");
  });

  // IPC: Find image/pdf file for a pagina value inside a directory tree.
  // Supports two layouts:
  //   1. Subdirectories with range names like "map 04. 211-280" containing the files.
  //   2. Flat directory where files sit directly.
  // File naming patterns tried (in order): "Pagina {n}.jpg", "Pagina {n}.BMP",
  //   "{n}.pdf", "{n}.jpg", "{n}.BMP".
  ipcMain.handle(
    "files:listImages",
    (_event, dirPath: string, pagina: string | number) => {
      try {
        const paginaStr = String(pagina).trim();
        const paginaNum = parseInt(paginaStr, 10);
        if (isNaN(paginaNum)) return [];

        // Scan top-level entries for range-named subdirectories
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const subdirs: { min: number; max: number; dirPath: string }[] = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const rangeMatch = entry.name.match(/(\d+)-(\d+)/);
          if (rangeMatch) {
            subdirs.push({
              min: parseInt(rangeMatch[1], 10),
              max: parseInt(rangeMatch[2], 10),
              dirPath: join(dirPath, entry.name),
            });
          }
        }

        // Determine which directory to search in
        let searchDir = dirPath;
        if (subdirs.length > 0) {
          const matched = subdirs.find(
            (d) => paginaNum >= d.min && paginaNum <= d.max,
          );
          if (!matched) return [];
          searchDir = matched.dirPath;
        }

        // Try file name patterns in order; return first match
        const candidates = [
          `Pagina ${paginaStr}.jpg`,
          `Pagina ${paginaStr}.BMP`,
          `Pagina ${paginaStr}.bmp`,
          `${paginaStr}.pdf`,
          `${paginaStr}.jpg`,
          `${paginaStr}.BMP`,
          `${paginaStr}.bmp`,
        ];
        const dirFiles = readdirSync(searchDir);
        for (const candidate of candidates) {
          const match = dirFiles.find(
            (f) => f.toLowerCase() === candidate.toLowerCase(),
          );
          if (match) return [join(searchDir, match)];
        }

        return [];
      } catch {
        return [];
      }
    },
  );

  // IPC: Open a file with the system default application
  ipcMain.handle("shell:openFile", (_event, filePath: string) => {
    shell.openPath(filePath);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Auto-updater setup
  function sendToAllWindows(channel: string, data?: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.webContents.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    });
  }

  autoUpdater.on("update-available", (info) => {
    sendToAllWindows("updater:update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-not-available", () => {
    sendToAllWindows("updater:update-not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    sendToAllWindows("updater:download-progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendToAllWindows("updater:update-downloaded", { version: info.version });
  });

  autoUpdater.on("error", (err) => {
    sendToAllWindows("updater:error", err?.message ?? String(err));
  });

  ipcMain.handle("updater:check", async () => {
    try {
      if (is.dev) {
        sendToAllWindows("updater:update-not-available");
        return null;
      }
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      sendToAllWindows("updater:error", (err as Error)?.message ?? String(err));
      return null;
    }
  });

  ipcMain.handle("updater:quit-and-install", () => {
    autoUpdater.quitAndInstall();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
