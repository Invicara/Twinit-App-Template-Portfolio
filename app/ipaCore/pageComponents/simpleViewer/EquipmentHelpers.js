function normalizeProperties(arrOrObj) {
  if (!arrOrObj) return {};
  if (Array.isArray(arrOrObj)) {
    return arrOrObj.reduce((acc, { name, val, refVal, ...rest }) => {
      acc[name] = { val, refVal, ...rest };
      return acc;
    }, {});
  }
  return arrOrObj;
}

function normalizeTechParams(arrOrObj) {
  if (!arrOrObj) return {};
  if (Array.isArray(arrOrObj)) {
    return arrOrObj.reduce((acc, { name, val, ...rest }) => {
      acc[name] = { val, ...rest };
      return acc;
    }, {});
  }
  return arrOrObj;
}

export function flattenEquipment(siteEq) {
  const rev = Array.isArray(siteEq.revisions)
    ? siteEq.revisions[0]
    : siteEq.revisions?._list?.[0];

  if (!rev) return {};

  const props = normalizeProperties(rev.properties);
  const tech = normalizeTechParams(rev.TechnicalParameters);

  const flat = {
    equipmentId: siteEq['Site Equipment Id'] || siteEq.equipmentId || '',
    Model: props?.Model?.val || '',
    Manufacturer: props?.Manufacturer?.val || '',
    'Safety Class': props?.['Safety Class']?.val || '',
    equipmentType: siteEq.equipmentType || '',
    properties: props,
    TechnicalParameters: tech,
    revision: rev.revision || '',
    edited: rev.edited || {},
    'revision status': rev['revision status'] || '',
  };

  Object.entries(tech).forEach(([key, val]) => {
    flat[key] = val?.val ?? '';
  });

  return flat;
}

function prettifyLabel(str) {
  if (!str) return str;
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
}

export function buildSchema(flat, editableFields = []) {
  if (!flat) return { type: 'object', properties: {}, required: [] };

  const tech = flat?.TechnicalParameters || {};

  const baseOrder = ['equipmentId','Model','equipmentType','Manufacturer','Safety Class'];
  const techOrder = Object.keys(tech);
  const fullOrder = [...baseOrder, ...techOrder];

  const properties = {};

  // base fields
  baseOrder.forEach((baseKey, idx) => {
    const val = flat[baseKey];
    if (typeof val === 'undefined') return;

    const schema = {
      type: typeof val === 'number' ? 'number' : 'string',
      title:
        baseKey === 'equipmentId' ? 'Name Id' :
        baseKey === 'equipmentType' ? 'Equipment Type' :
        prettifyLabel(baseKey),
      readOnly: !editableFields.includes(baseKey),
      propertyOrder: idx + 1,         
    };

    const propMeta = flat?.properties?.[baseKey];
    if (propMeta) {
      const { refVal, isEdited, originalVal } = propMeta;
      schema.options = { ...(schema.options || {}), refVal, originalVal };
      if (isEdited) schema.isEdited = true;
      if (refVal != null && refVal !== '' && val !== refVal) {
        schema.isMismatched = true;
        schema.displayValue = `${val} (Expected: ${refVal})`;
      }
    }

    properties[baseKey] = schema;
  });

  techOrder.forEach((techKey, idx) => {
    const meta = tech[techKey];
    const val = flat[techKey];
    const schema = {
      type: typeof val === 'number' ? 'number' : 'string',
      title: prettifyLabel(techKey),
      readOnly: !editableFields.includes(techKey),
      propertyOrder: baseOrder.length + idx + 1,  
      options: {
        unit: meta?.unit,
        refVal: meta?.refVal,
        originalVal: meta?.originalVal,
      },
    };

    const hasRef = meta?.refVal != null && meta.refVal !== '';
    const hasVal = val != null && val !== '';
    if (hasRef && hasVal && Number(val) != Number(meta.refVal)) {
      schema.isMismatched = true;
      schema.displayValue = meta?.unit
        ? `${val} ${meta.unit} (Expected: ${meta.refVal} ${meta.unit})`
        : `${val} (Expected: ${meta.refVal})`;
    }
    if (meta?.isEdited) schema.isEdited = true;

    properties[techKey] = schema;
  });

  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
  };
}
