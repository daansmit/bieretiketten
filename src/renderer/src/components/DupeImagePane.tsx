import { useEffect, useRef, useState } from "react";

function toFileUrl(p: string): string {
  return `local-file://file?p=${encodeURIComponent(p.replace(/\\/g, "/"))}`;
}
function isPdf(p: string): boolean {
  return p.toLowerCase().endsWith(".pdf");
}

interface Props {
  photosDir: string | null;
  pagina: string | number;
  letter: string;
}

// Shows the page scan for a candidate, with the target label called out and
// independent zoom + pan. PDFs use the built-in viewer (its own zoom/pan);
// image files get a scroll-to-pan container with +/- zoom.
export function DupeImagePane({ photosDir, pagina, letter }: Props): JSX.Element {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  useEffect(() => {
    let active = true;
    setScale(1);
    if (!photosDir) {
      setFiles([]);
      return;
    }
    setLoading(true);
    window.api.listImages(photosDir, pagina).then((f) => {
      if (active) {
        setFiles(f);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [photosDir, pagina]);

  const file = files[0];
  const pdf = file ? isPdf(file) : false;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = scrollRef.current;
    if (!el || scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = scrollRef.current;
    if (!el || !drag.current) return;
    el.scrollLeft = drag.current.l - (e.clientX - drag.current.x);
    el.scrollTop = drag.current.t - (e.clientY - drag.current.y);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    drag.current = null;
    try {
      scrollRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="dupe-img-pane">
      <div className="dupe-img-banner">
        Bekijk label <strong>{letter || "?"}</strong> · pagina {String(pagina)}
      </div>
      {!photosDir && (
        <div className="dupe-img-empty">Geen fotos map geselecteerd</div>
      )}
      {photosDir && loading && <div className="dupe-img-empty">Laden…</div>}
      {photosDir && !loading && !file && (
        <div className="dupe-img-empty">
          Geen scan gevonden voor pagina {String(pagina)}
        </div>
      )}
      {file && pdf && (
        <iframe
          className="dupe-img-frame"
          src={toFileUrl(file)}
          title={`Pagina ${pagina}`}
        />
      )}
      {file && !pdf && (
        <>
          <div className="dupe-zoom">
            <button
              onClick={() => setScale((s) => Math.max(1, +(s - 0.5).toFixed(1)))}
              title="Uitzoomen"
            >
              −
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(6, +(s + 0.5).toFixed(1)))}
              title="Inzoomen"
            >
              +
            </button>
          </div>
          <div
            className="dupe-img-scroll"
            ref={scrollRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ cursor: scale > 1 ? "grab" : "default" }}
          >
            <img
              src={toFileUrl(file)}
              alt={`Pagina ${pagina}`}
              style={{ width: `${scale * 100}%` }}
              draggable={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
