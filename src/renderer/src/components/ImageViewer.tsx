import { useState, useEffect } from "react";
import type { BierRow } from "../App";
import { basename } from "../utils/path";

interface Props {
  row: BierRow;
  files: string[];
  onClose: () => void;
}

function isImage(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".bmp")
  );
}

function isPdf(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".pdf");
}

export function ImageViewer({ row, files, onClose }: Props): JSX.Element {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [imgErrors, setImgErrors] = useState<Record<string, string>>({});
  const [showDebug, setShowDebug] = useState(false);

  const imageFiles = files.filter(isImage);
  const pdfFiles = files.filter(isPdf);

  const toFileUrl = (p: string): string =>
    `local-file://file?p=${encodeURIComponent(p.replace(/\\/g, "/"))}`;

  // When navigating to a new row, switch the lightbox to the new image
  // (or close it if the new row has no image)
  useEffect(() => {
    setLightboxSrc((prev) => {
      if (prev === null) return null;
      return imageFiles.length > 0 ? toFileUrl(imageFiles[0]) : null;
    });
    setLightboxZoom(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Spacebar toggles the lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== " ") return;
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();
      setLightboxSrc((prev) =>
        prev !== null
          ? null
          : imageFiles.length > 0
            ? toFileUrl(imageFiles[0])
            : null,
      );
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFiles]);
  return (
    <>
      <div className="side-panel-header">
        <span>📸 Afbeeldingen — Pagina {row.pagina}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setShowDebug((v) => !v)}
            title="Debug info"
            style={{ fontSize: 12, opacity: 0.7 }}
          >
            🔍
          </button>
          <button onClick={onClose} title="Sluiten">
            ✕
          </button>
        </div>
      </div>

      <div className="side-panel-content">
        {/* Row info */}
        <div className="row-info-card">
          <div className="row-title">{row.naam || "—"}</div>
          <div className="row-detail">
            {[row.brouwerij, row.plaatsnaam, row.land]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {row.alcohol !== "" && (
            <div className="row-detail">
              🍺 {row.alcohol}% · {row.soort}
            </div>
          )}
        </div>

        {/* Debug panel */}
        {showDebug && (
          <div
            style={{
              background: "#1e1e1e",
              color: "#d4d4d4",
              borderRadius: 4,
              padding: "8px 10px",
              fontSize: 11,
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            <div style={{ color: "#9cdcfe", marginBottom: 4 }}>
              files ({files.length}):
            </div>
            {files.length === 0 ? (
              <div style={{ color: "#f48771" }}>geen bestanden gevonden</div>
            ) : (
              files.map((f) => (
                <div key={f}>
                  <div style={{ color: "#ce9178" }}>{f}</div>
                  <div style={{ color: "#b5cea8" }}>→ {toFileUrl(f)}</div>
                  {imgErrors[f] && (
                    <div style={{ color: "#f48771" }}>✗ {imgErrors[f]}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* No files */}
        {files.length === 0 && (
          <div className="no-images">
            Geen bestanden gevonden voor pagina {row.pagina}
          </div>
        )}

        {/* Images */}
        {imageFiles.map((file) => (
          <div className="image-item" key={file}>
            <img
              src={toFileUrl(file)}
              alt={basename(file)}
              onClick={() => setLightboxSrc(toFileUrl(file))}
              title="Klik om te vergroten"
              onError={(e) => {
                const url = (e.currentTarget as HTMLImageElement).src;
                setImgErrors((prev) => ({ ...prev, [file]: url }));
                setShowDebug(true);
              }}
            />
            <div className="file-label">{basename(file)}</div>
          </div>
        ))}

        {/* PDFs — previewed inline via the built-in PDF viewer */}
        {pdfFiles.map((file) => (
          <div className="pdf-item" key={file}>
            <div className="pdf-header">
              <span className="pdf-name" title={basename(file)}>
                📄 {basename(file)}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => window.api.openFile(file)}
                title="Openen in externe viewer"
              >
                ⤢ Openen
              </button>
            </div>
            <iframe
              className="pdf-frame"
              src={toFileUrl(file)}
              title={basename(file)}
            />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="lightbox-overlay"
          style={
            lightboxZoom === 2
              ? { display: "block", overflow: "auto", cursor: "default" }
              : {}
          }
          onClick={() => {
            setLightboxSrc(null);
            setLightboxZoom(1);
          }}
        >
          <button
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxSrc(null);
              setLightboxZoom(1);
            }}
            title="Sluiten"
          >
            ✕
          </button>
          <button
            className="lightbox-zoom"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxZoom((z) => (z === 1 ? 2 : 1));
            }}
            title={lightboxZoom === 1 ? "Inzoomen (200%)" : "Uitzoomen"}
          >
            {lightboxZoom === 1 ? "🔍+" : "🔍−"}
          </button>
          <img
            src={lightboxSrc}
            alt="Vergroot"
            style={
              lightboxZoom === 2
                ? {
                    maxWidth: "none",
                    maxHeight: "none",
                    width: "180vw",
                    cursor: "zoom-out",
                    margin: "20px auto",
                    display: "block",
                  }
                : { cursor: "zoom-in" }
            }
            onClick={(e) => {
              e.stopPropagation();
              setLightboxZoom((z) => (z === 1 ? 2 : 1));
            }}
          />
        </div>
      )}
    </>
  );
}
