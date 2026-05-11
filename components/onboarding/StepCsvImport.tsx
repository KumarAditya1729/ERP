'use client'
import { useState, useCallback, useRef, useTransition } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type ParsedRow = Record<string, string>;

interface ColumnMapping {
  csvCol: string;
  systemField: string | '';
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  inserted?: number;
  errors?: ValidationError[];
  error?: string;
}

// ── System Fields ─────────────────────────────────────────────────────────────

const SYSTEM_FIELDS = [
  { key: 'first_name',     label: 'First Name',        required: true  },
  { key: 'last_name',      label: 'Last Name',         required: false },
  { key: 'class_grade',    label: 'Class / Grade',     required: true  },
  { key: 'section',        label: 'Section',           required: false },
  { key: 'guardian_name',  label: 'Guardian Name',     required: false },
  { key: 'emergency_contact', label: 'Guardian Phone', required: false },
];

// ── CSV Parser (no dependency) ────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function splitRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitRow(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = splitRow(lines[i]);
    if (vals.every(v => !v)) continue; // skip blank rows
    const row: ParsedRow = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }

  return { headers, rows };
}

// ── Auto-map columns ──────────────────────────────────────────────────────────

function autoMap(csvHeaders: string[]): ColumnMapping[] {
  const aliases: Record<string, string[]> = {
    first_name:     ['first name', 'firstname', 'first', 'given name', 'f name', 'student first'],
    last_name:      ['last name', 'lastname', 'last', 'surname', 'family name', 'student last'],
    class_grade:    ['class', 'grade', 'std', 'standard', 'class grade', 'class/grade'],
    section:        ['section', 'div', 'division'],
    guardian_name:  ['parent name', 'guardian', 'father name', 'mother name', 'parent'],
    emergency_contact: ['phone', 'mobile', 'contact', 'guardian phone', 'parent phone', 'emergency'],
  };

  return csvHeaders.map(csvCol => {
    const normalized = csvCol.toLowerCase().trim();
    for (const [field, aliasList] of Object.entries(aliases)) {
      if (aliasList.some(a => normalized.includes(a) || a.includes(normalized))) {
        return { csvCol, systemField: field };
      }
    }
    return { csvCol, systemField: '' };
  });
}

// ── Validate rows ─────────────────────────────────────────────────────────────

