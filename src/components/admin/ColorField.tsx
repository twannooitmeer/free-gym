'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'

/**
 * Custom Payload admin field for the SessionType "color" attribute.
 *
 * Replaces the bare hex text input with a native `<input type="color">`
 * picker, plus a synced hex text field so admins can also paste an exact
 * brand color. Stored value stays a `#rrggbb` string so the schedule grid
 * can drop it straight into the `border-color` style.
 */
export const ColorField: TextFieldClientComponent = ({ field, path }) => {
  const fieldPath = path ?? field.name
  const { value, setValue } = useField<string>({ path: fieldPath })
  const current = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#dc2626'

  return (
    <div className="field-type text">
      <FieldLabel
        htmlFor={`field-${fieldPath}`}
        label={field.label || field.name}
        required={field.required}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input
          type="color"
          aria-label="Color picker"
          value={current}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: '40px',
            height: '40px',
            padding: 0,
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 'var(--style-radius-s)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
        <input
          id={`field-${fieldPath}`}
          type="text"
          inputMode="text"
          placeholder="#dc2626"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setValue(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      {field.admin?.description && typeof field.admin.description === 'string' && (
        <div className="field-description">{field.admin.description}</div>
      )}
    </div>
  )
}
