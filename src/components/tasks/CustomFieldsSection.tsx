'use client'
import { useState } from 'react'
import type { TaskFieldDef, TaskFieldValue } from '@/types'
import { FieldDefComposer } from './FieldDefComposer'

interface CustomFieldsSectionProps {
  fieldDefs: TaskFieldDef[]
  values: TaskFieldValue[]
  onSetValue: (fieldDefId: string, value: unknown) => Promise<void>
  onAddField: (name: string, kind: TaskFieldDef['kind'], options?: string[]) => Promise<void>
}

function valueFor(defId: string, values: TaskFieldValue[]): unknown {
  return values.find((v) => v.field_def_id === defId)?.value
}

export function CustomFieldsSection({ fieldDefs, values, onSetValue, onAddField }: CustomFieldsSectionProps) {
  const [composerOpen, setComposerOpen] = useState(false)

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4,
  }
  const fieldStyle: React.CSSProperties = {
    fontSize: 12, color: 'var(--text)', background: 'var(--bg3)',
    border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 8px', width: '100%',
  }

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px',
        fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
        letterSpacing: '.07em', color: 'var(--text3)',
      }}>
        Custom fields
        {!composerOpen && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            style={{
              background: 'none', border: 'none', color: 'var(--amber)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
            }}
          >
            + add field
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {fieldDefs.map((def) => {
          const val = valueFor(def.id, values)
          if (def.kind === 'checkbox') {
            const on = Boolean(val)
            return (
              <div key={def.id}>
                <div style={labelStyle}>{def.name}</div>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSetValue(def.id, !on)}
                  style={{
                    width: 42, height: 24, borderRadius: 13, position: 'relative', cursor: 'pointer',
                    background: on ? 'rgba(245,166,35,.22)' : 'var(--bg3)',
                    border: `1px solid ${on ? 'rgba(245,166,35,.5)' : 'var(--border2)'}`,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: on ? 20 : 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: on ? 'var(--amber)' : 'var(--text3)',
                    transition: 'left .2s ease',
                  }} />
                </button>
              </div>
            )
          }
          if (def.kind === 'single_select') {
            return (
              <div key={def.id}>
                <div style={labelStyle}>{def.name}</div>
                <select
                  value={String(val ?? '')}
                  onChange={(e) => onSetValue(def.id, e.target.value)}
                  style={{ ...fieldStyle, cursor: 'pointer' }}
                >
                  <option value="">—</option>
                  {(def.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )
          }
          return (
            <div key={def.id}>
              <div style={labelStyle}>{def.name}</div>
              <input
                type="text"
                defaultValue={String(val ?? '')}
                onBlur={(e) => onSetValue(def.id, e.target.value)}
                style={fieldStyle}
              />
            </div>
          )
        })}
        {!composerOpen && fieldDefs.length === 0 && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            style={{
              gridColumn: '1 / -1', padding: 12, borderRadius: 10,
              border: '1px dashed var(--border2)', background: 'transparent',
              color: 'var(--text3)', fontSize: 11, cursor: 'pointer',
            }}
          >
            + add field
          </button>
        )}
        {composerOpen && (
          <FieldDefComposer
            onAdd={onAddField}
            onClose={() => setComposerOpen(false)}
          />
        )}
      </div>
    </>
  )
}
