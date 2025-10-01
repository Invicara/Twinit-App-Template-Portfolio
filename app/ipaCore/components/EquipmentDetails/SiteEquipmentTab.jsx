import React, { useState, useContext } from 'react'

import { makeStyles } from '@material-ui/core/styles';
import {Box, Typography} from "@material-ui/core";
import TreeView from "@material-ui/lab/TreeView";
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ArrowRightIcon from '@material-ui/icons/ArrowRight';
import TreeItem from "@material-ui/lab/TreeItem";
import Checkbox from "@material-ui/core/Checkbox";

import { ModelContext } from "../../contexts/ModelContext";


const focusLogsInViewer = async (thirdLevelSelected, setSliceElementsByQuery) => {
    const elementIds = ["RCP-900-011", "RCP-900-012", "RCP-900-013", "RCP-900-014"]

    if (!thirdLevelSelected) return

     let selectedIds = [];

    if (thirdLevelSelected === 1) {
      selectedIds = [elementIds[0]]
    } else if (thirdLevelSelected === 2 || thirdLevelSelected === 3) {
      selectedIds = elementIds.slice(0, thirdLevelSelected)
    } else if (thirdLevelSelected >= 4) {
      selectedIds = [...elementIds]
    }

    const result = await setSliceElementsByQuery?.([
      {
        propRef: { property: { propertyType: "instance" } },
        queryPartial: { 'properties.Mark.val': { $in: selectedIds } }
      }
    ]);
  };

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
}))

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
    overflowY: "auto",
    marginTop: '16px'
  }
}))

export default function SiteEquipmentTab({levelData, loadingLevelData}) {
  const classes = useStyles()
  const [expanded, setExpanded] = useState([])
  const [checkedItems, setCheckedItems] = useState({})


  const { setSliceElementsByQuery, sliceElements, isBottomECPanelOpen, setIsBottomECPanelOpen } = useContext(ModelContext)

  const handleChange = (event, nodes) => {
    setExpanded(nodes)
  };

const [thirdLevelCount, setThirdLevelCount] = useState(0);

const handleCheck = (id, isChecked, node = null, tree = levelData) => {
   // Helper: collect all descendant IDs (for check/uncheck & expand)
  const getAllDescendantIds = (children = []) => {
    let ids = []
    children.forEach(child => {
      ids.push(child.id)
      if (child.children) {
        ids = ids.concat(getAllDescendantIds(child.children))
      }
    })
    return ids
  };

  // Helper: find a node by ID
  const findNodeById = (nodes, targetId) => {
    for (let n of nodes) {
      if (n.id === targetId) return n
      if (n.children) {
        const found = findNodeById(n.children, targetId)
        if (found) return found
      }
    }
    return null
  }

  // Helper: find parent node
  const findParent = (nodes, childId, parent = null) => {
    for (let n of nodes) {
      if (n.id === childId) return parent
      if (n.children) {
        const res = findParent(n.children, childId, n)
        if (res) return res
      }
    }
    return null
  }

  // Ensure we have the latest node data (if `node` is not passed)
  if (!node) {
    node = findNodeById(tree, id)
  }

  const descendantIds = getAllDescendantIds(node?.children || [])

  setCheckedItems(prev => {
    let updated = { ...prev }

    // Add/remove the clicked node
    if (isChecked) updated[id] = true
    else delete updated[id]

    // Add/remove all descendants
    descendantIds.forEach(childId => {
      if (isChecked) updated[childId] = true
      else delete updated[childId]
    })

    // Cascade selection up to parents
    if (isChecked) {
      let parent = findParent(tree, id)
      while (parent) {
        updated[parent.id] = true
        parent = findParent(tree, parent.id)
      }
    } else {
      // Uncheck parent if no children remain selected
      let parent = findParent(tree, id)
      while (parent) {
        const allChildrenUnchecked = parent.children.every(
          (child) => !updated[child.id]
        )
        if (allChildrenUnchecked) {
          delete updated[parent.id]
        }
        parent = findParent(tree, parent.id)
      }
    }

    // Count checked third-level nodes
    const countThirdLevel = (nodes, depth = 1) => {
      let count = 0
      nodes?.forEach(node => {
        if (depth === 3 && updated[node.id]) count++
        if (node.children) count += countThirdLevel(node.children, depth + 1)
      })
      return count
    };

    const thirdCount = countThirdLevel(tree)
    setThirdLevelCount(thirdCount)
    focusLogsInViewer(thirdCount, setSliceElementsByQuery)

    return updated
  })

  // Expand or collapse descendants
  setExpanded(prevExpanded => {
    let newExpanded = [...prevExpanded]
    if (isChecked) {
      // Add this node and all descendants to expanded
      if (!newExpanded.includes(id)) newExpanded.push(id)
      descendantIds.forEach(childId => {
        if (!newExpanded.includes(childId)) newExpanded.push(childId)
      })
    } else {
      // Remove descendants from expanded
      newExpanded = newExpanded.filter(nodeId => !descendantIds.includes(nodeId))
    }
    return newExpanded
  })

}

  const renderTree = (nodes) =>
    nodes?.map((node) => (
      <StyledTreeItem
        key={node.id}
        nodeId={node.id}
        labelText={node.name}
        checked={!!checkedItems[node.id]}
        onCheck={(id, checked) => handleCheck(id, checked, node, levelData)}
      >
        {node.children ? renderTree(node.children) : null}
      </StyledTreeItem>
    ));

  return (
    <>
        {!loadingLevelData && _.isEmpty(levelData) ?
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                py={6}
            >
                <Typography variant="h6" color="textSecondary" gutterBottom>
                Sorry, there are no site equipments to show.
                </Typography>
                <Typography variant="body2" color="textSecondary">
                Try selecting a different filter or building.
                </Typography>
            </Box>
        : loadingLevelData ? 
            <p>Loading data....</p>
        :  
            <TreeView
                className={classes.root}
                defaultCollapseIcon={<ArrowDropDownIcon style={{color: '#EBEBEB'}}/>}
                defaultExpandIcon={<ArrowRightIcon style={{color: '#EBEBEB'}} />}
                expanded={expanded}
                onNodeToggle={handleChange}
            >
                {renderTree(levelData)}
            </TreeView>
        }
     </>
  );
}