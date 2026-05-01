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
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")
  );
}

function isPdf(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".pdf");
}

export function ImageViewer({ row, files, onClose }: Props): JSX.Element {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const imageFiles = files.filter(isImage);
  const pdfFiles = files.filter(isPdf);

  const toFileUrl = (p: string): string =>
    `local-file://${p.replace(/\\/g, "/")}`;

  // When navigating to a new row, switch the lightbox to the new image
  // (or close it if the new row has no image)
  useEffect(() => {
    setLightboxSrc((prev) => {
      if (prev === null) return null;
      return imageFiles.length > 0 ? toFileUrl(imageFiles[0]) : null;
    });
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
        <button onClick={onClose} title="Sluiten">
          ✕
        </button>
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
            />
            <div className="file-label">{basename(file)}</div>
          </div>
        ))}

        {/* PDFs */}
        {pdfFiles.map((file) => (
          <div className="pdf-item" key={file}>
            <span className="pdf-icon">📄</span>
            <div className="pdf-info">
              <div className="pdf-name" title={basename(file)}>
                {basename(file)}
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => window.api.openFile(file)}
              title="Open PDF"
            >
              Openen
            </button>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
          <button
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxSrc(null);
            }}
            title="Sluiten"
          >
            ✕
          </button>
          <img
            src={lightboxSrc}
            alt="Vergroot"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
