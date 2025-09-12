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
    const key = controlKey(controlUiSchema.scope);
    const controlPath = composePaths(path ?? '', toDataPath(controlUiSchema.scope));
    const canModify = getIsModifiable(key);
    const canDelete = getIsDeletable(key);
    const canEdit = getIsEditable(key);

    const [editing, setEditing] = React.useState(false);

    // label & required
    const labelText = controlUiSchema.label ?? schema?.properties?.[key]?.title ?? key;
    const isRequired =
        Array.isArray(schema?.required) && !schema.required.includes(key);

    // clone element to hide the built-in label if we render our own on the left
    const controlUiSchemaWithOptionalLabel = useMemo(()=>({ ...controlUiSchema, label: labelPlacement == "auto" ? controlUiSchema.label : false }),[controlUiSchema, labelPlacement]);

    // Exit edit when focus leaves this row
    const onRowBlur = (e) => {
        if (!editing) return;
        const next = e.relatedTarget;
        if (!e.currentTarget.contains(next)) setEditing(false);
    };

    return (
        <Box onBlur={onRowBlur} py={0.75}>
            {console.log("RowWithActions",{key, canDelete, canEdit, canModify})}
            <Box display="grid" gridTemplateColumns={`${labelPlacement=="auto" ? '' : '220px '} 1fr auto`} alignItems="center" columnGap={1}>
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
                            path={controlPath}
                            uischema={controlUiSchemaWithOptionalLabel}
                            enabled={editing && canEdit && !disabledForm && (enabled ?? true)}
                        /></>
                    ) : (
                        <ValuePresenter controlUiSchema={controlUiSchemaWithOptionalLabel} schema={schema} path={path} labelPlacement={labelPlacement}/>
                    )}
                </Box>

                {/* Actions: edit/pencil or close (X); plus Modify/Delete */}
                <Box justifySelf="end">
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
            <Divider style={{ marginTop: 6 }} />
        </Box>
    );
}
