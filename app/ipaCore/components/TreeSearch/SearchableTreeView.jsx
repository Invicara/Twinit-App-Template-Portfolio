import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import TreeView from "@material-ui/lab/TreeView";
import Typography from "@material-ui/core/Typography";
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ArrowRightIcon from '@material-ui/icons/ArrowRight';
import TreeItem from "@material-ui/lab/TreeItem";
import Checkbox from "@material-ui/core/Checkbox";

const useTreeItemStyles = makeStyles((theme) => ({
  labelRoot: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0.5, 0)
  },
  labelText: {
    fontWeight: "inherit",
    flexGrow: 1
  },
  root: {
    position: "relative",
    "&:before": {
      pointerEvents: "none",
      content: '""',
      position: "absolute",
      width: 16,
      left: -16,
      top: 14,
      borderBottom: (props) =>
        props.nodeId !== "1" && props.children?.length > 0
          ? `1px solid #EBEBEB`
          : "none"
    },
    "& .MuiTreeItem-root > .MuiTreeItem-content ::before": {
      content: "none",
    },
     "& .Mui-selected > .MuiTreeItem-content .MuiTreeItem-label": {
        backgroundColor: 'transparent !important'
    }
  },
  iconContainer: {
    "& .close": {
      opacity: 0.3
    }
  },
  checkbox: {
    padding: 0,
    marginRight: theme.spacing(1),
    color: '#DF158C',
    "& svg": {
      width: "12px",
      height: "12px",
      border: '2px',
      radius: '1px',
      marginLeft: '4px'
    },
  },
  group: {
    marginLeft: 7,
    paddingLeft: 18,
    borderLeft: `1px solid #EBEBEB`
  }
}));

function StyledTreeItem(props) {
  const classes = useTreeItemStyles(props);
  const { labelText, checked, onCheck, nodeId, ...other } = props;

  const handleCheckboxChange = (event) => {
    onCheck(nodeId, event.target.checked);
  };

  return (
    <TreeItem
      label={
        <div className={classes.labelRoot}>
          <Checkbox
            checked={checked}
            onChange={handleCheckboxChange}
            className={classes.checkbox}
            size="small"
            color="primary"
          />
          <Typography variant="body2" className={classes.labelText}>
            {labelText}
          </Typography>
        </div>
      }
      classes={{
        root: classes.root,
        group: classes.group,
        iconContainer: classes.iconContainer
      }}
      nodeId={nodeId}
      {...other}
    />
  );
}

const useStyles = makeStyles((theme) => ({
  root: {
    height: "100%",
    flexGrow: 1,
    maxWidth: 400,
    overflowY: "auto"
  }
}));

export default function SearchableTreeView({LevelData}) {
  const classes = useStyles();
  const [expanded, setExpanded] = React.useState([]);
  const [checkedItems, setCheckedItems] = React.useState({});

  const handleChange = (event, nodes) => {
    setExpanded(nodes);
  };

  const handleCheck = (id, isChecked) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: isChecked
    }));
  };

  const renderTree = (nodes) =>
    nodes?.map((node) => (
      <StyledTreeItem
        key={node.id}
        nodeId={node.id}
        labelText={node.name}
        checked={!!checkedItems[node.id]}
        onCheck={handleCheck}
      >
        {node.children ? renderTree(node.children) : null}
      </StyledTreeItem>
    ));

  return (
    <TreeView
      className={classes.root}
      defaultCollapseIcon={<ArrowDropDownIcon style={{color: '#EBEBEB'}}/>}
      defaultExpandIcon={<ArrowRightIcon style={{color: '#EBEBEB'}} />}
      expanded={expanded}
      onNodeToggle={handleChange}
    >
      {renderTree(LevelData)}
    </TreeView>
  );
}
