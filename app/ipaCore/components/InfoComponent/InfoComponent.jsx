import React, { useEffect, useMemo, useRef, useState } from "react";
import { toTitleCase } from "../../../services/utils";
import { Divider, Grid, TextField, Tooltip, Typography, IconButton, makeStyles, Select, MenuItem, FormControl } from "@material-ui/core";
import { CancelOutlined, EditOutlined, InfoOutlined, DeleteForeverOutlined } from "@material-ui/icons";
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

export const InfoComponent = ({ entity, handleChange, type, entityType, originalEntity, disabled = false, onFieldRemove, debounceTime=700 }) => {
    const [openEdit, setIsEdit] = useState(false);
    const [editingFieldName, setEditingFieldName] = useState(false);
    const [fieldNameValue, setFieldNameValue] = useState('');
    const initialLocalValue = useMemo(() => {
        if (entityType === "Site") {
            return entity || {};
        } else {
            // For custom objects with attributes
            return entity?.attributes || entity || {};
        }
    }, [entity, entityType]);
    
    const [localValue, setLocalValue] = useState(initialLocalValue);
    const classes = useStyles();

    const toCamelCase = (str) => {
        return str
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            })
            .replace(/\s+/g, '');
    };

    const handleUpdate = (newValue, name) => {
        console.log("handleUpdate", {newValue, name})
        setLocalValue({ ...localValue, [name]: newValue });
        
        // Call the onChange handler with the new value
        if (entityType === "Site") {
            handleChange && handleChange(newValue, name, { name, entityType, entity, originalEntity });
        } else {
            handleChange && handleChange(newValue, `attributes.${name}`, { name, entityType, entity, originalEntity });
        }
    };

    const handleFieldNameChange = (e) => {
        setFieldNameValue(e.target.value);
    };

    const handleFieldNameUpdate = (oldFieldName) => {
        const newFieldTitle = fieldNameValue;
        const newFieldName = toCamelCase(newFieldTitle);
        
        if (newFieldName && newFieldName !== oldFieldName && onFieldRemove) {
            // Remove the old field and add the new one
            onFieldRemove(oldFieldName, { 
                action: 'rename', 
                newFieldName, 
                newFieldTitle,
                value: localValue[oldFieldName] || ''
            });
        }
        setEditingFieldName(false);
        setFieldNameValue('');
    };

    const debouncedFieldNameUpdate = useDebounce(handleFieldNameUpdate, debounceTime);
    const debouncedHandleUpdate = useDebounce(handleUpdate, debounceTime)

    const renderInputField = (prop) => {
        const fieldConfig = prop[1];
        const fieldName = prop[0];
        const isEditable = openEdit === fieldName && !disabled;
        
        // Check if this is a dropdown field
        if (fieldConfig.type === 'dropdown' && fieldConfig.options) {
            return (
                <FormControl 
                    className={isEditable ? classes.selectInputEdit : classes.selectInput}
                    fullWidth
                    disabled={!isEditable}
                >
                    <Select
                        value={localValue && localValue[fieldName] || ''}
                        onChange={(e) => debouncedHandleUpdate(e.target.value, fieldName)}
                        onBlur={() => setIsEdit(false)}
                        displayEmpty
                    >
                        <MenuItem value="" disabled>
                            <em>Select {fieldConfig.title || fieldName}</em>
                        </MenuItem>
                        {fieldConfig.options.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        }
        
        // Default text field
        return (
            <TextField
                inputProps={{
                    maxLength: 50,
                    readOnly: !isEditable
                }}
                className={isEditable ? classes.inputEdit : classes.input}
                defaultValue={localValue && localValue[fieldName] || ''}
                onChange={(e) => debouncedHandleUpdate(e.target.value, fieldName)}
                onBlur={() => setIsEdit(false)}
            />
        );
    };

    const entityRef = useRef(entity);
    useEffect(() => {
        // Avoid initial onChange to be fired
        if (_.isEqual(entityRef.current, entity)) {
            return;
        }
        if (entityType === "Site") {
            setLocalValue(entity || {});
        } else {
            // For custom objects with attributes
            setLocalValue(entity?.attributes || {});
        }
        entityRef.current = entity;
    }, [entity, entityType]);

    return (
        <>
            {!type?.length || !entity ? (
                <div>No data to edit.</div>
            ) : (
                type?.map((prop, i) => {
                    return <React.Fragment key={prop[0]}>
                        <Grid style={{justifyContent: "space-between", alignItems: "center"}} container>
                            <Grid item xs={4}>
                                {prop[1].isKeyEditable && editingFieldName === prop[0] ? (
                                    <TextField
                                        defaultValue={prop[1].title || prop[0]}
                                        onChange={handleFieldNameChange}
                                        onBlur={() => debouncedFieldNameUpdate(prop[0])}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                debouncedFieldNameUpdate(prop[0]);
                                            }
                                        }}
                                        variant="outlined"
                                        size="small"
                                        autoFocus
                                        style={{ minWidth: '120px' }}
                                    />
                                ) : (
                                    <Typography
                                        variant="body2"
                                        className={classes.title}
                                        onClick={prop[1].isKeyEditable && !disabled ? () => {
                                            setEditingFieldName(prop[0]);
                                            setFieldNameValue(prop[1].title || prop[0]);
                                        } : null}
                                        style={{ 
                                            cursor: prop[1].isKeyEditable && !disabled ? 'pointer' : 'default',
                                            textDecoration: prop[1].isKeyEditable && !disabled ? 'underline dotted' : 'none'
                                        }}
                                    >
                                        {toTitleCase(prop[1].title || prop[0])}:
                                    </Typography>
                                )}
                            </Grid>
                            <Grid item xs={6}>
                                {renderInputField(prop)}
                            </Grid>
                            <Grid item xs={2} style={{ display: 'flex', gap: 4 }}>
                                <Tooltip
                                    title={
                                        openEdit === prop[0]
                                            ? 'Close Edit'
                                            : disabled
                                                ? 'Editing is disabled'
                                                : prop[1].readOnly
                                                    ? prop[1].description || 'This property is not editable'
                                                    : 'Edit'
                                    }
                                    placement="bottom"
                                >
                                    <IconButton
                                        onClick={
                                            openEdit === prop[0]
                                                ? () => setIsEdit(false)
                                                : (disabled || prop[1].readOnly)
                                                    ? null
                                                    : () => setIsEdit(prop[0])
                                        }
                                        size="small"
                                        disabled={disabled && openEdit !== prop[0]}
                                    >
                                        {openEdit === prop[0] ? (
                                            <CancelOutlined className={classes.iconButton} />
                                        ) : (disabled || prop[1].readOnly) ? (
                                            <InfoOutlined className={classes.iconButton} />
                                        ) : (
                                            <EditOutlined className={classes.iconButton} />
                                        )}
                                    </IconButton>
                                </Tooltip>
                                {prop[1].isDeletable && (
                                    // <div>HW!</div>
                                    <Tooltip
                                        title="Remove field"
                                        placement="bottom"
                                    >
                                        <IconButton
                                            onClick={() => onFieldRemove && onFieldRemove(prop[0], { action: 'delete' })}
                                            size="small"
                                            disabled={disabled}
                                        >
                                            <DeleteForeverOutlined className={classes.iconButton} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Grid>
                        </Grid>
                        {type.length !== i + 1 && <Divider />}
                    </React.Fragment>
                })
            )}
        </>
    );
};

