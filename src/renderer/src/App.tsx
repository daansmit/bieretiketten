import { useState, useEffect, useCallback } from "react";
import { BierTable } from "./components/BierTable";
import { ImageViewer } from "./components/ImageViewer";
import { basename } from "./utils/path";

export interface BierRow {
  naam: string;
  soort: string;
  brouwerij: string;
  plaatsnaam: string;
  land: string;
  alcohol: string | number;
  categorie: string;
  kleur: string;
  pagina: string | number;
  letter: string;
  [key: string]: string | number;
}

export default function App(): JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [photosDir, setPhotosDir] = useState<string | null>(null);
  const [rows, setRows] = useState<BierRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<BierRow | null>(null);
  const [imageFiles, setImageFiles] = useState<string[]>([]);

  type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "error";
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const loadFile = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedRow(null);
    setImageFiles([]);
    const result = await window.api.readExcel(path);
    setLoading(false);
    if (result.success && result.rows) {
      setFilePath(path);
      setRows(result.rows as BierRow[]);
    } else {
      setError(result.error ?? "Onbekende fout");
    }
  }, []);

  // On mount, restore last file
  useEffect(() => {
    window.api.getLastFile().then((lastFile) => {
      if (lastFile) loadFile(lastFile);
    });
    window.api.getPhotosDir().then((dir) => {
      if (dir) setPhotosDir(dir);
    });
  }, [loadFile]);

  // Register auto-updater event listeners
  useEffect(() => {
    const unsubAvailable = window.api.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateStatus("available");
    });
    const unsubNotAvailable = window.api.onUpdateNotAvailable(() => {
      setUpdateStatus("idle");
    });
    const unsubProgress = window.api.onDownloadProgress((progress) => {
      setUpdateStatus("downloading");
      setDownloadProgress(Math.round(progress.percent));
    });
    const unsubDownloaded = window.api.onUpdateDownloaded((info) => {
      setUpdateVersion(info.version);
      setUpdateStatus("downloaded");
    });
    const unsubError = window.api.onUpdaterError((msg) => {
      setUpdateError(msg);
      setUpdateStatus("error");
    });
    return () => {
      unsubAvailable();
      unsubNotAvailable();
      unsubProgress();
      unsubDownloaded();
      unsubError();
    };
  }, []);

  const handleCheckForUpdates = async (): Promise<void> => {
    setUpdateStatus("checking");
    setUpdateError(null);
    await window.api.checkForUpdates();
  };

  const handleSelectFile = async (): Promise<void> => {
    const path = await window.api.selectFile();
    if (path) loadFile(path);
  };

  const handleSelectPhotosDir = async (): Promise<void> => {
    const dir = await window.api.selectPhotosDir();
    if (dir) setPhotosDir(dir);
  };

  const handleRowSelect = useCallback(
    async (row: BierRow | null) => {
      setSelectedRow(row);
      if (row && photosDir) {
        const files = await window.api.listImages(photosDir, row.pagina);
        setImageFiles(files);
      } else {
        setImageFiles([]);
      }
    },
    [photosDir],
  );

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="logo">🍺</span>
        <h1>Bieretiketten</h1>
        <span className="subtitle">Collectie van Sjef</span>
      </header>

      <div className="file-bar">
        <button className="btn btn-secondary" onClick={handleSelectPhotosDir}>
          🖼 {photosDir ? basename(photosDir) : "Fotos map selecteren"}
        </button>
        <button className="btn btn-primary" onClick={handleSelectFile}>
          📂 Excel bestand openen
        </button>
        <span className="file-path">
          {filePath ?? "Geen bestand geselecteerd"}
        </span>
        {filePath && (
          <button
            className="btn btn-secondary"
            onClick={() => loadFile(filePath)}
          >
            ↺ Herladen
          </button>
        )}
        <div className="update-area">
          {(updateStatus === "idle" || updateStatus === "checking") && (
            <button
              className="btn btn-secondary"
              onClick={handleCheckForUpdates}
              disabled={updateStatus === "checking"}
            >
              🔄{" "}
              {updateStatus === "checking"
                ? "Controleren…"
                : "Controleer op updates"}
            </button>
          )}
          {updateStatus === "available" && (
            <div className="update-banner">
              ⬇ Versie {updateVersion} beschikbaar – Downloaden…
            </div>
          )}
          {updateStatus === "downloading" && (
            <div className="update-banner">
              <span>⬇ Downloaden… {downloadProgress}%</span>
              <div className="update-progress">
                <div
                  className="update-progress-bar"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}
          {updateStatus === "downloaded" && (
            <button
              className="btn btn-update"
              onClick={() => window.api.quitAndInstall()}
            >
              ✅ Versie {updateVersion} gereed – Installeer nu
            </button>
          )}
          {updateStatus === "error" && (
            <span className="update-error" title={updateError ?? ""}>
              ⚠ Update mislukt
            </span>
          )}
        </div>
      </div>

      <div className="app-body">
        <div className="main-panel">
          {loading && (
            <div className="empty-state">
              <span className="icon">⏳</span>
              <p>Bestand laden…</p>
            </div>
          )}
          {!loading && error && (
            <div className="empty-state">
              <span className="icon">⚠️</span>
              <p>Fout: {error}</p>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="empty-state">
              <span className="icon">🍺</span>
              <p>Open een Excel bestand om uw collectie te bekijken</p>
            </div>
          )}
          {!loading && !error && rows.length > 0 && (
            <BierTable
              rows={rows}
              onRowSelect={handleRowSelect}
              selectedRow={selectedRow}
            />
          )}
        </div>

        <div className={`side-panel${selectedRow ? "" : " hidden"}`}>
          {selectedRow && (
            <ImageViewer
              row={selectedRow}
              files={imageFiles}
              onClose={() => handleRowSelect(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
