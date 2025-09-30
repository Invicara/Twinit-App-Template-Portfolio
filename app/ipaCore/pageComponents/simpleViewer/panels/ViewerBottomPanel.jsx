import React, { useState, useContext, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { Paper, Typography, Button, Divider } from '@material-ui/core'
import { Edit as EditIcon, Save as SaveIcon, KeyboardArrowUp, KeyboardArrowDown } from '@material-ui/icons'
import { ModelContext } from '../../../contexts/ModelContext'
import { InfoComponent } from '../../../components/InfoComponent/InfoComponent'
import { siteEquipmentService } from '../../../../services/siteEquipment';

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
    paddingRight: theme.spacing(4),
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
    return arrOrObj.reduce((acc, { name, val, ...rest }) => {
      acc[name] = { val, ...rest };
      return acc;
    }, {});
  }
  return arrOrObj; // already in old object format
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

function flattenEquipment(e) {
  const props = normalizeProperties(e.properties);
  const tech = normalizeTechParams(e.TechnicalParameters);

  return {
    _id: e._id,
    equipmentId: e.equipmentId,
    siteEquipmentId: e.siteEquipmentId,
    equipmentType: e.equipmentType,
    revision: e.revision,
    Manufacturer: props?.Manufacturer?.val || '',
    Model: props?.Model?.val || '',
    'Safety Class': props?.['Safety Class']?.val || '',
    'Operating Status': props?.['Operating Status']?.val || '',
    'Operational Status Date': props?.['Operational Status Date']?.val || '',
    FlowRate: tech?.FlowRate?.val || '',
    Power: tech?.Power?.val || '',
  };
}
const equipmentSchema = {
  type: 'object',
  properties: {
    equipmentId: { type: 'string', title: 'Equipment ID' },
    Manufacturer: { type: 'string', title: 'Manufacturer' },
    Model: { type: 'string', title: 'Model' },
    'Safety Class': { type: 'string', title: 'Safety Class' },
    FlowRate: { type: 'number', title: 'Flow Rate' },
    Power: { type: 'number', title: 'Power' },
  },
};

function buildSchema(flat, editableFields = []) {
  const properties = Object.keys(flat).reduce((acc, key) => {
    if (['_id', 'siteEquipmentId', 'equipmentType'].includes(key)) {
      return acc; // skip metadata
    }

    acc[key] = {
      type: typeof flat[key] === 'number' ? 'number' : 'string',
      title: key.replace(/([A-Z])/g, ' $1').trim(),
      readOnly: !editableFields.includes(key),
    };

    return acc;
  }, {});

  return {
    type: 'object',
    properties,
    required: Object.keys(properties), // mark all included fields as required
  };
}

const ViewerBottomPanel = ({ isBottomECPanelOpen=true, items }) => {
  const classes = useStyles()
  const { sliceElements, siteEquipment } = useContext(ModelContext)
  const [isOpen, setIsOpen] = useState(false)
  const [properties, setProperties] = useState([])
  const [data, setData] = useState(null);

  const flattened = items?.map(flattenEquipment);

  useEffect(() => {
    if (items) {
    //   setProperties(items.map((el) => ({ ...el, isEditing: false })))
    }
  }, [items])

   useEffect(() => {

    if(siteEquipment && siteEquipment?.data?.length > 0) {
        const facilityId = siteEquipment.data[0]?.site;
        const EC = siteEquipment.ec;
        const buildingId = siteEquipment.data[0]?.unit;
        const equipmentId = siteEquipment.data[0]?.['Equipment Id'];

        const run = async () => {
            const siteEqResponse = await siteEquipmentService(EC, facilityId, buildingId, equipmentId);
           // const  flattenSiteEq = flattenEquipment(siteEq?.revisions?._list);
            const revisions = siteEqResponse?.revisions?._list;
            console.log('EC9 revisions', JSON.stringify(revisions));
            setProperties(revisions.map((el) => ({ ...el, isEditing: false })));
            setData(siteEqResponse?.revisions?._list);
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

  const toggleEdit = (index) => {
    setProperties((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, isEditing: !p.isEditing } : p
      )
    )
  }

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

const handleChange = (index, path, value) => {
  setProperties((prev) =>
    prev.map((p, i) =>
      i === index ? setDeepValue(p, path, value) : p
    )
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
    {properties && properties.length > 0 ? (
      properties.map((prop, index) => {

        const flat = flattenEquipment(prop);
        console.log('EC8 flat', flat);

        const editableFields = prop.isEditing
            ? ['Manufacturer', 'Model', 'FlowRate', 'Power']
            : [];

        const dynamicSchema = buildSchema(flat, editableFields);

        return (
          <Paper key={prop._id || index} className={classes.card}>
            <div className={classes.headerRow}>
              <Typography variant='subtitle1' style={{ fontWeight: 'bold' }}>
                Current Properties: {prop.siteEquipmentId || prop.equipmentId} ({prop.revision})
              </Typography>
              <Button
                className={classes.editButton}
                startIcon={prop.isEditing ? <SaveIcon /> : <EditIcon />}
                onClick={() => toggleEdit(index)}
              >
                {prop.isEditing ? 'Save' : 'Edit'}
              </Button>
            </div>

            <InfoComponent
              entity={flat}               
              type={dynamicSchema}   // use dynamic schema instead of fixed one
              entityType="equipment"
              hidePropertyActions={true}
              disabled={!prop.isEditing} 
              handleChange={(val, name) =>
                console.log('changed', prop._id, name, val)
              }
            />
          </Paper>
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
