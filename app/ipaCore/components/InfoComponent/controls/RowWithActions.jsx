import React, {useMemo} from "react";
import {Box, Divider, IconButton, Tooltip, Typography} from "@mui/material";
import { composePaths, toDataPath } from '@jsonforms/core';
import ValuePresenter from "./ValuePresenter.jsx";
import {
    CancelOutlined as CloseIcon, DeleteForeverOutlined,
    EditOutlined as EditIcon,
    InfoOutlined,
    SettingsOutlined
} from "@mui/icons-material";

// Extract "name" from "#/properties/name"
const controlKey = (scope) => scope.match(/#\/properties\/(.+)$/)?.[1] ?? scope;

export function RowWithActions({schema, path, enabled, labelPlacement = "auto", Control, controlProps, controlUiSchema = {}, getIsModifiable, getIsDeletable, getIsEditable, onOpenModify, onOpenDelete, disabledForm }) {
    const rowRef = React.useRef(null);
    const key = controlKey(controlUiSchema.scope);
    const controlPath = composePaths(path ?? '', toDataPath(controlUiSchema.scope));
    const canModify = getIsModifiable(key);
    const canDelete = getIsDeletable(key);
    const canEdit = getIsEditable(key);

    const [editing, setEditing] = React.useState(false);

    // label & required
    const labelText = controlUiSchema.label ?? schema?.properties?.[key]?.title ?? key;
    const isRequired =
        Array.isArray(schema?.required) && schema.required.includes(key);

    // clone element to hide the built-in label if we render our own on the left
    const controlUiSchemaWithOptionalLabel = useMemo(()=>({ ...controlUiSchema, label: labelPlacement == "auto" ? controlUiSchema.label : controlUiSchema.label }),[controlUiSchema, labelPlacement]);

    //Helper: is focus inside a MUI picker portal?
    const isInMuiPicker = (el) =>
        !!el?.closest?.(
            '.MuiPickersPopper-root, .MuiModal-root, .MuiPickersModal-dialogRoot, [role="dialog"]'
        );
    // Exit edit when focus truly leaves (row AND any open picker)
    const onRowBlur = (e) => {
        if (!editing) return;
        // Defer so the new activeElement is set (portal focus happens after blur)
        requestAnimationFrame(() => {
            const next = e.relatedTarget || document.activeElement;
            const inRow = rowRef.current?.contains(next);
            if (!inRow && !isInMuiPicker(next)) {
                setEditing(false);
            }
        });
    };

    return (
        <Box ref={rowRef} onBlur={onRowBlur} p={0}>
            <Box display="grid" gridTemplateColumns={`${labelPlacement=="auto" ? '' : '33% '} 1fr auto`} alignItems="center" columnGap={1}>
                {/* LEFT: fixed label */}
                {labelPlacement=="left" && <Box>
                    <Typography variant="body2" fontWeight={600}>
                        {labelText}
                        {isRequired ? <Typography component="span" color="error">&nbsp;*</Typography> : null}
                    </Typography>
                </Box>}

                {/* RIGHT: value presenter or editable control */}
                <Box>
                    {editing ? (<>
                        <Control
                            {...controlProps}
                            uischema={controlUiSchemaWithOptionalLabel}
                            enabled={editing && canEdit && !disabledForm && (enabled ?? true)}
                        /></>
                    ) : (
                        <ValuePresenter controlUiSchema={controlUiSchemaWithOptionalLabel} schema={schema} path={path} labelPlacement={labelPlacement}/>
                    )}
                </Box>

                {/* Actions: edit/pencil or close (X); plus Modify/Delete */}
                <Box justifySelf="end" alignSelf="start" pt={3}>
                    {!editing ? (
                        <Tooltip
                            title={
                                disabledForm ? 'Editing is disabled'
                                    : !canEdit ? 'This property is not editable'
                                        : 'Edit value'
                            }
                        >
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => canEdit && !disabledForm && setEditing(true)}
                                    disabled={disabledForm || !canEdit}
                                >
                                    {(!canEdit || disabledForm) ? <InfoOutlined fontSize="small" /> : <EditIcon fontSize="small" />}
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Close edit">
                            <IconButton size="small" onClick={() => setEditing(false)}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {/* Modify (only if not required) */}
                    {canModify && (
                        <Tooltip title="Modify Property">
                          <span>
                            <IconButton
                                size="small"
                                onClick={() => onOpenModify?.(key)}
                                disabled={disabledForm}
                            >
                              <SettingsOutlined fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                    )}

                    {/* Delete */}
                    {canDelete && (
                        <Tooltip title="Delete Property">
                          <span>
                            <IconButton
                                size="small"
                                onClick={() => onOpenDelete?.(key)}
                                disabled={disabledForm}
                            >
                              <DeleteForeverOutlined fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                    )}
                </Box>
            </Box>
            <Divider style={{ marginTop: 6, borderBottomWidth: "0px", height: "1px", backgroundColor: "#e7e7e7" }} />
        </Box>
    );
}
