import React, { useState, useContext, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { Paper, Typography, Button, Divider, CircularProgress } from '@material-ui/core'
import { Edit as EditIcon, Save as SaveIcon, KeyboardArrowUp, KeyboardArrowDown } from '@material-ui/icons'
import { ModelContext } from '../../../contexts/ModelContext'
import { InfoComponent } from '../../../components/InfoComponent/InfoComponent'
import { siteEquipmentService, siteEquipmentForTreeService, rejectPendingRevision, approvePendingRevision } from '../../../../services/siteEquipment';
import AssignmentLateIcon from '@material-ui/icons/AssignmentLate';
import {engineeringChangePendingRevision} from '../../../../services/engineeringChangesAPI'


const useStyles = makeStyles((theme) => ({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 360,
    right: 0,
    backgroundColor: '#fff',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'height 0.3s ease',
  },
  handle: {
    height: 32,
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: theme.spacing(6),
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflowX: 'auto',
    display: 'flex',
    padding: theme.spacing(2),
  },
  card: {
    minWidth: 500,
    maxHeight: 460,
    marginRight: theme.spacing(2),
    padding: theme.spacing(3),
    border: '1px solid #eee',
    borderRadius: 8,
    flexShrink: 0,
    overflowY: 'auto',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  property: {
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(1),
    borderBottom: '1px solid #eee',
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: 400,
    color: theme.palette.text.primary,
  },
  input: {
    width: '100%',
    fontSize: 14,
    padding: theme.spacing(1),
    border: '1px solid #ccc',
    borderRadius: 4,
    outline: 'none',
  },
  editButton: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    textTransform: 'none',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  valueInput: {
    width: '100%',
    fontSize: 14,
    fontWeight: 400,
    color: '#333',
    border: 'none',
    outline: 'none',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    borderBottom: '1px solid #ccc',
    lineHeight: '1.6',
},
 loaderWrapper: {
    position: 'absolute', 
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    padding: theme.spacing(2),
  },
}))


const equipment = {
  _id: "68d64f9771aa127e59875140",
  equipmentId: "RCP-900-014",
  properties: {
    Manufacturer: { val: "Westinghouse", type: "string" },
    Model: { val: "RCP-900", type: "string" },
    "Safety Class": { val: "Class 1", type: "string" },
  },
  TechnicalParameters: {
    FlowRate: { val: 2100, type: "number", unit: "gpm" },
    Power: { val: 10, type: "number", unit: "MW" },
  },
};

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

// function flattenEquipment(e) {
//   const props = normalizeProperties(e.properties);
//   const tech = normalizeTechParams(e.TechnicalParameters);

//   return {
//     _id: e._id,
//     equipmentId: e.equipmentId,
//     siteEquipmentId: e.siteEquipmentId,
//     equipmentType: e.equipmentType,
//     revision: e.revision,
//     Manufacturer: props?.Manufacturer?.val || '',
//     Model: props?.Model?.val || '',
//     'Safety Class': props?.['Safety Class']?.val || '',
//     'Operating Status': props?.['Operating Status']?.val || '',
//     'Operational Status Date': props?.['Operational Status Date']?.val || '',
//     FlowRate: tech?.FlowRate?.val || '',
//     Power: tech?.Power?.val || '',
//   };
// }

function flattenEquipment(siteEq) {
  const rev = Array.isArray(siteEq.revisions)
    ? siteEq.revisions[0]
    : siteEq.revisions?._list?.[0];

  if (!rev) return {};

  // 🔹 Merge in any edits first
  const mergedRev = rev;

  const props = normalizeProperties(mergedRev.properties);
  const tech = normalizeTechParams(mergedRev.TechnicalParameters);

  return {
    equipmentId: siteEq['Site Equipment Id'] || siteEq.equipmentId || '',
    Model: props?.Model?.val || '',
    Manufacturer: props?.Manufacturer?.val || '',
    'Safety Class': props?.['Safety Class']?.val || '',
    equipmentType: siteEq.equipmentType || '',
    FlowRate: tech?.FlowRate?.val ?? '',
    Power: tech?.Power?.val ?? '',
    TechnicalParameters: tech,
    properties: props,
    revision: mergedRev.revision || '',
    edited: mergedRev.edited || {},
    'revision status': mergedRev['revision status'] || '',
  };
}

const equipmentSchema = {
  type: 'object',
  properties: {
    equipmentId: { type: 'string', title: 'Name id' },   // custom label
    Model: { type: 'string', title: 'Model' },
    equipmentType: { type: 'string', title: 'Equipment Type' },
    Manufacturer: { type: 'string', title: 'Manufacturer' },
    'Safety Class': { type: 'string', title: 'Safety Class' },
    FlowRate: { type: 'string', title: 'Flow Rate' },
    Power: { type: 'string', title: 'Power' },
  },
  required: ['equipmentId', 'Model', 'equipmentType', 'Manufacturer', 'Safety Class', 'FlowRate', 'Power'],
};

function buildSchema(flat, editableFields = []) {
  const allowedOrder = [
    'equipmentId',
    'Model',
    'equipmentType',
    'Manufacturer',
    'Safety Class',
    'FlowRate',
    'Power'
  ];

  const properties = allowedOrder.reduce((acc, key) => {
    if (!(key in flat)) return acc;

    const isEditable = editableFields.includes(key);
    const rawVal = flat[key];

    const schema = {
      type: typeof rawVal === 'number' ? 'number' : 'string',
      title: key,
      readOnly: !isEditable,
    };

    // 🔹 Merge both TechnicalParameters + properties metadata
    const techMeta = flat.TechnicalParameters?.[key];
    const propMeta = flat.properties?.[key];

    if (techMeta) {
      const { refVal, unit, isEdited, originalVal } = techMeta;
      schema.options = { ...(schema.options || {}), refVal, unit, originalVal };
      if (refVal !== undefined && rawVal != refVal) {
        schema.isMismatched = true;
        schema.displayValue = unit
          ? `${rawVal} ${unit} (Expected: ${refVal} ${unit})`
          : `${rawVal} (Expected: ${refVal})`;
      }
      if (isEdited) schema.isEdited = true;
    }

   if (propMeta) {
  const { refVal, isEdited, originalVal } = propMeta;
  schema.options = { ...(schema.options || {}), refVal, originalVal };

  if (isEdited) {
    schema.isEdited = true;
    schema.displayValue = rawVal;  // show only current value, hide Expected text
  } else if (refVal !== undefined && rawVal !== refVal) {
    schema.isMismatched = true;
    schema.displayValue = `${rawVal} (Expected: ${refVal})`;
  }
}

    acc[key] = schema;
    return acc;
  }, {});

  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
  };
}

