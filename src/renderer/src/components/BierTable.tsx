import { useState, useMemo, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import type { BierRow } from "../App";

interface Props {
  rows: BierRow[];
  selectedRow: BierRow | null;
  onRowSelect: (row: BierRow | null) => void;
}

const COLUMNS: {
  key: keyof BierRow;
  label: string;
  width?: number;
}[] = [
  { key: "naam", label: "Naam", width: 180 },
  { key: "soort", label: "Soort", width: 130 },
  { key: "brouwerij", label: "Brouwerij", width: 160 },
  { key: "plaatsnaam", label: "Plaatsnaam", width: 130 },
  { key: "land", label: "Land", width: 110 },
  { key: "alcohol", label: "Alcohol", width: 80 },
  { key: "categorie", label: "Categorie", width: 110 },
  { key: "kleur", label: "Kleur", width: 90 },
  { key: "pagina", label: "Pagina", width: 70 },
  { key: "letter", label: "Letter", width: 60 },
];

// Columns hidden by default
const DEFAULT_VISIBILITY: VisibilityState = {
  categorie: false,
  kleur: false,
};

// Split a search query into terms. Text between double quotes becomes a single
// literal phrase; everything else is split on whitespace into separate words.
// A row must match every term, and a term matches when it is a substring of
// any single column value. So `Heineken 2021` matches a Heineken on page 2021
// (two words, different columns), but `"Heineken 2021"` only matches a cell
// that literally contains "Heineken 2021".
function parseSearchTerms(query: string): string[] {
  const terms: string[] = [];
  const regex = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(query)) !== null) {
    const term = (match[1] ?? match[2]).trim().toLowerCase();
    if (term) terms.push(term);
  }
  return terms;
}

function rowMatchesSearch(row: BierRow, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const values = COLUMNS.map((col) => String(row[col.key] ?? "").toLowerCase());
  return terms.every((term) => values.some((value) => value.includes(term)));
}

export function BierTable({
  rows,
  selectedRow,
  onRowSelect,
}: Props): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);
  // `searchInput` updates on every keystroke so the field stays responsive.
  // `globalFilter` lags behind it (debounced) and is what actually drives the
  // expensive row filtering — important because the dataset is large.
  const [searchInput, setSearchInput] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(DEFAULT_VISIBILITY);

  // Debounce: apply the typed text to the filter 300ms after typing stops.
  useEffect(() => {
    const id = setTimeout(() => setGlobalFilter(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const columns = useMemo<ColumnDef<BierRow>[]>(
    () =>
      COLUMNS.map((col) => ({
        accessorKey: col.key,
        header: col.label,
        size: col.width,
      })),
    [],
  );

  const data = useMemo(() => {
    const terms = parseSearchTerms(globalFilter);
    if (terms.length === 0) return rows;
    return rows.filter((row) => rowMatchesSearch(row, terms));
  }, [rows, globalFilter]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleClearFilters = (): void => {
    setSearchInput("");
    setGlobalFilter("");
  };

  const hasActiveFilters = searchInput !== "";

  const filteredRows = table.getFilteredRowModel().rows;
  const visibleRows = filteredRows.slice(0, 5000);
  const tooManyRows = filteredRows.length > 5000;

  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // Keyboard navigation: ArrowUp / ArrowDown moves the selected row
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      // Don't steal keys from filter inputs
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();

      const currentIndex = visibleRows.findIndex(
        (r) => r.original === selectedRow,
      );
      let nextIndex: number;
      if (e.key === "ArrowDown") {
        nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(currentIndex + 1, visibleRows.length - 1);
      } else {
        nextIndex = currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0);
      }
      if (nextIndex !== currentIndex && visibleRows[nextIndex]) {
        onRowSelect(visibleRows[nextIndex].original);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visibleRows, selectedRow, onRowSelect]);

  // Scroll the selected row into view whenever it changes
  useEffect(() => {
    if (!tbodyRef.current) return;
    const selectedTr = tbodyRef.current.querySelector("tr.selected");
    selectedTr?.scrollIntoView({ block: "nearest" });
  }, [selectedRow]);

  return (
    <>
      {/* Column visibility toggles */}
      <div className="column-toggle-bar">
        <span className="column-toggle-label">Kolommen:</span>
        {COLUMNS.map((col) => {
          const isVisible = columnVisibility[col.key] !== false;
          return (
            <button
              key={col.key}
              className={`btn btn-toggle${isVisible ? " active" : ""}`}
              onClick={() =>
                setColumnVisibility((prev) => ({
                  ...prev,
                  [col.key]: !isVisible,
                }))
              }
            >
              {col.label}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group filter-group-search">
          <label htmlFor="filter-global">Zoeken</label>
          <input
            id="filter-global"
            type="text"
            placeholder={'Zoek in alle kolommen…  (gebruik "…" voor exacte tekst)'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <button
            className="btn btn-secondary clear-btn"
            onClick={handleClearFilters}
          >
            ✕ Wissen
          </button>
        )}
      </div>

      {/* Too-many-results gate */}
      {tooManyRows ? (
        <div className="too-many-rows">
          <span className="icon">🔍</span>
          <p>
            <strong>{filteredRows.length.toLocaleString("nl-NL")}</strong>{" "}
            resultaten gevonden. Verfijn de filter om minder dan 3.000 etiketten
            te tonen.
          </p>
        </div>
      ) : (
        /* Table */
        <div className="table-container">
          <table>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <span className="sort-icon">
                          {sorted === "asc"
                            ? "▲"
                            : sorted === "desc"
                              ? "▼"
                              : ""}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody ref={tbodyRef}>
              {visibleRows.map((row) => {
                const isSelected = selectedRow === row.original;
                return (
                  <tr
                    key={row.id}
                    className={isSelected ? "selected" : ""}
                    onClick={() =>
                      onRowSelect(isSelected ? null : row.original)
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} title={String(cell.getValue() ?? "")}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        {tooManyRows
          ? `${filteredRows.length.toLocaleString("nl-NL")} van ${rows.length.toLocaleString("nl-NL")} etiketten — verfijn de filter`
          : `${filteredRows.length.toLocaleString("nl-NL")} van ${rows.length.toLocaleString("nl-NL")} etiketten${hasActiveFilters ? " (gefilterd)" : ""}`}
      </div>
    </>
  );
}
