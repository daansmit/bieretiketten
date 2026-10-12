// Core logic for the Duplicate Finder (see docs/duplicate-finder.md).
// Pure functions only — no React, no IPC — so they're easy to reason about
// and test. Matching is exact-equality-after-normalisation on a chosen set of
// columns; any group of >=2 rows sharing a key is a candidate cluster.

import type { BierRow } from "../App";

export const MATCH_COLUMNS = [
  "naam",
  "soort",
  "brouwerij",
  "plaatsnaam",
  "land",
  "alcohol",
  "categorie",
  "kleur",
] as const;

export type MatchColumn = (typeof MATCH_COLUMNS)[number];

export const MATCH_COLUMN_LABELS: Record<MatchColumn, string> = {
  naam: "Naam",
  soort: "Soort",
  brouwerij: "Brouwerij",
  plaatsnaam: "Plaatsnaam",
  land: "Land",
  alcohol: "Alcohol",
  categorie: "Categorie",
  kleur: "Kleur",
};

// ----- Normalisation -------------------------------------------------------

/** trim, collapse internal whitespace, lowercase, strip diacritics. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Parse alcohol to a canonical percentage string so formatting differences
 * merge: "0.065" -> "6.5", and "0.07" = "0.070" = "7%" = "7,0%" -> "7.0".
 * Values < 1 are treated as fractions (the sheet stores 0.065 for 6.5%).
 */
export function normalizeAlcohol(value: unknown): string {
  const raw = String(value ?? "")
    .replace("%", "")
    .replace(",", ".")
    .trim();
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return normalizeText(value);
  const pct = n !== 0 && n < 1 ? n * 100 : n;
  return (Math.round(pct * 10) / 10).toFixed(1);
}

export function normalizeColumn(col: MatchColumn, value: unknown): string {
  return col === "alcohol" ? normalizeAlcohol(value) : normalizeText(value);
}

// ----- Identity ------------------------------------------------------------

/** Physical label identity: page + letter (e.g. "5321|a"). */
export function rowId(row: Pick<BierRow, "pagina" | "letter">): string {
  return normalizeText(row.pagina) + "|" + normalizeText(row.letter);
}

/** Order-independent key for a pair of row ids. */
export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}__${idB}` : `${idB}__${idA}`;
}

// ----- Stored data shapes --------------------------------------------------

export interface RowSnapshot {
  pagina: string;
  letter: string;
  naam: string;
  soort: string;
  brouwerij: string;
  plaatsnaam: string;
  land: string;
  alcohol: string;
  categorie: string;
  kleur: string;
}

export interface ConfirmedEntry {
  a: RowSnapshot;
  b: RowSnapshot;
  confirmedAt: string;
  solved: boolean;
  solvedAt: string | null;
}

export interface DismissedEntry {
  dismissedAt: string;
}

export interface DupeData {
  version: number;
  confirmed: Record<string, ConfirmedEntry>;
  dismissed: Record<string, DismissedEntry>;
}

export const EMPTY_DUPE_DATA: DupeData = {
  version: 1,
  confirmed: {},
  dismissed: {},
};

/** Accept whatever came back from the store and coerce to a valid shape. */
export function coerceDupeData(raw: unknown): DupeData {
  const d = (raw ?? {}) as Partial<DupeData>;
  return {
    version: 1,
    confirmed: d.confirmed ?? {},
    dismissed: d.dismissed ?? {},
  };
}

export function toSnapshot(row: BierRow): RowSnapshot {
  const s = (k: keyof BierRow): string => String(row[k] ?? "");
  return {
    pagina: s("pagina"),
    letter: s("letter"),
    naam: s("naam"),
    soort: s("soort"),
    brouwerij: s("brouwerij"),
    plaatsnaam: s("plaatsnaam"),
    land: s("land"),
    alcohol: s("alcohol"),
    categorie: s("categorie"),
    kleur: s("kleur"),
  };
}

// ----- Matching / clustering ----------------------------------------------

/** null => row is unclusterable (all selected values blank). */
export function matchKey(row: BierRow, cols: MatchColumn[]): string | null {
  const parts = cols.map((c) => normalizeColumn(c, row[c]));
  if (parts.every((p) => p === "")) return null;
  return parts.join("\u0001");
}

export interface Cluster {
  key: string;
  rows: BierRow[];
}

export function findClusters(rows: BierRow[], cols: MatchColumn[]): Cluster[] {
  const map = new Map<string, BierRow[]>();
  for (const row of rows) {
    const k = matchKey(row, cols);
    if (k === null) continue;
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  const clusters: Cluster[] = [];
  for (const [key, rs] of map) {
    if (rs.length >= 2) clusters.push({ key, rows: rs });
  }
  return clusters;
}

export interface ReviewPair {
  pairKey: string;
  a: BierRow;
  b: BierRow;
  clusterSize: number;
  indexInCluster: number; // 1-based position among this cluster's pairs
  pairsInCluster: number;
}

/** All unordered pairs within a cluster, skipping identical physical ids. */
function clusterPairs(cluster: Cluster): { a: BierRow; b: BierRow; pk: string }[] {
  const out: { a: BierRow; b: BierRow; pk: string }[] = [];
  const rs = cluster.rows;
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const idA = rowId(rs[i]);
      const idB = rowId(rs[j]);
      if (idA === idB) continue; // same physical label twice: skip
      out.push({ a: rs[i], b: rs[j], pk: pairKey(idA, idB) });
    }
  }
  return out;
}

/** Ordered queue of pairs still needing a decision (not confirmed/dismissed). */
export function buildReviewQueue(
  rows: BierRow[],
  cols: MatchColumn[],
  data: DupeData,
): ReviewPair[] {
  const queue: ReviewPair[] = [];
  // Smallest clusters first: size-2 clusters are a single decisive comparison
  // (the easy, high-value wins); giant clusters (one beer, many label designs)
  // generate many pairs and land at the end where they're easy to skip.
  const clusters = findClusters(rows, cols).sort(
    (a, b) => a.rows.length - b.rows.length,
  );
  for (const cluster of clusters) {
    const pending = clusterPairs(cluster).filter(
      (p) => !data.confirmed[p.pk] && !data.dismissed[p.pk],
    );
    pending.forEach((p, idx) => {
      queue.push({
        pairKey: p.pk,
        a: p.a,
        b: p.b,
        clusterSize: cluster.rows.length,
        indexInCluster: idx + 1,
        pairsInCluster: pending.length,
      });
    });
  }
  return queue;
}

export interface DupeStats {
  clusters: number;
  rowsInClusters: number;
  unjudgedPairs: number;
}

export function computeStats(
  rows: BierRow[],
  cols: MatchColumn[],
  data: DupeData,
): DupeStats {
  const clusters = findClusters(rows, cols);
  let rowsInClusters = 0;
  let unjudgedPairs = 0;
  for (const cluster of clusters) {
    rowsInClusters += cluster.rows.length;
    for (const p of clusterPairs(cluster)) {
      if (!data.confirmed[p.pk] && !data.dismissed[p.pk]) unjudgedPairs++;
    }
  }
  return { clusters: clusters.length, rowsInClusters, unjudgedPairs };
}