const ViewerBottomPanel = ({ isBottomECPanelOpen, items }) => {

  const classes = useStyles()
  const { sliceElements, siteEquipment, selectedModelComposite } = useContext(ModelContext)
  const [isOpen, setIsOpen] = useState(false)
  const [properties, setProperties] = useState([])
  const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false)

  function extractEquipmentIds(siteEquipmentArray) {
  return siteEquipmentArray.map(item => ({
    'Equipment Id': item['Equipment Id']
  }));
}

   useEffect(() => {

    if(siteEquipment && siteEquipment?.data?.length > 0) {
        const facilityId = siteEquipment?.data[0]?.site;
        const EC = siteEquipment.EC;
        const buildingId = siteEquipment?.data[0]?.unit;
        const equipmentId = siteEquipment?.data[0]?.['Equipment Id'];

        const equipmentIdArray = extractEquipmentIds(siteEquipment?.data);
        const run = async () => {
        try {
          setLoading(true); 

          if(Object.keys(EC).length > 0) {
            const items = await siteEquipmentService(EC, facilityId, buildingId, equipmentId);
            setProperties(items.map((el) => ({ ...flattenEquipment(el), isEditing: false })));
            setData(items);
          } else {
            
            const modelName = selectedModelComposite?._name || '';
            const match = modelName.match(/^Facility-([A-Z]+)_Unit-(\d{2})$/i);
            const facilityId = match ? match[1].toUpperCase() : null;
            const buildingId = match ? match[2] : null;
            const siteEqItems = await siteEquipmentForTreeService(facilityId, buildingId, siteEquipment?.data);
            setProperties(siteEqItems.map((el) => ({ ...flattenEquipment(el), isEditing: false })));
            setData(siteEqItems);
          }
        } finally {
          setLoading(false); 
        }
      }

        run();
    }
  }, [siteEquipment])

  const handleInfoChange = (value, fieldName, meta) => {
    const updatedFlat = { ...flat, [fieldName]: value };
    const expanded = expandEquipment(updatedFlat, equipment);
    onChange?.(expanded);
  };


  useEffect(() => {
    if (isBottomECPanelOpen) setIsOpen(true)
  }, [isBottomECPanelOpen])

