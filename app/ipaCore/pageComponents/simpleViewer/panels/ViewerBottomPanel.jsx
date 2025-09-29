import React, { useState, useContext, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { Paper, Typography, Button, Divider } from '@material-ui/core'
import { Edit as EditIcon, Save as SaveIcon, KeyboardArrowUp, KeyboardArrowDown } from '@material-ui/icons'
import { ModelContext } from '../../../contexts/ModelContext'
import { InfoComponent } from '../../../components/InfoComponent/InfoComponent'

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

function flattenEquipment(e) {
    return {
    _id: e._id,
    equipmentId: e.equipmentId,
    siteEquipmentId: e.siteEquipmentId,
    equipmentType: e.equipmentType,
    revision: e.revision,
    Manufacturer: e.properties?.Manufacturer?.val || '',
    Model: e.properties?.Model?.val || '',
    'Safety Class': e.properties?.['Safety Class']?.val || '',
    'Operating Status': e.properties?.['Operating Status']?.val || '',
    'Operational Status Date': e.properties?.['Operational Status Date']?.val || '',
    FlowRate: e.TechnicalParameters?.FlowRate?.val || '',
    Power: e.TechnicalParameters?.Power?.val || '',
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
const ViewerBottomPanel = ({ isBottomECPanelOpen=true, items }) => {
  const classes = useStyles()
  const { sliceElements } = useContext(ModelContext)
  const [isOpen, setIsOpen] = useState(false)
  const [properties, setProperties] = useState([])

  const flattened = items?.map(flattenEquipment);

  useEffect(() => {
    if (items) {
      setProperties(items.map((el) => ({ ...el, isEditing: false })))
    }
  }, [items])

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
    <div className={classes.panel} style={{ height: isOpen ? 427 : 32 }}>
      <div className={classes.handle} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <KeyboardArrowDown /> : <KeyboardArrowUp />}
      </div>

      {isOpen && (
  <div className={classes.content}>
    {properties && properties.length > 0 ? (
      properties.map((prop, index) => {
        const flat = flattenEquipment(prop) // ✅ flatten each prop here

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
              entity={flat}                 // ✅ per-card flattened entity
              type={equipmentSchema}        // ✅ schema matches fields
              entityType="equipment"
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
