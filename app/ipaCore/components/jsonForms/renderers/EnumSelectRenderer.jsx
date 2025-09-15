import React from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { rankWith, isEnumControl, and, schemaTypeIs } from '@jsonforms/core';
import { TextField, MenuItem } from '@mui/material';
import { OptionsContext } from './OptionsContext.jsx';

function EnumSelect({ data, handleChange, path, label, visible, enabled, schema }) {
    const { resolve } = React.useContext(OptionsContext);
    const [opts, setOpts] = React.useState(
        (schema?.oneOf || schema?.enum || []).map(o => (typeof o === 'string' ? { const: o, title: o } : o))
    );

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!resolve) return;
            const out = await resolve({ path, data });
            if (!cancelled && out) {
                setOpts(out.map(o => (typeof o === 'string' ? { const: o, title: o } : o)));
            }
        })();
        return () => { cancelled = true; };
    }, [resolve, path, data]);

    if (!visible) return null;
    return (
        <TextField
            select
            fullWidth
            label={label}
            value={data ?? ''}
            onChange={(e) => handleChange(path, e.target.value)}
            disabled={!enabled}
        >
            {opts.map(o => <MenuItem key={o.const} value={o.const}>{o.title ?? o.const}</MenuItem>)}
        </TextField>
    );
}

export const enumTester = rankWith(5, and(isEnumControl, schemaTypeIs('string')));
export const EnumSelectRenderer = withJsonFormsControlProps(EnumSelect);