//   const toggleEdit = (index) => {
//     const facilityId = siteEquipment?.data[0]?.site;
//     const buildingId = siteEquipment?.data[0]?.unit;
//     const siteEquipmentId = siteEquipment?.data[0]?.['Equipment Id'];
//     const userName = siteEquipment?.data[0]?.username;

//     setProperties(prev =>
//       prev.map((p, i) => {
//         if (i !== index) return p;

//         if (p.isEditing) {
//                 console.log('EC edited', p.properties);
//           const updateObject = {
//             facility: facilityId, 
//             unit: buildingId,
//             equipmentId: siteEquipmentId,
//             siteEquipmentId: p.equipmentId,
//             properties: p.properties,
//             TechnicalParameters: p.TechnicalParameters,
//             username: userName
//           }
//           //engineeringChangePendingRevision(updateObject)
//         }

//         return { ...p, isEditing: !p.isEditing };
//       })
//   );
// };


// const toggleEdit = (index) => {
//   setProperties(prev =>
//     prev.map((p, i) => {
//       if (i !== index) return p;

//       if (p.isEditing) {
//         // merge drafts into the actual properties on Save
//         const draft = drafts[index] || {};
//         const updated = { ...p };

//         Object.entries(draft).forEach(([field, val]) => {
//           if (['FlowRate', 'Power'].includes(field)) {
//             updated.TechnicalParameters = {
//               ...updated.TechnicalParameters,
//               [field]: {
//                 ...updated.TechnicalParameters?.[field],
//                 val
//               }
//             };
//           } else {
//             updated.properties = {
//               ...updated.properties,
//               [field]: {
//                 ...updated.properties?.[field],
//                 val
//               }
//             };
//           }
//         });

     
//      //  engineeringChangePendingRevision(updated)
//       }

//       return { ...p, isEditing: !p.isEditing };
//     })
//   );


//   setDrafts(prev => {
//     const newDrafts = { ...prev };
//     delete newDrafts[index];
//     return newDrafts;
//   });
// };

const handleDraftChange = (index, name, value) => {
  setDrafts(prev => ({
    ...prev,
    [index]: {
      ...(prev[index] || {}),
      [name]: value
    }
  }));
};

// on Save toggle
const toggleEdit = (index) => {
  setProperties(prev =>
    prev.map((p, i) => {
      if (i !== index) return p;

      if (p.isEditing) {
        // merge draft values into real properties
        const draft = drafts[index] || {};
        const updated = { ...p };

        Object.entries(draft).forEach(([field, val]) => {
          if (['FlowRate', 'Power'].includes(field)) {
            updated.TechnicalParameters = {
              ...updated.TechnicalParameters,
              [field]: {
                ...updated.TechnicalParameters?.[field],
                val
              }
            };
          } else {
            updated.properties = {
              ...updated.properties,
              [field]: {
                ...updated.properties?.[field],
                val
              }
            };
          }
        });

        console.log('Saving edits', updated);
        return { ...updated, isEditing: false };
      }

      return { ...p, isEditing: true };
    })
  );

  // clear draft for this row after save
  setDrafts(prev => {
    const copy = { ...prev };
    delete copy[index];
    return copy;
  });
};

