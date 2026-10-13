import { useCallback, useEffect, useMemo, useState } from "react";
import type { BierRow } from "../App";
import {
  MATCH_COLUMNS,
  MATCH_COLUMN_LABELS,
  type MatchColumn,
  type DupeData,
  EMPTY_DUPE_DATA,
  coerceDupeData,
  buildReviewQueue,
  computeStats,
  toSnapshot,
  type ReviewPair,
} from "../lib/dedupe";
import { DupeImagePane } from "./DupeImagePane";

interface Props {
  rows: BierRow[];
  photosDir: string | null;
  onClose: () => void;
}

type Sub = "review" | "todo";
type Action = "same" | "diff" | "skip";

function DataCard({
  row,
  cols,
}: {
  row: BierRow;
  cols: MatchColumn[];
}): JSX.Element {
  const field = (label: string, key: MatchColumn): JSX.Element => {
    const value = String(row[key] ?? "") || "—";
    return (
      <div className={`dupe-field${cols.includes(key) ? " matched" : ""}`}>
        <span className="dupe-field-label">{label}</span>
        <span className="dupe-field-value" title={value}>
          {value}
        </span>
      </div>
    );
  };
  return (
    <div className="dupe-data-card">
      <div className="dupe-id">
        Pagina <strong>{String(row.pagina) || "—"}</strong> · Letter{" "}
        <strong>{String(row.letter) || "—"}</strong>
      </div>
      {field("Naam", "naam")}
      {field("Soort", "soort")}
      {field("Brouwerij", "brouwerij")}
      {field("Plaatsnaam", "plaatsnaam")}
      {field("Land", "land")}
      {field("Alcohol", "alcohol")}
      {field("Categorie", "categorie")}
      {field("Kleur", "kleur")}
    </div>
  );
}

