import {
    Button,
    Checkbox, Dialog, DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel, FormLabel,
    Grid,
    InputLabel,
    MenuItem, Paper, Radio, RadioGroup,
    Select,
    TextField, Typography
} from "@mui/material";
import React, {useEffect, useState} from "react";
import _ from "lodash";
import {defaultNumberFormat, renderNumberPreview} from "../controls/numberFormat.js";

// Helper functions for JSON Schema
const isFieldRequired = (schema, fieldName) => {
    return schema?.required?.includes(fieldName) || false;
};

export function PropertyModificationModal({schema, modifyModalOpen, setModifyModalOpen, handleModalClose, fieldName, onModifyConfirm}) {

    const [modifyForm, setModifyForm] = useState({
        key: '',
        title: '',
        description: '',
        type: 'string',
        enum: '',
        format: '',
        readOnly: false,
        xNumberFormat: undefined
    });

    useEffect(() => {
        const fieldSchema = schema.properties[fieldName];
        setModifyForm({
            key: fieldName,
            title: fieldSchema.title || fieldName,
            description: fieldSchema.description || '',
            type: fieldSchema.type || 'string',
            enum: Array.isArray(fieldSchema.enum) ? fieldSchema.enum.join(', ') : '',
            format: fieldSchema.format || '',
            readOnly: fieldSchema.readOnly || false,
            xNumberFormat: fieldSchema['x-numberFormat'] ?? (fieldSchema.type === 'number' ? defaultNumberFormat : undefined)
        });
    }, [schema, fieldName]);

    const validateModifyForm = () => {
        const errors = {};

        if (!modifyForm.key.trim()) {
            errors.key = 'Property key is required';
        } else if (modifyForm.key !== fieldName && schema[modifyForm.key] !== undefined) {
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

        let updatedType, oldFieldName = fieldName, newFieldName;
        if (onModifyConfirm && fieldName) {
            updatedType = _.cloneDeep(schema);
            newFieldName = modifyForm.key.trim();

            const oldProperty = updatedType.properties[oldFieldName];

            const newProperty = {
                key: modifyForm.key,
                ...oldProperty,
                title: modifyForm.title.trim(),
                description: modifyForm.description.trim(),
                type: modifyForm.type,
                readOnly: modifyForm.readOnly,
            };

            if (modifyForm.type !== 'boolean' && modifyForm.enum?.trim()) {
                newProperty.enum = modifyForm.enum.split(',').map(s => s.trim()).filter(Boolean);
            }

            if (modifyForm.format?.trim()) {
                newProperty.format = modifyForm.format.trim(); // legacy / optional
            }

            if (modifyForm.type === 'number' && modifyForm.xNumberFormat) {
                newProperty['x-numberFormat'] = modifyForm.xNumberFormat;
            }

            // Remove old property
            delete updatedType.properties[oldFieldName];
            // Create new property with updated values
            updatedType.properties[newFieldName] = newProperty;

            // Update required array if field name changed
            if (updatedType.required && updatedType.required.includes(oldFieldName) && oldFieldName !== newFieldName) {
                const requiredIndex = updatedType.required.indexOf(oldFieldName);
                updatedType.required[requiredIndex] = newFieldName;
            }
        }
        setModifyModalOpen(false);
        onModifyConfirm && onModifyConfirm({oldFieldName, newFieldName, updatedType});
    };

    return <Dialog open={modifyModalOpen} onClose={handleModalClose} maxWidth="md" fullWidth>
        <DialogTitle>Modify Property</DialogTitle>
        <DialogContent>
            <Grid container spacing={2} style={{ marginTop: 8 }}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Property Key"
                        fullWidth
                        value={modifyForm.key}
                        onChange={(e) => setModifyForm({ ...modifyForm, key: e.target.value })}
                        disabled={isFieldRequired(schema, fieldName)}
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
                            variant="standard"
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
                        onChange={(e) => {
                            let value = e.target.value;
                            if (modifyForm.type === 'number') {
                                value = value.replace(/[^0-9,.\s]/g, '');
                            }
                            setModifyForm({ ...modifyForm, enum: value });
                        }}
                        placeholder={modifyForm.type === 'number' ? '1, 2.5, 3.14' : 'option1, option2, option3'}
                        disabled={modifyForm.type === 'boolean'}
                    />
                </Grid>

                {modifyForm.type === 'number' && (
                    <Grid item xs={12}>
                        <Paper variant="outlined" style={{ padding: 12 }}>
                            <Typography variant="subtitle1" gutterBottom>Number Formatting</Typography>

                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <FormControl component="fieldset">
                                        <FormLabel component="legend">Kind</FormLabel>
                                        <RadioGroup
                                            row
                                            value={modifyForm.xNumberFormat?.kind ?? 'plain'}
                                            onChange={(e) => {
                                                const kind = e.target.value;
                                                // reset per kind with sensible defaults
                                                const next =
                                                    kind === 'currency' ? { kind, currency: 'EUR', style: 'standard', precision: 2 } :
                                                        kind === 'percent'  ? { kind, multiplier: 1, precision: 2 } :
                                                            kind === 'unit'     ? { kind, unit: 'kg', precision: 3 } :
                                                                { kind: 'plain', precision: 2 };
                                                setModifyForm(f => ({ ...f, xNumberFormat: next }));
                                            }}
                                        >
                                            <FormControlLabel value="plain" control={<Radio />} label="Plain" />
                                            <FormControlLabel value="currency" control={<Radio />} label="Currency" />
                                            <FormControlLabel value="percent" control={<Radio />} label="Percent" />
                                            <FormControlLabel value="unit" control={<Radio />} label="Unit (UoM)" />
                                        </RadioGroup>
                                    </FormControl>
                                </Grid>

                                {/* Currency fields */}
                                {modifyForm.xNumberFormat?.kind === 'currency' && (
                                    <>
                                        <Grid item xs={6} sm={3}>
                                            <TextField
                                                label="Currency (ISO 4217)"
                                                value={modifyForm.xNumberFormat.currency}
                                                onChange={(e) =>
                                                    setModifyForm(f => ({
                                                        ...f,
                                                        xNumberFormat: { ...(f.xNumberFormat), currency: e.target.value.toUpperCase() }
                                                }))
                                                }
                                                placeholder="EUR"
                                                inputProps={{ maxLength: 3 }}
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <FormControl fullWidth>
                                                <InputLabel>Style</InputLabel>
                                                <Select
                                                    label="Style"
                                                    value={(modifyForm.xNumberFormat).style ?? 'standard'}
                                                    onChange={(e) =>
                                                        setModifyForm(f => ({
                                                            ...f,
                                                            xNumberFormat: { ...(f.xNumberFormat), style: e.target.value}
                                                    }))
                                                    }
                                                >
                                                    <MenuItem value="standard">Standard</MenuItem>
                                                    <MenuItem value="accounting">Accounting</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </>
                                )}

                                {/* Percent fields */}
                                {modifyForm.xNumberFormat?.kind === 'percent' && (
                                    <Grid item xs={6} sm={3}>
                                        <TextField
                                            label="Multiplier"
                                            type="number"
                                            value={(modifyForm.xNumberFormat).multiplier ?? 1}
                                            onChange={(e) =>
                                                setModifyForm(f => ({
                                                    ...f,
                                                    xNumberFormat: { ...(f.xNumberFormat), multiplier: Number(e.target.value) }
                                            }))
                                            }
                                            helperText="1 = value is 0–1; 0.01 = value is 0–100"
                                            fullWidth
                                        />
                                    </Grid>
                                )}

                                {/* Unit/UoM fields */}
                                {modifyForm.xNumberFormat?.kind === 'unit' && (
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            label="Unit of Measure"
                                            value={(modifyForm.xNumberFormat).unit}
                                            onChange={(e) =>
                                                setModifyForm(f => ({
                                                    ...f,
                                                    xNumberFormat: { ...(f.xNumberFormat), unit: e.target.value }
                                            }))
                                            }
                                            placeholder="kg, m, celsius, km/h…"
                                            fullWidth
                                        />
                                    </Grid>
                                )}

                                {/* Precision (shown for all kinds) */}
                                {modifyForm.xNumberFormat && (
                                    <Grid item xs={12} sm={3}>
                                        <TextField
                                            label="Precision"
                                            type="number"
                                            inputProps={{ min: 0, max: 10 }}
                                            value={modifyForm.xNumberFormat.precision ?? (modifyForm.xNumberFormat.kind === 'unit' ? 3 : 2)}
                                            onChange={(e) =>
                                                setModifyForm(f => ({
                                                    ...f,
                                                    xNumberFormat: { ...(f.xNumberFormat), precision: Number(e.target.value) }
                                            }))
                                            }
                                            fullWidth
                                        />
                                    </Grid>
                                )}

                                {/* Preview */}
                                <Grid item xs={12}>
                                    <Typography variant="caption" color="textSecondary">
                                        Preview (1234.5): {renderNumberPreview(1234.5, modifyForm.xNumberFormat, navigator.language)}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>
                )}


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
}
