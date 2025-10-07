import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Box, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import {
  DeleteForeverOutlined,
  EditOutlined as EditIcon,
  InfoOutlined,
  SettingsOutlined,
  Warning as WarningIcon,
  CancelOutlined as CloseIcon,
  AssignmentLate as AssignmentLateIcon
} from '@mui/icons-material';
import { composePaths, toDataPath, Resolve } from '@jsonforms/core';
import ValuePresenter from './ValuePresenter.jsx';

const controlKey = (scope) => scope.match(/#\/properties\/(.+)$/)?.[1] ?? scope;

export function RowWithActions({
  schema,
  path,
  enabled,
  labelPlacement = 'auto',
  Control,
  controlProps,
  controlUiSchema = {},
  getIsModifiable,
  getIsDeletable,
  getIsEditable,
  onOpenModify,
  onOpenDelete,
  disabledForm,
}) {
  const rowRef = useRef(null);
  const key = controlKey(controlUiSchema.scope);
  const absPath = composePaths(path ?? '', toDataPath(controlUiSchema.scope));

  const canModify = getIsModifiable(key);
  const canDelete = getIsDeletable(key);
  const canEdit = getIsEditable(key);

  const [editing, setEditing] = useState(false);
  const [liveMismatch, setLiveMismatch] = useState(false);
  const [liveEdited, setLiveEdited] = useState(!!schema?.properties?.[key]?.isEdited);
  const [currentRawValue, setCurrentRawValue] = useState(null);

  const propSchema = schema?.properties?.[key];
  const labelText = controlUiSchema.label ?? propSchema?.title ?? key;
  const isRequired =
    Array.isArray(schema?.required) && schema.required.includes(key);


  const originalValRef = useRef(
    propSchema?.displayValue ??
    Resolve.data(controlProps?.data, controlUiSchema.scope)
  );


  const handleUserTyping = (e) => {
    const inputVal = e.target.value;
    const prevVal = originalValRef.current;

    if (liveEdited && inputVal !== prevVal) {
      setLiveEdited(false);

      if (schema?.properties?.[key]) {
        delete schema.properties[key].isEdited;
      }
    }
  };

  useEffect(() => {
    if (!rowRef.current || !editing) return;
    const input = rowRef.current.querySelector('input, textarea, select');
    if (!input) return;
    input.addEventListener('input', handleUserTyping);
    return () => input.removeEventListener('input', handleUserTyping);
  }, [editing, liveEdited]);

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
      if (!inRow && !isInMuiPicker(next)) setEditing(false);
    });
  };

  return (
    <Box
      ref={rowRef}
      onBlur={onRowBlur}
      p={0}
      sx={{
        backgroundColor: liveEdited ? '#ECF5FB' : 'transparent',
        borderRadius: 0,
        transition: 'background-color 0.25s ease',
      }}
    >
      <Box
        display='grid'
        gridTemplateColumns={`${labelPlacement === 'auto' ? '' : '33% '} 1fr auto`}
        alignItems='center'
        columnGap={1}
      >
        {labelPlacement === 'left' && (
          <Box>
            <Typography variant='body2' fontWeight={600}>
              {labelText}
              {isRequired && (
                <Typography component='span' color='error'>
                  &nbsp;*
                </Typography>
              )}
            </Typography>
          </Box>
        )}

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
               onEvaluate={({ isMismatch, rawValue }) => {
                 setLiveMismatch(isMismatch);
               setCurrentRawValue(rawValue); 
  }}
            />
          )}
        </Box>

        <Box justifySelf='end' alignSelf='start' pt={3} display='flex' alignItems='center'>
     
          {liveMismatch && !liveEdited && (
            <Tooltip title={'Expected other value'}>
              <WarningIcon fontSize='small' sx={{ color: 'orange', mr: 0.5 }} />
            </Tooltip>
          )}

          {liveEdited && !editing && (
            <Tooltip
              title={
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 500, color: 'white' }}>
                  {(() => {
                    const originalVal =
                      propSchema?.options?.originalVal ??
                      propSchema?.options?.refVal ??
                      '—';

                    const currentVal =
                      currentRawValue ??
                      propSchema?.displayValue ??
                      propSchema?.options?.val ??
                      '—';

                    const unit = propSchema?.options?.unit ? ` ${propSchema.options.unit}` : '';

                    return `Edit suggestion to update ${originalVal}${unit} to ${currentVal}${unit}`;
                  })()}
      </Typography>
              }
              arrow
            >
              <Box display='flex' alignItems='center' mr={1}>
                <Typography
                  variant='caption'
                  sx={{ color: '#1976d2', fontWeight: 600, mr: 0.5 }}
                >
                  Edit Request
                </Typography>
                <AssignmentLateIcon fontSize='small' sx={{ color: '#1976d2' }} />
              </Box>
            </Tooltip>
          )}

          {!editing ? (
            <Tooltip
              title={
                disabledForm
                  ? 'Editing is disabled'
                  : !canEdit
                  ? 'This property is not editable'
                  : 'Edit value'
              }
            >
              <span>
                <IconButton
                  size='small'
                  onClick={() => canEdit && !disabledForm && setEditing(true)}
                  disabled={disabledForm || !canEdit}
                >
                  {(!canEdit || disabledForm) ? (
                    <InfoOutlined fontSize='small' />
                  ) : (
                    <EditIcon fontSize='small' />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title='Close edit'>
              <IconButton size='small' onClick={() => setEditing(false)}>
                <CloseIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          )}

          {canModify && (
            <Tooltip title='Modify Property'>
              <span>
                <IconButton
                  size='small'
                  onClick={() => onOpenModify?.(key)}
                  disabled={disabledForm}
                >
                  <SettingsOutlined fontSize='small' />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {canDelete && (
            <Tooltip title='Delete Property'>
              <span>
                <IconButton
                  size='small'
                  onClick={() => onOpenDelete?.(key)}
                  disabled={disabledForm}
                >
                  <DeleteForeverOutlined fontSize='small' />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Divider
        sx={{
          mt: 0.5,
          borderBottomWidth: '0px',
          height: '1px',
          backgroundColor: '#e7e7e7',
        }}
      />
    </Box>
  );
}