export function DuplicateFinder({
  rows,
  photosDir,
  onClose,
}: Props): JSX.Element {
  const [sub, setSub] = useState<Sub>("review");
  const [data, setData] = useState<DupeData>(EMPTY_DUPE_DATA);
  const [cols, setCols] = useState<MatchColumn[]>([...MATCH_COLUMNS]);
  const [queue, setQueue] = useState<ReviewPair[]>([]);
  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState<{ action: Action; pairKey: string }[]>(
    [],
  );
  const [started, setStarted] = useState(false);

  // todo view controls
  const [todoFilter, setTodoFilter] = useState<"open" | "solved" | "all">(
    "open",
  );
  const [todoSearch, setTodoSearch] = useState("");

  useEffect(() => {
    window.api.getDupeData().then((raw) => setData(coerceDupeData(raw)));
  }, []);

  const persist = useCallback((next: DupeData) => {
    setData(next);
    window.api.saveDupeData(next);
  }, []);

  const stats = useMemo(
    () => computeStats(rows, cols, data),
    [rows, cols, data],
  );
  const openCount = useMemo(
    () => Object.values(data.confirmed).filter((e) => !e.solved).length,
    [data],
  );

  const startReview = (): void => {
    setQueue(buildReviewQueue(rows, cols, data));
    setIdx(0);
    setHistory([]);
    setStarted(true);
  };

  const toggleCol = (c: MatchColumn): void => {
    setStarted(false);
    setCols((prev) =>
      prev.includes(c)
        ? prev.length > 2
          ? prev.filter((x) => x !== c)
          : prev // keep at least 2
        : [...prev, c],
    );
  };

  const current = started ? queue[idx] : undefined;

  const judge = useCallback(
    (action: Action): void => {
      const pair = queue[idx];
      if (!pair) return;
      const pk = pair.pairKey;
      if (action === "same") {
        persist({
          ...data,
          confirmed: {
            ...data.confirmed,
            [pk]: {
              a: toSnapshot(pair.a),
              b: toSnapshot(pair.b),
              confirmedAt: new Date().toISOString(),
              solved: false,
              solvedAt: null,
            },
          },
        });
      } else if (action === "diff") {
        persist({
          ...data,
          dismissed: {
            ...data.dismissed,
            [pk]: { dismissedAt: new Date().toISOString() },
          },
        });
      }
      setHistory((h) => [...h, { action, pairKey: pk }]);
      setIdx((i) => i + 1);
    },
    [queue, idx, data, persist],
  );

  const undo = useCallback((): void => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    if (last.action === "same") {
      const confirmed = { ...data.confirmed };
      delete confirmed[last.pairKey];
      persist({ ...data, confirmed });
    } else if (last.action === "diff") {
      const dismissed = { ...data.dismissed };
      delete dismissed[last.pairKey];
      persist({ ...data, dismissed });
    }
    setHistory((h) => h.slice(0, -1));
    setIdx((i) => Math.max(0, i - 1));
  }, [history, data, persist]);

  // Keyboard shortcuts during review
  useEffect(() => {
    if (sub !== "review" || !started || !current) return;
    const onKey = (e: KeyboardEvent): void => {
      if (document.activeElement instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === "d") {
        e.preventDefault();
        judge("same");
      } else if (k === "v") {
        e.preventDefault();
        judge("diff");
      } else if (k === "o" || e.key === " ") {
        e.preventDefault();
        judge("skip");
      } else if (k === "u") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sub, started, current, judge, undo]);

  const setSolved = (pk: string, solved: boolean): void => {
    const entry = data.confirmed[pk];
    if (!entry) return;
    persist({
      ...data,
      confirmed: {
        ...data.confirmed,
        [pk]: {
          ...entry,
          solved,
          solvedAt: solved ? new Date().toISOString() : null,
        },
      },
    });
  };

  const clearDismissed = (): void => {
    persist({ ...data, dismissed: {} });
    setStarted(false);
  };

  const dismissedCount = Object.keys(data.dismissed).length;

  // ----- Todo list filtering -----
  const todoItems = useMemo(() => {
    const q = todoSearch.trim().toLowerCase();
    return Object.entries(data.confirmed)
      .filter(([, e]) =>
        todoFilter === "all" ? true : todoFilter === "solved" ? e.solved : !e.solved,
      )
      .filter(([, e]) => {
        if (!q) return true;
        const hay = [e.a, e.b]
          .flatMap((r) => [r.naam, r.brouwerij, r.plaatsnaam, r.pagina, r.letter])
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((x, y) => (x[1].confirmedAt < y[1].confirmedAt ? 1 : -1));
  }, [data, todoFilter, todoSearch]);

  return (
    <div className="dupe-finder">
      <div className="dupe-tabs">
        <button
          className={`dupe-tab${sub === "review" ? " active" : ""}`}
          onClick={() => setSub("review")}
        >
          🔍 Beoordelen
        </button>
        <button
          className={`dupe-tab${sub === "todo" ? " active" : ""}`}
          onClick={() => setSub("todo")}
        >
          ✅ Te doen{openCount > 0 ? ` (${openCount})` : ""}
        </button>
        <span className="dupe-spacer" />
        <button className="btn btn-secondary" onClick={onClose}>
          ✕ Sluiten
        </button>
      </div>

      {sub === "review" && (
        <div className="dupe-review">
          <div className="dupe-setup">
            <span className="dupe-setup-label">Vergelijk op:</span>
            {MATCH_COLUMNS.map((c) => {
              const on = cols.includes(c);
              return (
                <button
                  key={c}
                  className={`btn btn-toggle${on ? " active" : ""}`}
                  onClick={() => toggleCol(c)}
                  disabled={on && cols.length <= 2}
                  title={
                    on && cols.length <= 2
                      ? "Minimaal 2 kolommen"
                      : undefined
                  }
                >
                  {MATCH_COLUMN_LABELS[c]}
                </button>
              );
            })}
            <span className="dupe-stats">
              {stats.clusters} groepen · {stats.unjudgedPairs} te beoordelen
            </span>
            <button
              className="btn btn-primary"
              onClick={startReview}
              disabled={stats.unjudgedPairs === 0}
            >
              {started ? "Opnieuw" : "Start"}
            </button>
            {dismissedCount > 0 && (
              <button
                className="btn btn-link"
                onClick={clearDismissed}
                title="Alle 'verschillend'-beslissingen wissen zodat ze opnieuw verschijnen"
              >
                {dismissedCount} weggezet wissen
              </button>
            )}
          </div>

          {!started && (
            <div className="dupe-placeholder">
              <span className="icon">🍺</span>
              <p>
                Kies op welke kolommen je wilt matchen en klik <b>Start</b>.
                <br />
                Minder kolommen = meer mogelijke dubbelen.
              </p>
            </div>
          )}

          {started && !current && (
            <div className="dupe-placeholder">
              <span className="icon">🎉</span>
              <p>
                Klaar! Alle {queue.length} paren in deze selectie zijn
                beoordeeld.
              </p>
            </div>
          )}

          {started && current && (
            <>
              <div className="dupe-actionbar">
                <button className="btn btn-same" onClick={() => judge("same")}>
                  Dezelfde <kbd>D</kbd>
                </button>
                <button className="btn btn-diff" onClick={() => judge("diff")}>
                  Verschillend <kbd>V</kbd>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => judge("skip")}
                >
                  Overslaan <kbd>O</kbd>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={undo}
                  disabled={history.length === 0}
                >
                  ↶ Ongedaan <kbd>U</kbd>
                </button>
                <span className="dupe-progress">
                  Paar {idx + 1} / {queue.length}
                  {current.pairsInCluster > 1 &&
                    ` · groep van ${current.clusterSize} (deel ${current.indexInCluster}/${current.pairsInCluster})`}
                </span>
              </div>

              <div className="dupe-compare">
                <div className="dupe-side">
                  <DataCard row={current.a} cols={cols} />
                  <DupeImagePane
                    photosDir={photosDir}
                    pagina={current.a.pagina}
                    letter={String(current.a.letter)}
                  />
                </div>
                <div className="dupe-side">
                  <DataCard row={current.b} cols={cols} />
                  <DupeImagePane
                    photosDir={photosDir}
                    pagina={current.b.pagina}
                    letter={String(current.b.letter)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {sub === "todo" && (
        <div className="dupe-todo">
          <div className="dupe-todo-bar">
            {(["open", "solved", "all"] as const).map((f) => (
              <button
                key={f}
                className={`btn btn-toggle${todoFilter === f ? " active" : ""}`}
                onClick={() => setTodoFilter(f)}
              >
                {f === "open" ? "Open" : f === "solved" ? "Opgelost" : "Alle"}
              </button>
            ))}
            <input
              className="dupe-todo-search"
              type="text"
              placeholder="Zoeken…"
              value={todoSearch}
              onChange={(e) => setTodoSearch(e.target.value)}
            />
            <span className="dupe-stats">{todoItems.length} items</span>
          </div>

          {todoItems.length === 0 && (
            <div className="dupe-placeholder">
              <span className="icon">📋</span>
              <p>Geen bevestigde dubbelen in deze weergave.</p>
            </div>
          )}

          <div className="dupe-todo-list">
            {todoItems.map(([pk, e]) => (
              <div
                key={pk}
                className={`dupe-todo-item${e.solved ? " solved" : ""}`}
              >
                <label className="dupe-todo-check">
                  <input
                    type="checkbox"
                    checked={e.solved}
                    onChange={(ev) => setSolved(pk, ev.target.checked)}
                  />
                  Opgelost
                </label>
                <div className="dupe-todo-pair">
                  {[e.a, e.b].map((r, i) => (
                    <div className="dupe-todo-member" key={i}>
                      <strong>{r.naam || "—"}</strong>
                      <span>
                        {[r.soort, r.brouwerij, r.plaatsnaam]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="dupe-todo-loc">
                        pagina {r.pagina || "—"} · letter {r.letter || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