const handleSave = async (index, draft) => {
  const facilityId = siteEquipment?.data[0]?.site;
  const buildingId = siteEquipment?.data[0]?.unit;
  const siteEquipmentId = siteEquipment?.data[0]?.['Equipment Id'];
  const userName = siteEquipment?.data[0]?.username;

  const updateObject = {
    facility: facilityId,
    unit: buildingId,
    equipmentId: siteEquipmentId,
    siteEquipmentId: draft.equipmentId,
    properties: draft.properties,
    TechnicalParameters: draft.TechnicalParameters,
    username: userName,
  };

  try {
    setLoading(true);
    await engineeringChangePendingRevision(updateObject);

    // 🔹 only reload after saving
    if (siteEquipment?.EC && Object.keys(siteEquipment.EC).length > 0) {
      const refreshed = await siteEquipmentService(siteEquipment.EC, facilityId, buildingId, draft.equipmentId);
      setProperties(refreshed.map(el => ({ ...flattenEquipment(el), isEditing: false })));
      setData(refreshed);
    } else {
      const modelName = selectedModelComposite?._name || '';
      const match = modelName.match(/^Facility-([A-Z]+)_Unit-(\d{2})$/i);
      const fac = match ? match[1].toUpperCase() : null;
      const bld = match ? match[2] : null;
      const refreshed = await siteEquipmentForTreeService(fac, bld, siteEquipment?.data);
      setProperties(refreshed.map(el => ({ ...flattenEquipment(el), isEditing: false })));
      setData(refreshed);
    }
  } finally {
    setLoading(false);
  }
};

// keep your existing toggleEdit but don’t call the API here anymore
const onToggleEdit = (idx) => {
  setProperties(prev =>
    prev.map((p, i) => (i === idx ? { ...p, isEditing: !p.isEditing } : p))
  );
};


 const setDeepValue = (obj, path, value) => {
  const keys = path.split('.')
  const newObj = { ...obj }
  let cur = newObj
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      cur[k] = value
    } else {
      cur[k] = { ...cur[k] }
      cur = cur[k]
    }
  })
  return newObj
}

const [drafts, setDrafts] = useState({}); 


const handleReject = async (item) => {


  const modelName = selectedModelComposite?._name || '';
  const match = modelName.match(/^Facility-([A-Z]+)_Unit-(\d{2})$/i);
  const facilityId = match ? match[1].toUpperCase() : null;
  const buildingId = match ? match[2] : null;

  try {
    setLoading(true);

    const res = await rejectPendingRevision(facilityId, buildingId, item.equipmentId, item.revision);
  

    if (res.success) {
  console.log('Reject success:', res);
      if (siteEquipment?.EC && Object.keys(siteEquipment.EC).length > 0) {
        // EC mode
        const refreshed = await siteEquipmentService(
          siteEquipment.EC,
          facilityId,
          buildingId,
          item.equipmentId
        );
        setProperties(refreshed.map(el => ({ ...flattenEquipment(el), isEditing: false })));
        setData(refreshed);
      } else {

        const refreshed = await siteEquipmentForTreeService(
          facilityId,
          buildingId,
          siteEquipment?.data
        );
        setProperties(refreshed.map(el => ({ ...flattenEquipment(el), isEditing: false })));
        setData(refreshed);
      }
    } else {
      console.error('Reject failed:', res.message);
    }
  } catch (err) {
    console.error('Reject failed:', err);
  } finally {
    setLoading(false);
  }
};

const handleApprove = async (item) => {
  const modelName = selectedModelComposite?._name || '';
  const match = modelName.match(/^Facility-([A-Z]+)_Unit-(\d{2})$/i);
  const facilityId = match ? match[1].toUpperCase() : null;
  const buildingId = match ? match[2] : null;

  try {
    setLoading(true);

    let username = 'Bob';
     const res = await approvePendingRevision(item.revision, facilityId, buildingId, item.equipmentId, username);

    if (res.success) {
      // same refresh logic as reject
      if (siteEquipment?.EC && Object.keys(siteEquipment.EC).length > 0) {
        const refreshed = await siteEquipmentService(
          siteEquipment.EC,
          facilityId,
          buildingId,
          item.equipmentId
        );
        setProperties(refreshed.map(el => ({ ...flattenEquipment(el), isEditing: false })));
        setData(refreshed);
      } else {
        const refreshed = await siteEquipmentForTreeService(
          facilityId,
          buildingId,
          siteEquipment?.data
        );
        setProperties(refreshed.map(el => ({ ...flattenEquipment(el), isEditing: false })));
        setData(refreshed);
      }
    } else {
      console.error('Approve failed:', res.message);
    }
  } catch (err) {
    console.error('Approve failed:', err);
  } finally {
    setLoading(false);
  }
};

