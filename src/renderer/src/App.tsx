import { useState, useEffect, useCallback } from 'react'
import { BierTable } from './components/BierTable'
import { ImageViewer } from './components/ImageViewer'
import { dirname } from './utils/path'

export interface BierRow {
  naam: string
  soort: string
  brouwerij: string
  plaatsnaam: string
  land: string
  alcohol: string | number
  pagina: string | number
  letter: string
  [key: string]: string | number
}

export default function App(): JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [rows, setRows] = useState<BierRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRow, setSelectedRow] = useState<BierRow | null>(null)
  const [imageFiles, setImageFiles] = useState<string[]>([])

  const loadFile = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    setSelectedRow(null)
    setImageFiles([])
    const result = await window.api.readExcel(path)
    setLoading(false)
    if (result.success && result.rows) {
      setFilePath(path)
      // Normalize keys to lowercase
      const normalized = result.rows.map((r) => {
        const row: BierRow = {
          naam: '',
          soort: '',
          brouwerij: '',
          plaatsnaam: '',
          land: '',
          alcohol: '',
          pagina: '',
          letter: ''
        }
        for (const key of Object.keys(r)) {
          const lk = key.toLowerCase().trim() as keyof BierRow
          if (lk in row) row[lk] = r[key] as string | number
        }
        return row
      })
      setRows(normalized)
    } else {
      setError(result.error ?? 'Onbekende fout')
    }
  }, [])

  // On mount, restore last file
  useEffect(() => {
    window.api.getLastFile().then((lastFile) => {
      if (lastFile) loadFile(lastFile)
    })
  }, [loadFile])

  const handleSelectFile = async (): Promise<void> => {
    const path = await window.api.selectFile()
    if (path) loadFile(path)
  }

  const handleRowSelect = useCallback(
    async (row: BierRow | null) => {
      setSelectedRow(row)
      if (row && filePath) {
        const dir = dirname(filePath)
        const files = await window.api.listImages(dir, row.pagina)
        setImageFiles(files)
      } else {
        setImageFiles([])
      }
    },
    [filePath]
  )

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="logo">🍺</span>
        <h1>Bieretiketten</h1>
        <span className="subtitle">Collectie van Sjef</span>
      </header>

      <div className="file-bar">
        <button className="btn btn-primary" onClick={handleSelectFile}>
          📂 Bestand openen
        </button>
        <span className="file-path">{filePath ?? 'Geen bestand geselecteerd'}</span>
        {filePath && (
          <button className="btn btn-secondary" onClick={() => loadFile(filePath)}>
            ↺ Herladen
          </button>
        )}
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
            <BierTable rows={rows} onRowSelect={handleRowSelect} selectedRow={selectedRow} />
          )}
        </div>

        <div className={`side-panel${selectedRow ? '' : ' hidden'}`}>
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
  )
}
