// ValuePresenter.jsx
import React from 'react';
import { useJsonForms } from '@jsonforms/react';
import { composePaths, toDataPath, Resolve } from '@jsonforms/core';
import { Typography, Box } from '@mui/material';
import { OptionsContext } from '../../jsonForms/renderers/OptionsContext.jsx';
import {renderNumberPreview} from "./numberFormat.js";

// pull "name" from "#/properties/name"
const controlKey = (scope) => scope.match(/#\/properties\/(.+)$/)?.[1] ?? scope;

// simple safe getter for "a.b.c"
const getAt = (obj, path) =>
    !path ? obj : path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// format a primitive/array/boolean nicely
function formatValue({ value, propSchema }) {
  if (value == null || value === '') return '—';

  // If this is FlowRate or Power with unit
  if ((propSchema?.title === 'FlowRate' || propSchema?.title === 'Power') && propSchema?.options) {
    const { refVal, unit } = propSchema.options;
    if (refVal !== undefined && value != refVal) {
      return `${value} ${unit} (Expected: ${refVal} ${unit})`;
    }
    return `${value} ${unit}`;
  }

  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

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
        Array.isArray(schema?.required) && schema.required.includes(key);

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
        <Box display="grid" gridTemplateColumns={`${labelPlacement=="auto" ? '' : '33% '} 1fr`} alignItems="center" columnGap={1}>
            {/* LEFT: fixed label */}
            {labelPlacement=="left" && <Box>
                <Typography variant="body2" fontWeight={600}>
                    {label}
                    {isRequired ? <Typography component="span"  color="error">&nbsp;*</Typography> : null}
                </Typography>
            </Box>}
            <Typography variant="caption" color="textSecondary">{label} {isRequired ? <Typography variant="caption"  component="span" color="error">&nbsp;*</Typography> : null}</Typography>
            <Typography variant="body1">{display}</Typography>
        </Box>
    );
}