const handleChange = (index, name, value) => {
  setProperties((prev) =>
    prev.map((p, i) => {
      if (i !== index) return p

      // Copy the original object
      let updated = { ...p, [name]: value }

      if (['FlowRate', 'Power'].includes(name)) {
        // Update only TechnicalParameters for numeric fields
        updated = {
          ...updated,
          TechnicalParameters: {
            ...p.TechnicalParameters,
            [name]: {
              ...p.TechnicalParameters?.[name],
              val: value,
            },
          },
        }
      } else {
        // Update all other editable fields in properties
        updated = {
          ...updated,
          properties: {
            ...p.properties,
            [name]: {
              ...p.properties?.[name],
              val: value,
            },
          },
        }
      }
      return updated;
    })
  )
}


  if (!isBottomECPanelOpen) return null

  return (
    <div className={classes.panel} style={{ height: isOpen ? 350 : 32 }}>
      <div className={classes.handle} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <KeyboardArrowDown /> : <KeyboardArrowUp />}
      </div>

      {isOpen && (
  <div className={classes.content}>
     {loading ? (
              <div className={classes.loaderWrapper}>
        <CircularProgress size={48} color="primary" />
      </div>
          ) : properties && properties.length > 0 ? (
      properties.map((prop, index) => {

       
          const editRequests = countEdits(prop.edited);
            const hasEdits = editRequests > 0;

            const showEditRequests =
            prop.revision?.endsWith('A') &&
            prop['revision status'] === 'PENDING';

    const editableFields = prop.isEditing
      ? ['Manufacturer', 'Model', 'FlowRate', 'Power']
      : [];

        //ADD to test mismatches

//      const testProp = {
//   ...prop,
//   Manufacturer: prop.Manufacturer, 
//   Model: prop.Model,
//   TechnicalParameters: {
//     ...prop.TechnicalParameters,
//     FlowRate: {
//       ...prop.TechnicalParameters?.FlowRate,
//       refVal: 104   // force mismatch for testing
//     },
//     Power: {
//       ...prop.TechnicalParameters?.Power,
//       refVal: prop.TechnicalParameters?.Power?.val
//     }
//   },
//   // Add refVals for Manufacturer and Model
//   properties: {
//     ...prop.properties,
//     Manufacturer: {
//       ...prop.properties?.Manufacturer,
//       refVal: 'SomeOtherManufacturer' // force mismatch
//     },
//     Model: {
//       ...prop.properties?.Model,
//       refVal: 'DifferentModel' // force mismatch
//     }
//   }
// };


   const dynamicSchema = buildSchema(prop, editableFields);

        return (
            <EquipmentCard
      key={`${prop.equipmentId}-${prop.revision}-${index}`}
      classes={classes}
      item={prop}
      index={index}
      onSave={handleSave}
      onToggleEdit={onToggleEdit}
      onApprove={handleApprove}
      onReject={handleReject}
    />
        )
      })
    ) : (
      <Typography variant='body2' color='textSecondary'>
        No engineering change data available
      </Typography>
    )}
  </div>
)}
    </div>
  )
}

export default ViewerBottomPanel

function Property({ label, value, editable, onChange }) {
  const classes = useStyles()
  return (
    <div className={classes.property}>
      <Typography className={classes.label}>{label}</Typography>
      {editable ? (
        <input
          type='text'
          className={classes.valueInput}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Typography className={classes.value}>{value || '-'}</Typography>
      )}
    </div>
  )
}

function UnitInput({ value, unit, onChange, disabled }) {
  const handleChange = (e) => {
    // only update the number, keep the unit
    const num = e.target.value.replace(/[^\d.]/g, ''); // allow only numbers + decimal
    onChange(num ? `${num} ${unit}` : '');
  };

  // split number from unit for display
  const [numVal] = value ? value.split(' ') : [''];

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        type="text"
        value={numVal}
        disabled={disabled}
        onChange={handleChange}
        style={{
          flex: 1,
          border: 'none',
          borderBottom: '1px solid #ccc',
          padding: '4px',
          outline: 'none',
        }}
      />
      <span style={{ marginLeft: 4 }}>{unit}</span>
    </div>
  );
}


