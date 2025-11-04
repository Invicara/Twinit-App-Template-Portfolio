import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import TreeItem from '@material-ui/lab/TreeItem'
import Checkbox from '@material-ui/core/Checkbox'
import { Typography } from '@material-ui/core'
import { CircularProgress } from "@material-ui/core";

const useTreeItemStyles = makeStyles(theme => ({
  labelRoot: { 
    display: 'flex', 
    alignItems: 'center', 
    padding: theme.spacing(0.5, 0) 
  },
  labelText: { 
    fontWeight: 'inherit', 
    flexGrow: 1 
  },
  checkbox: {
    padding: 0,
    marginRight: theme.spacing(1),
    color: '#DF158C',
    "&.Mui-checked": {
      color: '#DF158C'
    },
     "&.MuiCheckbox-indeterminate": {
      color: '#EF94CD',
    },
    '& svg': { 
      width: '12px', 
      height: '12px', 
      marginLeft: '4px' 
    }
  }
}))

export default function EntityTreeSearch({ labelText, checked, onCheck, nodeId, indeterminate, loadingNodes, expandIcon,  collapseIcon, ...other }) {
  const classes = useTreeItemStyles()

  return (
    <TreeItem
      nodeId={nodeId}
      expandIcon={expandIcon}
      collapseIcon={collapseIcon}
      label={
        <div className={classes.labelRoot}>
          {loadingNodes ? 
            <CircularProgress size={12} style={{ marginRight: '10px' }} />
          : 
           <Checkbox checked={checked} indeterminate={indeterminate} onChange={e => onCheck(nodeId, e.target.checked)} className={classes.checkbox} size="small" />
           }
          <Typography variant="body2" className={classes.labelText}>{labelText}</Typography>
        </div>
      }
      {...other}
    />
  )
}
