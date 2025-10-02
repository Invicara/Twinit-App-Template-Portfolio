import React from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import WarningIcon from '@mui/icons-material/Warning';

const FlowPowerCellRenderer = ({ data, path, handleChange, schema }) => {
  const field = path.split('/').pop();
  const val = data?.[field];
  const refVal = schema?.options?.refVal;
  const unit = schema?.options?.unit;

  console.log('FlowPowerCellRenderer hit!', { field, val, refVal });

  const showAlert = val !== undefined && refVal !== undefined && val != refVal;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        type="number"
        value={val ?? ''}
        onChange={e => handleChange(path, Number(e.target.value))}
        style={{ flex: 1, borderBottom: '1px solid #ccc' }}
      />
      {unit && <span style={{ marginLeft: 4 }}>{unit}</span>}
      {showAlert && (
        <WarningIcon style={{ color: 'orange', marginLeft: 6 }} fontSize="small" />
      )}
    </div>
  );
};

// 👇 very important
export default withJsonFormsControlProps(FlowPowerCellRenderer);