function countEdits(edited) {
  if (!edited) return 0;
  return Object.values(edited).reduce((count, val) => {
    if (Array.isArray(val)) {
      return count + val.length;
    }
    return count + 1;
  }, 0);
}



function EquipmentCard({
  classes,
  item,         
  index,
  onSave,         
  onToggleEdit,  
  onApprove,      
  onReject,        
}) {
  const [draft, setDraft] = React.useState(item);
  const wasEditingRef = React.useRef(item.isEditing);

  React.useEffect(() => {
    if (!wasEditingRef.current && item.isEditing) {
      setDraft(item);
    }
    wasEditingRef.current = item.isEditing;
  }, [item.isEditing, item]); 

  const editableFields = item.isEditing
    ? ['Manufacturer', 'Model', 'FlowRate', 'Power']
    : [];

  const dynamicSchema = React.useMemo(
    () => buildSchema(item, editableFields),
    [item, item.isEditing] 
  );

  const handleLocalChange = (val, name) => {
    setDraft(prev => {
      let next = { ...prev, [name]: val };

      if (['FlowRate', 'Power'].includes(name)) {
        next = {
          ...next,
          TechnicalParameters: {
            ...prev.TechnicalParameters,
            [name]: {
              ...prev.TechnicalParameters?.[name],
              val,
            },
          },
        };
      } else {
        next = {
          ...next,
          properties: {
            ...prev.properties,
            [name]: {
              ...prev.properties?.[name],
              val,
            },
          },
        };
      }
      return next;
    });
  };

  const editRequests = countEdits(item.edited);
  const hasEdits = editRequests > 0;
  const showEditRequests =
    item.revision?.endsWith('A') && item['revision status'] === 'PENDING';

const handleEditClick = async () => {
  if (item.isEditing) {
    const hasChanges =
      JSON.stringify(item.properties) !== JSON.stringify(draft.properties) ||
      JSON.stringify(item.TechnicalParameters) !== JSON.stringify(draft.TechnicalParameters);

    if (hasChanges) {
      await onSave(index, draft);
    } else {
      console.log('No changes detected, skipping save');
      onToggleEdit(index); 
    }
  } else {
    onToggleEdit(index);
  }
};

  return (
    <Paper key={item._id || index} className={classes.card}>
      <div className={classes.headerRow}>
        <Typography variant='subtitle1' style={{ fontWeight: 'bold' }}>
          Current Properties: {item.siteEquipmentId || item.equipmentId} ({item.revision})
        </Typography>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            className={classes.editButton}
            size="small"
            startIcon={item.isEditing ? <SaveIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            onClick={handleEditClick}
            style={{ padding: '6px 14px', minHeight: 34, fontSize: '0.85rem', marginLeft: '4px' }}
          >
            {item.isEditing ? 'Save' : 'Edit'}
          </Button>

          {hasEdits && showEditRequests && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#e6f0fa',
                padding: '3px 8px',
                borderRadius: 6,
                height: 28,
              }}
            >
              <Typography
                style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1976d2', marginRight: 8, lineHeight: 1.2 }}
              >
                Edit Requests ({editRequests})
              </Typography>

              <Typography
                style={{ fontSize: '0.8rem', color: '#1976d2', cursor: 'pointer', marginRight: 6, lineHeight: 1.2 }}
                onClick={() => onReject(item)}
              >
                Reject
              </Typography>

              <Divider orientation="vertical" flexItem style={{ margin: '0 6px', height: 16 }} />

              <Typography
                style={{ fontSize: '0.8rem', color: '#1976d2', cursor: 'pointer', marginRight: 6, lineHeight: 1.2 }}
                onClick={() => onApprove(item)}
              >
                Approve
              </Typography>

              <AssignmentLateIcon style={{ color: '#1976d2', fontSize: 18 }} />
            </div>
          )}
        </div>
      </div>

      <InfoComponent
        entity={item.isEditing ? draft : item}       // <- use draft while editing
        type={dynamicSchema}
        entityType="equipment"
        hidePropertyActions={true}
        disabled={!item.isEditing}
        handleChange={handleLocalChange}
      />
    </Paper>
  );
}