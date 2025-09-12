// ValuePresenter.jsx
import React from 'react';
import { useJsonForms } from '@jsonforms/react';
import { composePaths, toDataPath, Resolve } from '@jsonforms/core';
import { Typography, Box } from '@mui/material';
import { OptionsContext } from '../../jsonForms/renderers/OptionsContext.jsx';

// pull "name" from "#/properties/name"
const controlKey = (scope) => scope.match(/#\/properties\/(.+)$/)?.[1] ?? scope;

// simple safe getter for "a.b.c"
const getAt = (obj, path) =>
    !path ? obj : path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// format a primitive/array/boolean nicely
function formatValue({ value, propSchema, enumOptions }) {
    if (value == null || value === '') return '—';

    // prefer title for enums/oneOf
    if (enumOptions?.length) {
        const found = enumOptions.find((o) =>
            typeof o === 'string' ? o === value : o.const === value
        );
        if (found) return typeof found === 'string' ? found : (found.title ?? found.const);
    }
    if (propSchema?.oneOf?.length) {
        const hit = propSchema.oneOf.find((o) => o.const === value);
        if (hit) return hit.title ?? hit.const;
    }

    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    // simple date prettifier if you use JSON Schema formats
    if (propSchema?.format === 'date')   return new Date(value).toLocaleDateString();
    if (propSchema?.format === 'date-time') return new Date(value).toLocaleString();

    return String(value);
}

export default function ValuePresenter({ controlUiSchema, schema, path, labelPlacement = "auto" }) {
    const { core } = useJsonForms(); // current form state
    const { resolve } = React.useContext(OptionsContext) || {};

    const key = controlKey(controlUiSchema.scope);
    const absPath = composePaths(path ?? '', toDataPath(controlUiSchema.scope));

    // look up property schema (handles flat objects; for deep structures, resolve as needed)
    const propSchema = schema?.properties?.[key] ?? {};
    const isRequired =
        Array.isArray(schema?.required) && !schema.required.includes(key);

    const rawValue = Resolve.data(core?.data, absPath);

    // allow external resolver to map enum labels (same API as EnumSelectRenderer)
    const [enumOptions, setEnumOptions] = React.useState(null);
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!resolve) return;
            const out = await resolve({ path: absPath, data: core?.data });
            if (!cancelled && out) setEnumOptions(out);
        })();
        return () => { cancelled = true; };
    }, [resolve, absPath, core?.data]);

    const label =
        controlUiSchema.label ??
        propSchema.title ??
        key;

    const display = formatValue({ value: rawValue, propSchema, enumOptions });

    return (
        <Box display="grid" gridTemplateColumns={`${labelPlacement=="auto" ? '' : '220px '} 1fr`} alignItems="center" columnGap={1}>
            {/* LEFT: fixed label */}
            {labelPlacement=="left" && <Box>
                <Typography variant="body2" fontWeight={600}>
                    {label}
                    {isRequired ? <Typography component="span" color="error">&nbsp;*</Typography> : null}
                </Typography>
            </Box>}
            <Typography variant="caption" color="textSecondary">{label}</Typography>
            <Typography variant="body1">{display}</Typography>
        </Box>
    );
}
