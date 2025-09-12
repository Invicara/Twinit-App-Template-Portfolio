import React, { useEffect, useMemo, useRef, useState } from "react";
import { toTitleCase } from "../../../services/utils";
import { 
    Divider, Grid, TextField, Tooltip, Typography, IconButton, makeStyles, Select, MenuItem, FormControl,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControlLabel, Checkbox,
    InputLabel
} from "@material-ui/core";
import { CancelOutlined, EditOutlined, InfoOutlined, DeleteForeverOutlined, SettingsOutlined } from "@material-ui/icons";
import { useDebounce } from "../../hooks/useDebounce";
import _ from "lodash";


const useStyles = makeStyles(() => ({
    iconButton: {
        fontSize: 16
    },
    title: {
        whiteSpace: 'normal'
    },
    input: {
        marginTop: 5,
        '& .MuiInputBase-input': {
            fontSize: 16,
            color: 'grey',
        }
    },
    inputEdit: {
        marginTop: 5,
        '& .MuiInputBase-input': {
            borderRadius: 4,
            padding: 8,
            fontSize: 16,
            border: `1px solid #999999`,
        }
    },
    selectInput: {
        marginTop: 5,
        '& .MuiSelect-select': {
            fontSize: 16,
            color: 'grey',
        }
    },
    selectInputEdit: {
        marginTop: 5,
        '& .MuiSelect-select': {
            borderRadius: 4,
            padding: 8,
            fontSize: 16,
            border: `1px solid #999999`,
        }
    },
}));

