import React from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { rankWith, isEnumControl, and, schemaTypeIs } from '@jsonforms/core';
import { TextField, MenuItem } from '@mui/material';
import { OptionsContext } from './OptionsContext.jsx';

// Normalize enum option to { const, title } with numeric const when applicable
function toOpt(o) {
    if (typeof o === 'number' && !Number.isNaN(o)) return { const: o, title: String(o) };
    if (typeof o === 'string') {
        const n = Number(o);
        return { const: Number.isNaN(n) ? o : n, title: o };
    }
    return typeof o === 'object' && o !== null && 'const' in o
        ? { ...o, const: typeof o.const === 'string' ? Number(o.const) : o.const }
        : { const: o, title: String(o) };
}

function EnumNumberSelect({ data, handleChange, path, label, visible, enabled, schema }) {
    const { resolve } = React.useContext(OptionsContext);
    const schemaEnum = schema?.oneOf || schema?.enum || [];
    const [opts, setOpts] = React.useState(() => schemaEnum.map(toOpt));

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!resolve) return;
            const out = await resolve({ path, data });
            if (!cancelled && out) {
                setOpts(out.map(toOpt));
            }
        })();
        return () => { cancelled = true; };
    }, [resolve, path, data]);

    if (!visible) return null;

    // Value for the select: HTML select uses string values, so we need a stable string key per option
    const valueForSelect = data != null && data !== '' ? String(data) : '';
    const optionValues = opts.map(o => ({ ...o, valueStr: String(o.const) }));

    return (
        <TextField
            select
            fullWidth
            label={label}
            value={valueForSelect}
            onChange={(e) => {
                const raw = e.target.value;
                const num = Number(raw);
                handleChange(path, raw === '' ? undefined : (Number.isNaN(num) ? raw : num));
            }}
            disabled={!enabled}
            error={false}
            helperText={null}
        >
            {optionValues.map((o, i) => (
                <MenuItem key={`${i}-${o.valueStr}`} value={o.valueStr}>{o.title ?? String(o.const)}</MenuItem>
            ))}
        </TextField>
    );
}

export const enumNumberTester = rankWith(5, and(isEnumControl, schemaTypeIs('number')));
export const EnumNumberSelectRenderer = withJsonFormsControlProps(EnumNumberSelect);