function validateRows(rows: ParsedRow[], mappings: ColumnMapping[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const fieldToCol: Record<string, string> = {};
  for (const m of mappings) {
    if (m.systemField) fieldToCol[m.systemField] = m.csvCol;
  }

  rows.forEach((row, i) => {
    const rowNum = i + 1;

    // first_name required
    const fn = fieldToCol['first_name'] ? row[fieldToCol['first_name']]?.trim() : '';
    if (!fn) errors.push({ row: rowNum, field: 'First Name', message: 'Required — cannot be empty' });

    // class_grade required
    const cls = fieldToCol['class_grade'] ? row[fieldToCol['class_grade']]?.trim() : '';
    if (!cls) errors.push({ row: rowNum, field: 'Class/Grade', message: 'Required — cannot be empty' });

    // guardian phone: if present, validate format
    const phone = fieldToCol['emergency_contact'] ? row[fieldToCol['emergency_contact']]?.trim() : '';
    if (phone && !/^[+\d\s-]{10,15}$/.test(phone)) {
      errors.push({ row: rowNum, field: 'Guardian Phone', message: `"${phone}" is not a valid phone number` });
    }
  });

  return errors;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StepCsvImport({ onComplete }: { onComplete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [stage, setStage] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── File Upload ──────────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      alert('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) { alert('Could not parse CSV. Check the file format.'); return; }
      setHeaders(h);
      setRows(r);
      setMappings(autoMap(h));
      setValidationErrors([]);
      setStage('map');
    };
    reader.readAsText(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Column Mapping ───────────────────────────────────────────────────────────

  function updateMapping(csvCol: string, systemField: string) {
    setMappings(prev => prev.map(m => m.csvCol === csvCol ? { ...m, systemField } : m));
  }

  function proceedToPreview() {
    const errors = validateRows(rows, mappings);
    setValidationErrors(errors);
    setStage('preview');
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  async function confirmImport() {
    const errors = validateRows(rows, mappings);
    if (errors.length > 0) { setValidationErrors(errors); return; }

    const fieldToCol: Record<string, string> = {};
    for (const m of mappings) {
      if (m.systemField) fieldToCol[m.systemField] = m.csvCol;
    }

    const students = rows.map(row => {
      const s: Record<string, string> = {};
      for (const [field, col] of Object.entries(fieldToCol)) {
        s[field] = row[col]?.trim() ?? '';
      }
      return s;
    });

    startTransition(async () => {
      try {
        const res = await fetch('/api/onboarding/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          setImportResult({ success: true, inserted: data.inserted });
          setStage('done');
        } else {
          setImportResult({ success: false, error: data.error || 'Import failed' });
        }
      } catch {
        setImportResult({ success: false, error: 'Network error — check your connection' });
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        Import students via CSV
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Upload a CSV file with student data. Required columns: First Name, Class. You can also skip this step and add students manually later.
      </p>

      {/* ── STAGE: Upload ──────────────────────────────────────── */}
      {stage === 'upload' && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200"
            style={{
              borderColor: 'rgba(124,58,237,0.4)',
              background: 'rgba(124,58,237,0.04)',
            }}
          >
            <div className="text-5xl mb-4">📂</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Drop your CSV file here
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              or click to browse · .csv files only
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <p className="font-semibold mb-1" style={{ color: '#67E8F9' }}>Expected columns (any order):</p>
            <p style={{ color: 'var(--text-muted)' }}>
              First Name · Last Name · Class · Section · Guardian Name · Guardian Phone
            </p>
          </div>

          <div className="flex justify-between items-center mt-6">
            <a href="/sample_students.csv" download className="text-sm underline" style={{ color: 'var(--text-muted)' }}>
              Download sample CSV
            </a>
            <button onClick={onComplete} className="btn-secondary text-sm">
              Skip this step →
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE: Map ─────────────────────────────────────────── */}
      {stage === 'map' && (
        <div>
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
            ✓ Parsed {rows.length} rows from CSV. Map the columns below.
          </div>

          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
              <span>CSV Column</span>
              <span>Maps to System Field</span>
            </div>
            {mappings.map(m => (
              <div key={m.csvCol} className="grid grid-cols-2 gap-4 items-center">
                <div className="erp-input text-sm" style={{ cursor: 'default' }}>
                  {m.csvCol}
                </div>
                <select
                  className="erp-input text-sm"
                  value={m.systemField}
                  onChange={e => updateMapping(m.csvCol, e.target.value)}
                >
                  <option value="">— Skip this column —</option>
                  {SYSTEM_FIELDS.map(f => (
                    <option key={f.key} value={f.key}>
                      {f.label}{f.required ? ' *' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            * Required fields. Columns mapped to the same system field will use the first one only.
          </p>

          <div className="flex justify-between">
            <button onClick={() => setStage('upload')} className="btn-secondary text-sm">← Back</button>
            <button onClick={proceedToPreview} className="btn-primary">Preview →</button>
          </div>
        </div>
      )}

      {/* ── STAGE: Preview ─────────────────────────────────────── */}
      {stage === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Preview — first 10 rows
            </h3>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {rows.length} total rows
            </span>
          </div>

          {validationErrors.length > 0 && (
            <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="font-semibold text-sm mb-2" style={{ color: '#EF4444' }}>
                ⚠ {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''} found
              </p>
              <ul className="text-xs space-y-1" style={{ color: '#FCA5A5' }}>
                {validationErrors.slice(0, 10).map((err, i) => (
                  <li key={i}>Row {err.row}: <strong>{err.field}</strong> — {err.message}</li>
                ))}
                {validationErrors.length > 10 && (
                  <li>... and {validationErrors.length - 10} more</li>
                )}
              </ul>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Fix errors in your CSV and re-upload, or proceed to skip errored rows.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl mb-6" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  {mappings.filter(m => m.systemField).map(m => (
                    <th key={m.csvCol}>{m.csvCol}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => {
                  const hasError = validationErrors.some(e => e.row === i + 1);
                  return (
                    <tr key={i} style={hasError ? { background: 'rgba(239,68,68,0.06)' } : {}}>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      {mappings.filter(m => m.systemField).map(m => (
                        <td key={m.csvCol}>{row[m.csvCol] || '—'}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {importResult && !importResult.success && (
            <div className="p-3 rounded-lg text-sm mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
              {importResult.error}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStage('map')} className="btn-secondary text-sm">← Back</button>
            <button
              onClick={confirmImport}
              className="btn-primary"
              disabled={isPending}
            >
              {isPending ? 'Importing...' : `Import ${rows.length} Students →`}
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE: Done ─────────────────────────────────────────── */}
      {stage === 'done' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Import Complete!
          </h3>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
            {importResult?.inserted ?? 0} students were successfully imported.
          </p>
          <button onClick={onComplete} className="btn-primary">
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
