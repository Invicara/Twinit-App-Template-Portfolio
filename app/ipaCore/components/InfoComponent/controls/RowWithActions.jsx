import React, { useMemo } from "react";
import { Box, Divider, IconButton, Tooltip, Typography } from "@mui/material";
import { composePaths, toDataPath, Resolve } from '@jsonforms/core';
import ValuePresenter from "./ValuePresenter.jsx";
import {
  CancelOutlined as CloseIcon,
  DeleteForeverOutlined,
  EditOutlined as EditIcon,
  InfoOutlined,
  SettingsOutlined,
  Warning as WarningIcon,
ErrorOutline as ErrorIcon,
 AssignmentLate as AssignmentLateIcon
} from "@mui/icons-material";

// Extract "name" from "#/properties/name"
const controlKey = (scope) => scope.match(/#\/properties\/(.+)$/)?.[1] ?? scope;

export function RowWithActions({
  schema,
  path,
  enabled,
  labelPlacement = "auto",
  Control,
  controlProps,
  controlUiSchema = {},
  getIsModifiable,
  getIsDeletable,
  getIsEditable,
  onOpenModify,
  onOpenDelete,
  disabledForm,
  entityType
}) {
  const rowRef = React.useRef(null);
  const key = controlKey(controlUiSchema.scope);
  const controlPath = composePaths(path ?? '', toDataPath(controlUiSchema.scope));
  const canModify = getIsModifiable(key);
  const canDelete = getIsDeletable(key);
  const canEdit = getIsEditable(key);

  const [editing, setEditing] = React.useState(false);

  const labelText = controlUiSchema.label ?? schema?.properties?.[key]?.title ?? key;
  const isRequired =
    Array.isArray(schema?.required) && schema.required.includes(key);

//  const propSchema = schema?.properties?.[key];
// const showMismatch = !!propSchema?.isMismatched;

const propSchema = schema?.properties?.[key];
  const [liveMismatch, setLiveMismatch] = React.useState(!!propSchema?.isMismatched);
  const [liveEdited, setLiveEdited] = React.useState(!!propSchema?.isEdited);
  console.log('RowWithActions schema', key, propSchema);

  const controlUiSchemaWithOptionalLabel = useMemo(
    () => ({ ...controlUiSchema, label: controlUiSchema.label }),
    [controlUiSchema]
  );

  const isInMuiPicker = (el) =>
    !!el?.closest?.(
      '.MuiPickersPopper-root, .MuiModal-root, .MuiPickersModal-dialogRoot, [role="dialog"]'
    );
  const onRowBlur = (e) => {
  if (!editing) return;
  if (key === 'FlowRate' || key === 'Power') return;

  requestAnimationFrame(() => {
    const next = e.relatedTarget || document.activeElement;
    const inRow = rowRef.current?.contains(next);
    if (!inRow && !isInMuiPicker(next)) {
      setEditing(false);
    }
  });
};

  return (
     <Box
    ref={rowRef}
    p={0}
    sx={{
      backgroundColor: propSchema?.isEdited ? '#ECF5FB' : 'transparent',
      borderRadius: 1,   
    }}>
      <Box
        display="grid"
        gridTemplateColumns={`${labelPlacement == "auto" ? "" : "33% "} 1fr auto`}
        alignItems="center"
        columnGap={1}
      >
        {/* LEFT: fixed label */}
        {labelPlacement == "left" && (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {labelText}
              {isRequired ? (
                <Typography component="span" color="error">
                  &nbsp;*
                </Typography>
              ) : null}
            </Typography>
          </Box>
        )}

        {/* RIGHT: value presenter or editable control */}
        <Box>
          {editing ? (
            <Control
              {...controlProps}
              uischema={controlUiSchemaWithOptionalLabel}
              enabled={editing && canEdit && !disabledForm && (enabled ?? true)}
            />
          ) : (
            <ValuePresenter
              controlUiSchema={controlUiSchemaWithOptionalLabel}
              schema={schema}
              path={path}
              labelPlacement={labelPlacement}
            onEvaluate={({ isMismatch }) => setLiveMismatch(isMismatch)}
            />
          )}
        </Box>

        {/* Actions: warning + edit/info + modify/delete */}
        <Box justifySelf="end" alignSelf="start" pt={3} display="flex" alignItems="center">
              {(liveMismatch && !propSchema.isEdited) && (
            <Tooltip title={'Expected other value'}>
              <WarningIcon fontSize="small" sx={{ color: "orange", mr: 0.5 }} />
            </Tooltip>
          )}

           {propSchema?.isEdited && (
    <Tooltip title="This field has an edit request">
      <Box display="flex" alignItems="center" mr={1}>
        <Typography
          variant="caption"
          sx={{ color: '#1976d2', fontWeight: 600, mr: 0.5 }}
        >
          Edit Request
        </Typography>
       <AssignmentLateIcon fontSize="small" sx={{ color: '#1976d2' }} />
      </Box>
    </Tooltip>
  )}

          {!editing ? (
            <Tooltip
              title={
                disabledForm
                  ? "Editing is disabled"
                  : !canEdit
                  ? "This property is not editable"
                  : "Edit value"
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={() => canEdit && !disabledForm && setEditing(true)}
                  disabled={disabledForm || !canEdit}
                >
                  {(!canEdit || disabledForm) ? (
                    <InfoOutlined fontSize="small" />
                  ) : (
                    <EditIcon fontSize="small" />
                  )}
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
      <Divider
        style={{
          marginTop: 6,
          borderBottomWidth: "0px",
          height: "1px",
          backgroundColor: "#e7e7e7"
        }}
      />
    </Box>
  );
}