export const InfoComponent = ({ entity, handleChange, type, entityType, originalEntity, disabled = false, onFieldRemove, modifyTypeCallback, debounceTime=700 }) => {

    const [openEdit, setIsEdit] = useState(false);
    
    // Modal states
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [modifyModalOpen, setModifyModalOpen] = useState(false);
    const [currentField, setCurrentField] = useState(null);
    const [modifyForm, setModifyForm] = useState({
        key: '',
        title: '',
        description: '',
        type: 'string',
        enum: '',
        format: '',
        readOnly: false
    });
    
    const [localValue, setLocalValue] = useState(entity || {});
    const classes = useStyles();

    // Reset localValue when disabled becomes true (end of editing)
    useEffect(() => {
        if (disabled && originalEntity) {
            console.log("Resetting localValue due to disabled prop change", { originalEntity, currentLocalValue: localValue });
            setLocalValue(originalEntity);
            // Also close any open edit fields
            setIsEdit(false);
        }
    }, [disabled, originalEntity])

    // Helper functions for JSON Schema
    const isRequired = (fieldName) => {
        return type?.required?.includes(fieldName) || false;
    };

    const isKeyEditable = (fieldName) => {
        return !isRequired(fieldName);
    };

    const isDeletable = (fieldName) => {
        return !isRequired(fieldName);
    };

    const getFieldProperties = () => {
        if (!type?.properties) return [];
        
        // Sort properties by propertyOrder if available, otherwise alphabetically
        return Object.entries(type.properties).sort(([aKey, aValue], [bKey, bValue]) => {
            const aOrder = aValue.propertyOrder || 999;
            const bOrder = bValue.propertyOrder || 999;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return aKey.localeCompare(bKey);
        });
    };

    const handleUpdate = (newValue, name) => {
        setLocalValue({ ...localValue, [name]: newValue });
        
        // Call the onChange handler with the new value
        handleChange && handleChange(newValue, name, { name, entityType, entity, originalEntity });
    };



    // Modal handlers
    const handleOpenDeleteModal = (fieldName) => {
        setCurrentField(fieldName);
        setDeleteModalOpen(true);
    };

    const handleOpenModifyModal = (fieldName) => {
        const fieldSchema = type.properties[fieldName];
        setCurrentField(fieldName);
        setModifyForm({
            key: fieldName,
            title: fieldSchema.title || fieldName,
            description: fieldSchema.description || '',
            type: fieldSchema.type || 'string',
            enum: Array.isArray(fieldSchema.enum) ? fieldSchema.enum.join(', ') : '',
            format: fieldSchema.format || '',
            readOnly: fieldSchema.readOnly || false
        });
        setModifyModalOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (modifyTypeCallback && currentField && !isRequired(currentField)) {
            // Create updated type schema
            const updatedType = _.cloneDeep(type);
            delete updatedType.properties[currentField];
            
            // Call the modify callback with the updated type
            modifyTypeCallback(updatedType, {
                action: 'delete',
                fieldName: currentField
            });
        }
        setDeleteModalOpen(false);
        setCurrentField(null);
    };

    const validateModifyForm = () => {
        const errors = {};
        
        if (!modifyForm.key.trim()) {
            errors.key = 'Property key is required';
        } else if (modifyForm.key !== currentField && type.properties[modifyForm.key]) {
            errors.key = 'Property key already exists';
        } else if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(modifyForm.key)) {
            errors.key = 'Property key must be a valid identifier';
        }
        
        if (!modifyForm.title.trim()) {
            errors.title = 'Title is required';
        }
        
        if (!['string', 'number', 'boolean', 'array', 'object'].includes(modifyForm.type)) {
            errors.type = 'Invalid type selected';
        }
        
        return errors;
    };

    const handleModifyConfirm = () => {
        const errors = validateModifyForm();
        if (Object.keys(errors).length > 0) {
            console.warn('Form validation errors:', errors);
            // You could show these errors in the UI
            return;
        }
        
        if (modifyTypeCallback && currentField) {
            const updatedType = _.cloneDeep(type);
            const oldFieldName = currentField;
            const newFieldName = modifyForm.key.trim();
            
            // Remove old property
            const oldProperty = updatedType.properties[oldFieldName];
            delete updatedType.properties[oldFieldName];
            
            // Create new property with updated values
            updatedType.properties[newFieldName] = {
                ...oldProperty,
                title: modifyForm.title.trim(),
                description: modifyForm.description.trim(),
                type: modifyForm.type,
                readOnly: modifyForm.readOnly,
                ...(modifyForm.enum.trim() && { enum: modifyForm.enum.split(',').map(s => s.trim()).filter(s => s) }),
                ...(modifyForm.format.trim() && { format: modifyForm.format.trim() })
            };
            
            // Update required array if field name changed
            if (updatedType.required && updatedType.required.includes(oldFieldName) && oldFieldName !== newFieldName) {
                const requiredIndex = updatedType.required.indexOf(oldFieldName);
                updatedType.required[requiredIndex] = newFieldName;
            }
            
            // Call the modify callback
            modifyTypeCallback(updatedType, {
                action: oldFieldName === newFieldName ? 'modify' : 'rename',
                oldFieldName,
                newFieldName,
                value: localValue[oldFieldName] || ''
            });
        }
        setModifyModalOpen(false);
        setCurrentField(null);
    };

    const handleModalClose = () => {
        setDeleteModalOpen(false);
        setModifyModalOpen(false);
        setCurrentField(null);
    };

    const debouncedHandleUpdate = useDebounce(handleUpdate, debounceTime)

    const renderInputField = (fieldName, fieldSchema) => {
        const isEditable = openEdit === fieldName && !disabled;
        const fieldValue = localValue && localValue[fieldName] || '';
        
        // Handle enum fields (dropdown)
        if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
            return (
                <FormControl 
                    className={isEditable ? classes.selectInputEdit : classes.selectInput}
                    fullWidth
                    disabled={!isEditable}
                >
                    <Select
                        value={fieldValue}
                        onChange={(e) => debouncedHandleUpdate(e.target.value, fieldName)}
                        onBlur={() => setIsEdit(false)}
                        displayEmpty
                    >
                        <MenuItem value="" disabled>
                            <em>Select {fieldSchema.title || fieldName}</em>
                        </MenuItem>
                        {fieldSchema.enum.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        }
        
        // Handle different input types based on schema type
        const getInputType = () => {
            switch (fieldSchema.type) {
                case 'number':
                    return 'number';
                case 'string':
                    if (fieldSchema.format === 'date') return 'date';
                    if (fieldSchema.format === 'date-time') return 'datetime-local';
                    return 'text';
                default:
                    return 'text';
            }
        };
        
        // Default input field
        return (
            <TextField
                type={getInputType()}
                inputProps={{
                    maxLength: fieldSchema.type === 'string' ? 500 : undefined,
                    readOnly: !isEditable || fieldSchema.readOnly,
                    step: fieldSchema.type === 'number' ? 'any' : undefined
                }}
                className={isEditable ? classes.inputEdit : classes.input}
                defaultValue={fieldValue}
                value={disabled ? fieldValue : undefined}
                onChange={(e) => {
                    let value = e.target.value;
                    if (fieldSchema.type === 'number' && value !== '') {
                        value = parseFloat(value);
                    }
                    debouncedHandleUpdate(value, fieldName);
                }}
                onBlur={() => setIsEdit(false)}
                placeholder={fieldSchema.description}
            />
        );
    };

    const entityRef = useRef(entity);
    useEffect(() => {
        // Avoid initial onChange to be fired
        if (_.isEqual(entityRef.current, entity)) {
            return;
        }
        setLocalValue(entity || {});
        entityRef.current = entity;
    }, [entity]);

    const fieldProperties = getFieldProperties();

    return (
        <>
            {!type?.properties || !entity ? (
                <div>No data to edit.</div>
            ) : (
                fieldProperties.map(([fieldName, fieldSchema], i) => {
                    const isFieldKeyEditable = isKeyEditable(fieldName);
                    const isFieldDeletable = isDeletable(fieldName);
                    
                    return <React.Fragment key={fieldName}>
                        <Grid style={{justifyContent: "space-between", alignItems: "center"}} container>
                            <Grid item xs={4}>
                                <Typography
                                    variant="body2"
                                    className={classes.title}
                                    style={{ 
                                        fontWeight: isRequired(fieldName) ? 'bold' : 'normal'
                                    }}
                                >
                                    {fieldSchema.title || fieldName}:
                                    {isRequired(fieldName) && <span style={{color: 'red'}}> *</span>}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                {renderInputField(fieldName, fieldSchema)}
                            </Grid>
                            <Grid item xs={2} style={{ display: 'flex', gap: 4 }}>
                                <Tooltip
                                    title={
                                        openEdit === fieldName
                                            ? 'Close Edit'
                                            : disabled
                                                ? 'Editing is disabled'
                                                : fieldSchema.readOnly
                                                    ? fieldSchema.description || 'This property is not editable'
                                                    : 'Edit Value'
                                    }
                                    placement="bottom"
                                >
                                    <IconButton
                                        onClick={
                                            openEdit === fieldName
                                                ? () => setIsEdit(false)
                                                : (disabled || fieldSchema.readOnly)
                                                    ? null
                                                    : () => setIsEdit(fieldName)
                                        }
                                        size="small"
                                        disabled={disabled && openEdit !== fieldName}
                                    >
                                        {openEdit === fieldName ? (
                                            <CancelOutlined className={classes.iconButton} />
                                        ) : (disabled || fieldSchema.readOnly) ? (
                                            <InfoOutlined className={classes.iconButton} />
                                        ) : (
                                            <EditOutlined className={classes.iconButton} />
                                        )}
                                    </IconButton>
                                </Tooltip>
                                
                                {/* Property Settings Button */}
                                {!isRequired(fieldName) && (
                                    <Tooltip title="Modify Property" placement="bottom">
                                        <IconButton
                                            onClick={() => handleOpenModifyModal(fieldName)}
                                            size="small"
                                            disabled={disabled}
                                        >
                                            <SettingsOutlined className={classes.iconButton} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                
                                {/* Delete Button */}
                                {isFieldDeletable && (
                                    <Tooltip title="Delete Property" placement="bottom">
                                        <IconButton
                                            onClick={() => handleOpenDeleteModal(fieldName)}
                                            size="small"
                                            disabled={disabled}
                                        >
                                            <DeleteForeverOutlined className={classes.iconButton} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Grid>
                        </Grid>
                        {fieldProperties.length !== i + 1 && <Divider />}
                    </React.Fragment>
                })
            )}
            
            {/* Delete Confirmation Modal */}
            <Dialog open={deleteModalOpen} onClose={handleModalClose} maxWidth="sm" fullWidth>
                <DialogTitle>Delete Property</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to remove the property <strong>"{currentField}"</strong>? 
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleModalClose} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleDeleteConfirm} color="secondary" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Property Modification Modal */}
            <Dialog open={modifyModalOpen} onClose={handleModalClose} maxWidth="md" fullWidth>
                <DialogTitle>Modify Property</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} style={{ marginTop: 8 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Property Key"
                                fullWidth
                                value={modifyForm.key}
                                onChange={(e) => setModifyForm({ ...modifyForm, key: e.target.value })}
                                disabled={isRequired(currentField)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Title"
                                fullWidth
                                value={modifyForm.title}
                                onChange={(e) => setModifyForm({ ...modifyForm, title: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Description"
                                fullWidth
                                multiline
                                rows={2}
                                value={modifyForm.description}
                                onChange={(e) => setModifyForm({ ...modifyForm, description: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Field Type</InputLabel>
                                    <Select
                                        value={modifyForm.type}
                                        onChange={(e) => setModifyForm({ ...modifyForm, type: e.target.value })}
                                        displayEmpty
                                    >
                                        <MenuItem value="string">String</MenuItem>
                                        <MenuItem value="number">Number</MenuItem>
                                        <MenuItem value="boolean">Boolean</MenuItem>
                                        <MenuItem value="array">Array</MenuItem>
                                        <MenuItem value="object">Object</MenuItem>
                                    </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Format"
                                fullWidth
                                value={modifyForm.format}
                                onChange={(e) => setModifyForm({ ...modifyForm, format: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Enum Values"
                                fullWidth
                                value={modifyForm.enum}
                                onChange={(e) => setModifyForm({ ...modifyForm, enum: e.target.value })}
                                placeholder="option1, option2, option3"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={modifyForm.readOnly}
                                        onChange={(e) => setModifyForm({ ...modifyForm, readOnly: e.target.checked })}
                                    />
                                }
                                label="Read Only"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleModalClose} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleModifyConfirm} color="primary" variant="contained">
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

