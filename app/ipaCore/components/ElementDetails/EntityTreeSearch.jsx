import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import TreeItem from '@material-ui/lab/TreeItem';
import Checkbox from '@material-ui/core/Checkbox';
import { Typography } from '@material-ui/core';
import { CircularProgress } from '@material-ui/core';

const CHECKBOX_SLOT_WIDTH = 22;

const useTreeItemStyles = makeStyles((theme) => ({
  labelRoot: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 0),
    cursor: 'pointer',
  },
  labelText: {
    fontWeight: 'inherit',
    flexGrow: 1,
  },
  checkboxSlot: {
    width: CHECKBOX_SLOT_WIDTH,
    minWidth: CHECKBOX_SLOT_WIDTH,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing(1),
  },
  checkbox: {
    padding: 0,
    marginRight: 0,
    color: '#DF158C',
    '&.Mui-checked': {
      color: '#DF158C',
    },
    '&.MuiCheckbox-indeterminate': {
      color: '#EF94CD',
    },
    '& svg': {
      width: '12px',
      height: '12px',
      marginLeft: '4px',
    },
  },
}));

export default function EntityTreeSearch({
  labelText,
  checked,
  onCheck,
  nodeId,
  indeterminate,
  loadingNodes, // boolean: true => spinner
  expandIcon,
  collapseIcon,
  showCheckbox = true,
  disableLabelClick = false, // <-- NEW
  ...other
}) {
  const classes = useTreeItemStyles();

  const toggle = () => {
    if (loadingNodes) return;
    if (disableLabelClick) return; // <-- NEW
    onCheck(nodeId, !checked);
  };

  return (
    <TreeItem
      nodeId={nodeId}
      expandIcon={expandIcon}
      collapseIcon={collapseIcon}
      onLabelClick={(e) => {
        // <-- NEW: prevent TreeItem default label expand/collapse
        if (disableLabelClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      label={
        <div
          className={classes.labelRoot}
          onClick={(e) => {
            // If label clicks are disabled (site/building), do nothing at all.
            if (disableLabelClick) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            // Otherwise: label click toggles checkbox state (your existing behavior)
            e.stopPropagation();
            toggle();
          }}
        >
          {showCheckbox ? (
            <div className={classes.checkboxSlot} onClick={(e) => e.stopPropagation()}>
              {loadingNodes ? (
                <CircularProgress size={12} />
              ) : (
                <Checkbox
                  checked={checked}
                  indeterminate={indeterminate}
                  disabled={loadingNodes}
                  onChange={(e) => onCheck?.(nodeId, e.target.checked)}
                  className={classes.checkbox}
                  size='small'
                />
              )}
            </div>
          ) : null}

          <Typography variant='body2' className={classes.labelText}>
            {labelText}
          </Typography>
        </div>
      }
      {...other}
    />
  );
}
