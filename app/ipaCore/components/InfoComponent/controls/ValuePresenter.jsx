// ValuePresenter.jsx
import React from 'react';
import { useJsonForms } from '@jsonforms/react';
import { composePaths, toDataPath, Resolve } from '@jsonforms/core';
import { Typography, Box } from '@mui/material';
import { OptionsContext } from '../../jsonForms/renderers/OptionsContext.jsx';
import {renderNumberPreview} from "./numberFormat.js";

const controlKey = (scope) => scope.match(/#\/properties\/(.+)$/)?.[1] ?? scope;

const getAt = (obj, path) =>
    !path ? obj : path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function formatValue({ value, propSchema }) {
  if (value == null || value === '') return '—';

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

export default function ValuePresenter({ controlUiSchema, schema, path, labelPlacement = "auto", onEvaluate }) {
  const { core } = useJsonForms();
  const { resolve } = React.useContext(OptionsContext) || {};

  const key = controlKey(controlUiSchema.scope);
  const absPath = composePaths(path ?? '', toDataPath(controlUiSchema.scope));

  const propSchema = schema?.properties?.[key] ?? {};
  const isRequired = Array.isArray(schema?.required) && schema.required.includes(key);
  const rawValue = Resolve.data(core?.data, absPath);

  const unit = propSchema?.options?.unit;
  const refVal = propSchema?.options?.refVal;

  let display = formatValue({ value: rawValue, propSchema });
  let isMismatch = false;

if (propSchema?.isEdited) {
  display = String(rawValue);
  isMismatch = false;
}

else if ((key === 'FlowRate' || key === 'Power') && unit) {
  const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isNaN(numeric)) {
    if (refVal !== undefined && numeric != refVal) {
      display = `${numeric} ${unit} (Expected: ${refVal} ${unit})`;
      isMismatch = true;
    } else {
      display = `${numeric} ${unit}`;
    }
  }
}

else if ((key === 'Manufacturer' || key === 'Model') && refVal !== undefined) {
  if (rawValue !== refVal) {
    display = `${rawValue} (Expected: ${refVal})`;
    isMismatch = true;
  } else {
    display = rawValue;
  }
}

  React.useEffect(() => {
    if (onEvaluate) {
      onEvaluate({ isMismatch });
    }
  }, [isMismatch, onEvaluate]);

  const label = controlUiSchema.label ?? propSchema.title ?? key;

  return (
     <Box
      display="grid"
      gridTemplateColumns={
        labelPlacement === 'left' ? '33% 1fr' : '1fr'
      }
      alignItems="center"
      columnGap={1}
    >
      {labelPlacement === 'left' ? (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {label}
            {isRequired && (
              <Typography component="span" color="error">
                &nbsp;*
              </Typography>
            )}
          </Typography>
        </Box>
      ) : (
        <Typography variant="caption" color="textSecondary">
          {label}
          {isRequired && (
            <Typography
              variant="caption"
              component="span"
              color="error"
            >
              &nbsp;*
            </Typography>
          )}
        </Typography>
      )}

      {/* Value */}
      <Typography variant="body1">{display}</Typography>
    </Box>
  );
}


