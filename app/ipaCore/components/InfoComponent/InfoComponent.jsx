import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { toTitleCase } from "../../../services/utils";
import {
    makeStyles,
} from "@material-ui/core";
import {
    Divider, Grid, TextField, Typography, Select, MenuItem, FormControl,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControlLabel, Checkbox,
    InputLabel, ThemeProvider
} from "@mui/material";
import {useCancellableDebounce, useDebounce} from "../../hooks/useDebounce";
import _ from "lodash";
import {OptionsContext} from "../jsonForms/renderers/OptionsContext.jsx";
import {useInfoComponentJsonForms} from "../jsonForms/useInfoComponentJsonForms.jsx";
import {JsonForms} from "@jsonforms/react";
import { formTheme } from './formTheme.js';
import {PropertyModificationModal} from "./modals/PropertyModificationModal.jsx";
import {DeleteConfirmationModal} from "./modals/DeleteConfirmationModal.jsx";
import {makeLayouts} from "../jsonForms/layouts/Layouts.jsx";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {flushSync} from "react-dom";
import FlowPowerCellRenderer from './controls/FlowPowerCellRenderer.jsx';
import {  rankWith, and, scopeEndsWith, isNumberControl } from '@jsonforms/core';

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

// Helper functions for JSON Schema
const isFieldRequired = (schema, fieldName) => {
    return schema?.required?.includes(fieldName) || false;
};

const isFieldEditable = (schema, fieldName, allowReadOnlyOverride = false) => {
    const fieldSchema = schema?.properties?.[fieldName];
    return !fieldSchema?.readOnly || (fieldSchema?.readOnly && allowReadOnlyOverride);
};

const isFieldDeletable = (schema, fieldName) => {
    return !isFieldRequired(schema, fieldName);
};

export const InfoComponent = ({ entity, handleChange, type, entityType, originalEntity, disabled = false, onFieldRemove, modifyTypeCallback, debounceTime=700, allowReadOnlyOverride = false }) => {
    // Modal states
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [modifyModalOpen, setModifyModalOpen] = useState(false);
    const [currentField, setCurrentField] = useState(null);

    const [localValue, setLocalValue] = useState(entity || {});
    const classes = useStyles();
const handleUpdate = (newValue, name) => {
  setLocalValue({ ...localValue, [name]: newValue });

  handleChange &&
    handleChange(newValue, name, {
      name,
      entityType,
      entity,
      originalEntity,
    });
};


    // Modal handlers
    const handleOpenDeleteModal = useCallback((fieldName) => {
        setCurrentField(fieldName);
        setDeleteModalOpen(true);
    },[]);

    const handleOpenModifyModal = useCallback((fieldName) => {
        setCurrentField(fieldName);
        setModifyModalOpen(true);
    },[]);

    const handleDeleteConfirm = () => {
        if (modifyTypeCallback && currentField && !isFieldRequired(type, currentField)) {
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

    const onModifyConfirm = ({updatedType, oldFieldName, newFieldName}) => {
        setCurrentField(null);
        // Call the modify callback
        updatedType && modifyTypeCallback && modifyTypeCallback(updatedType, {
            action: oldFieldName === newFieldName ? 'modify' : 'rename',
            oldFieldName,
            newFieldName,
            value: localValue[oldFieldName] || ''
        });
    }

    const handleModalClose = () => {
        setDeleteModalOpen(false);
        setModifyModalOpen(false);
        setCurrentField(null);
    };

    const [debouncedHandleUpdate, cancelQueuedUpdate] = useCancellableDebounce(handleUpdate, debounceTime)

    const entityRef = useRef(entity);
    useEffect(() => {
        // Avoid initial onChange to be fired
        if (_.isEqual(entityRef.current, entity)) {
            return;
        }
        cancelQueuedUpdate();
        setLocalValue(entity || {});
        entityRef.current = entity;
        return () => {
            cancelQueuedUpdate();
        }
    }, [entity]);

    // Layout wrappers (RowWithActions) use your existing helpers & modals
    const layouts =
        useMemo(() => makeLayouts({
            getIsModifiable: (field) => {
                if (entityType === 'equipment') return false;
                const fieldSchema = type?.properties?.[field];
                // modifiable if field exists and is not readOnly (or readOnly override is allowed)
                const guard = !!fieldSchema && isFieldEditable(type, field, allowReadOnlyOverride);
                return guard;
            },
            getIsEditable: (field) => {
                const fieldSchema = type?.properties?.[field];
                // editable if field exists and is not readOnly (or readOnly override is allowed)
                const guard = !!fieldSchema && isFieldEditable(type, field, allowReadOnlyOverride);
                return guard;
            },
            getIsDeletable: (field) => isFieldDeletable(type, field),
            onOpenModify: (field) => handleOpenModifyModal(field),
            onOpenDelete: (field) => handleOpenDeleteModal(field),
            disabledForm: disabled,
            entityType     
        }), [type, disabled, handleOpenModifyModal, handleOpenDeleteModal, allowReadOnlyOverride, entityType]);

    const {processedType, uiSchema, renderers, optionsResolver, ajv, materialCells, materialRenderers} = useInfoComponentJsonForms({schema: type, layouts, allowReadOnlyOverride});

    const prevRef = useRef(localValue);
    useEffect(() => { prevRef.current = localValue; }, [localValue]);

    const onJsonFormsChange = ({ data }) => {
        const prev = prevRef.current || {};
        const keys = new Set([...Object.keys(prev), ...Object.keys(data)]);
        for (const k of keys) {
            if (!_.isEqual(prev[k], data[k])) {
                debouncedHandleUpdate(data[k], k);
                break;
            }
        }
    };


    return (
        <ThemeProvider theme={formTheme}>
            {!type?.properties || !entity ? (
                <div>No data to edit.</div>
            ) :
                <OptionsContext.Provider value={{ resolve: optionsResolver }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <ThemeProvider theme={formTheme}>
                            <JsonForms
                                data={localValue}
                                schema={processedType}
                                uischema={uiSchema} 
                                onChange={onJsonFormsChange}
                                renderers={renderers}
                                cells={materialCells}
                                ajv={ajv}
                            />
                        </ThemeProvider>
                    </LocalizationProvider>
                </OptionsContext.Provider>
            }

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal currentField={currentField}
                                     deleteModalOpen={deleteModalOpen}
                                     handleModalClose={handleModalClose}
                                     handleDeleteConfirm={handleDeleteConfirm}>
            </DeleteConfirmationModal>

            {/* Property Modification Modal */}
            {currentField && <PropertyModificationModal schema={type}
                                       fieldName={currentField}
                                       modifyModalOpen={modifyModalOpen}
                                       setModifyModalOpen={setModifyModalOpen}
                                       onModifyConfirm={onModifyConfirm}
                                       handleModalClose={handleModalClose}>
            </PropertyModificationModal>}
        </ThemeProvider>
    );
};

