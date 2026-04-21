import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState
} from '@tanstack/react-table'
import type { BierRow } from '../App'

interface Props {
  rows: BierRow[]
  selectedRow: BierRow | null
  onRowSelect: (row: BierRow | null) => void
}

const COLUMNS: { key: keyof BierRow; label: string; filterable: boolean; width?: number }[] = [
  { key: 'naam',       label: 'Naam',        filterable: true,  width: 180 },
  { key: 'soort',      label: 'Soort',       filterable: true,  width: 130 },
  { key: 'brouwerij',  label: 'Brouwerij',   filterable: true,  width: 160 },
  { key: 'plaatsnaam', label: 'Plaatsnaam',  filterable: true,  width: 130 },
  { key: 'land',       label: 'Land',        filterable: true,  width: 110 },
  { key: 'alcohol',    label: 'Alcohol',     filterable: true,  width: 80  },
  { key: 'pagina',     label: 'Pagina',      filterable: true,  width: 70  },
  { key: 'letter',     label: 'Letter',      filterable: false, width: 60  }
]

export function BierTable({ rows, selectedRow, onRowSelect }: Props): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})

  const columns = useMemo<ColumnDef<BierRow>[]>(
    () =>
      COLUMNS.map((col) => ({
        accessorKey: col.key,
        header: col.label,
        size: col.width,
        enableColumnFilter: col.filterable,
        filterFn: 'includesString'
      })),
    []
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  const handleFilterChange = (key: string, value: string): void => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    table.getColumn(key)?.setFilterValue(value || undefined)
  }

  const handleClearFilters = (): void => {
    setFilterValues({})
    setColumnFilters([])
  }

  const hasActiveFilters = Object.values(filterValues).some((v) => v !== '')

  const filterableColumns = COLUMNS.filter((c) => c.filterable)

  return (
    <>
      {/* Filter Bar */}
      <div className="filter-bar">
        {filterableColumns.map((col) => (
          <div className="filter-group" key={col.key} style={{ width: col.width }}>
            <label htmlFor={`filter-${col.key}`}>{col.label}</label>
            <input
              id={`filter-${col.key}`}
              type="text"
              placeholder={`Zoek…`}
              value={filterValues[col.key] ?? ''}
              onChange={(e) => handleFilterChange(col.key, e.target.value)}
            />
          </div>
        ))}
        {hasActiveFilters && (
          <button className="btn btn-secondary clear-btn" onClick={handleClearFilters}>
            ✕ Wissen
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="sort-icon">
                        {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isSelected = selectedRow === row.original
              return (
                <tr
                  key={row.id}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => onRowSelect(isSelected ? null : row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} title={String(cell.getValue() ?? '')}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        {table.getFilteredRowModel().rows.length} van {rows.length} etiketten
        {hasActiveFilters && ' (gefilterd)'}
      </div>
    </>
  )
}
