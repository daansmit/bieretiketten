import { useState, useMemo, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
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
  filterable: boolean;
  width?: number;
}[] = [
  { key: "naam", label: "Naam", filterable: true, width: 180 },
  { key: "soort", label: "Soort", filterable: true, width: 130 },
  { key: "brouwerij", label: "Brouwerij", filterable: true, width: 160 },
  { key: "plaatsnaam", label: "Plaatsnaam", filterable: true, width: 130 },
  { key: "land", label: "Land", filterable: true, width: 110 },
  { key: "alcohol", label: "Alcohol", filterable: true, width: 80 },
  { key: "categorie", label: "Categorie", filterable: true, width: 110 },
  { key: "kleur", label: "Kleur", filterable: true, width: 90 },
  { key: "pagina", label: "Pagina", filterable: true, width: 70 },
  { key: "letter", label: "Letter", filterable: false, width: 60 },
];

// Columns hidden by default
const DEFAULT_VISIBILITY: VisibilityState = {
  categorie: false,
  kleur: false,
};

export function BierTable({
  rows,
  selectedRow,
  onRowSelect,
}: Props): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(DEFAULT_VISIBILITY);

  const columns = useMemo<ColumnDef<BierRow>[]>(
    () =>
      COLUMNS.map((col) => ({
        accessorKey: col.key,
        header: col.label,
        size: col.width,
        enableColumnFilter: col.filterable,
        filterFn: "includesString",
      })),
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleFilterChange = (key: string, value: string): void => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    table.getColumn(key)?.setFilterValue(value || undefined);
  };

  const handleClearFilters = (): void => {
    setFilterValues({});
    setColumnFilters([]);
  };

  const hasActiveFilters = Object.values(filterValues).some((v) => v !== "");

  // Only show filter inputs for filterable columns that are currently visible
  const visibleFilterableColumns = COLUMNS.filter(
    (c) => c.filterable && columnVisibility[c.key] !== false,
  );

  const filteredRows = table.getFilteredRowModel().rows;
  const visibleRows = filteredRows.slice(0, 1000);
  const tooManyRows = filteredRows.length > 1000;

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
        {visibleFilterableColumns.map((col) => (
          <div
            className="filter-group"
            key={col.key}
            style={{ width: col.width }}
          >
            <label htmlFor={`filter-${col.key}`}>{col.label}</label>
            <input
              id={`filter-${col.key}`}
              type="text"
              placeholder={`Zoek…`}
              value={filterValues[col.key] ?? ""}
              onChange={(e) => handleFilterChange(col.key, e.target.value)}
            />
          </div>
        ))}
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
            resultaten gevonden. Verfijn de filter om minder dan 1.000 etiketten
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
