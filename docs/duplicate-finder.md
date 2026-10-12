# Duplicate Finder — v1 spec

Status: approved, not yet implemented · Target: a new "Dubbelen" mode in the app

## Goal

A **candidate generator**: group rows that are textually identical on a chosen
set of columns, let the user judge each candidate pair against the page scans,
and record confirmed duplicates as a persistent **todo list** for manual
physical cleanup. It never edits the Excel.

Context: the collection was entered by multiple people over many years without a
reliable way to check whether a label already existed, so the data likely holds
duplicates. "Duplicate" here means *the same physical label entered twice* — not
"same beer, different label" (which is legitimate and common). Text matching only
proposes candidates; the human decides by looking at the scans.

## Row identity

`id = normalize(pagina) + "|" + normalize(letter)` — the physical label
(label `letter` A/B/C/D… within page `pagina`). A pair is keyed by its two ids
sorted, so `pairKey` is order-independent.

## Normalization (applied before matching)

- **Text columns** (naam, soort, brouwerij, plaatsnaam, land): trim → collapse
  internal whitespace → lowercase → strip diacritics (`café` → `cafe`).
- **alcohol**: parse to a number — strip `%`, comma → dot, `parseFloat`; if the
  value is `< 1` treat it as a fraction and ×100; round to 1 decimal. So
  `0.065` → `6.5`, and `0.07` = `0.070` = `7%` = `7,0%` → `7.0`. This merges
  formatting differences while keeping genuinely different strengths apart.

## Matching

- Selectable columns, **all 6 on by default**: naam, soort, brouwerij,
  plaatsnaam, land, alcohol. **Minimum 2 selected.**
- Key per row = normalized selected values joined. Group by key; any group of
  **≥2 rows = a candidate cluster**.
- Live counters as columns are toggled: **"N clusters · M rows · P unjudged
  pairs."**
- A pair is excluded from review if it already appears in `confirmed` or
  `dismissed`.

## Persistence — `settings.json` → new `dupeFinder` key

```jsonc
"dupeFinder": {
  "version": 1,
  "confirmed": {                     // the TODO list (= "Dezelfde")
    "<pairKey>": {
      "a": { "pagina","letter","naam","soort","brouwerij","plaatsnaam","land","alcohol" },
      "b": { /* same shape */ },     // full snapshots → searchable, survive Excel changes
      "confirmedAt": "ISO-8601",
      "solved": false,
      "solvedAt": null
    }
  },
  "dismissed": {                     // "Verschillend" — suppressed forever (clearable)
    "<pairKey>": { "dismissedAt": "ISO-8601" }
  }
}
```

- **Skip ("Overslaan") is not persisted** — the pair simply reappears next run
  (the "decide later" behavior).

## UI — new mode "Dubbelen" (next to "Controleer op updates"), two subviews

### A. Review screen

- **Top bar:** `Dezelfde` · `Verschillend` · `Overslaan` · `Ongedaan maken`
  (undo last), a progress counter (`pair 12 / 87`), and the active column chips.
- **Body: two panes side by side.** Each pane =
  - Row data (all fields); **matched fields highlighted**, `pagina` + `letter`
    shown prominently.
  - The page scan with a clear **"Bekijk label C"** banner, plus **independent
    zoom + pan** per pane. (PDFs: the built-in viewer already does zoom/pan;
    image files: reuse/extend the existing lightbox zoom and add drag-to-pan.)
- **Clusters:** the review unit is the cluster. A cluster of 3 steps through its
  pairs (1↔2, 1↔3, 2↔3), labeled "deel 2 van 3 in deze groep". Most clusters are
  size 2 = one pair.
- **Keyboard:** `D` Dezelfde · `V` Verschillend · `O`/`Space` Overslaan ·
  `U` undo · `+`/`-` zoom.

### B. Todo list

- All `confirmed` entries: both members' naam/brouwerij/**pagina + letter**,
  date, and an **"Opgelost"** toggle.
- Filter **Open / Opgelost / Alle**, a search box over the stored snapshots, and
  an open-count badge.
- Nice-to-have: click an item to re-open it in the review screen.

## Explicitly out of scope for v1

- Fuzzy/typo matching (`Heineken` ≠ `Heiniken` won't group) — planned v2.
- Per-label image cropping — we rely on page + letter.
- Writing back to the Excel.

## Edge cases

- **Blank matched field:** two rows blank on a column count as matching on it.
  To avoid junk clusters, **exclude a row from clustering if *all* its selected
  values are blank**, and flag a cluster held together only by blanks.
- **Empty `letter`** (can't point to a label on the page): still reviewable, but
  show a warning since identity is weaker.
- **Duplicate `pagina|letter`** in the data (shouldn't happen): flag, don't
  silently merge.

## Settled design calls

- **Undo** reverts the last Dezelfde/Verschillend (removes it from
  `confirmed`/`dismissed`). One level is enough.
- Clusters > 2 use **pairwise-through-the-group** (no "pick the odd one out" UI).
- The matched-fields highlight **emphasizes** matched columns; non-matched
  columns stay visible, not hidden.

## Why these choices

- Exact-match-after-normalization (not fuzzy) keeps v1 fast (hash-map grouping,
  no all-pairs blowup over ~26k rows), high-precision, and free of threshold
  tuning. Fuzzy is a deliberate v2.
- `pagina + letter` is a stable physical key, far more durable than row position
  if the Excel is re-exported.
- Storing full row snapshots makes the todo list self-contained and searchable
  even after the Excel changes.
