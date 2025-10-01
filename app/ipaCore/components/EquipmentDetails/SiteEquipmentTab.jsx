import React, { useState, useContext } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { Box, Typography } from '@material-ui/core'
import TreeView from '@material-ui/lab/TreeView'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'
import SearchIcon from '@material-ui/icons/Search'
import { CircularProgress } from "@material-ui/core"

import _ from 'lodash'

import SiteEquipTreeSearch from './SiteEquipTreeSearch'
import { 
  getAllDescendantIds, 
  findNodeById, 
  findParent, 
  countThirdLevel, 
  getMatchingIdsAndDescendants, 
  expandAllParents 
} from './utils/treeHelpers'
import { ModelContext } from '../../contexts/ModelContext'

import './SiteEquipmentTab.scss'

const focusLogsInViewer = async (thirdLevelSelected, setSliceElementsByQuery) => {
    const elementIds = ["RCP-900-011", "RCP-900-012", "RCP-900-013", "RCP-900-014"]

    if (!thirdLevelSelected) return

  const selectedIds =
    thirdLevelSelected === 1
      ? [elementIds[0]]
      : thirdLevelSelected >= 4
      ? [...elementIds]
      : elementIds.slice(0, thirdLevelSelected)

  await setSliceElementsByQuery?.([
    {
      propRef: { property: { propertyType: "instance" } },
      queryPartial: { 'properties.Mark.val': { $in: selectedIds } }
    }
  ])
}

const useStyles = makeStyles(theme => ({
  root: {
    height: "100%",
    flexGrow: 1,
    maxWidth: 400,
    overflowY: "auto",
    marginTop: '16px'
  },
  customIcon: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '16px',
    width: '16px',
    color: '#999',
  }
}))

export default function SiteEquipmentTab({levelData, loadingLevelData, hasFetched}) {
  const classes = useStyles()
  const { setSliceElementsByQuery } = useContext(ModelContext)

  const [expanded, setExpanded] = useState([])
  const [checkedItems, setCheckedItems] = useState({})
  const [searchText, setSearchText] = useState('')
  const [thirdLevelCount, setThirdLevelCount] = useState(0)

  const handleNodeToggle = (_, nodes) => setExpanded(nodes)

  const handleCheck = (id, isChecked, node = null, tree = levelData) => {
    if (!node) node = findNodeById(tree, id)
    const descendantIds = getAllDescendantIds(node?.children || [])

    setCheckedItems(prev => {
      let updated = { ...prev }

      // Toggle current node
      isChecked ? (updated[id] = true) : delete updated[id]

      // Toggle all descendants
      descendantIds.forEach(childId => {
        isChecked ? (updated[childId] = true) : delete updated[childId]
      })

      // Cascade selection to parents
      if (isChecked) {
        let parent = findParent(tree, id)
        while (parent) {
          updated[parent.id] = true
          parent = findParent(tree, parent.id)
        }
      } else {
        let parent = findParent(tree, id)
        while (parent) {
          const allChildrenUnchecked = parent.children.every(child => !updated[child.id])
          if (allChildrenUnchecked) delete updated[parent.id]
          parent = findParent(tree, parent.id)
        }
      }

      // Count checked third-level items and trigger viewer update
      const thirdCount = countThirdLevel(tree, updated)
      setThirdLevelCount(thirdCount)
      focusLogsInViewer(thirdCount, setSliceElementsByQuery)

      return updated
    })

    // Expand or collapse descendants
    setExpanded(prevExpanded => {
      let newExpanded = [...prevExpanded]
      if (isChecked) {
        if (!newExpanded.includes(id)) newExpanded.push(id)
        descendantIds.forEach(childId => {
          if (!newExpanded.includes(childId)) newExpanded.push(childId)
        })
      } else {
        newExpanded = newExpanded.filter(nodeId => !descendantIds.includes(nodeId))
      }
      return newExpanded
    })
  }

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const query = searchText.trim()
    if (!query) return

    // Find all matching node IDs
    const matchedIds = getMatchingIdsAndDescendants(levelData, query)

    // Auto-check them
    setCheckedItems(prev => {
      const updated = { ...prev }
      matchedIds.forEach(id => (updated[id] = true))
      return updated
    })

    // Expand all parent paths for matches
    const newExpanded = Array.from(expandAllParents(levelData, matchedIds))
    setExpanded(newExpanded)

    // Update viewer focus
    const thirdCount = countThirdLevel(levelData, Object.fromEntries(matchedIds.map(id => [id, true])))
    setThirdLevelCount(thirdCount)
    focusLogsInViewer(thirdCount, setSliceElementsByQuery)
  };

  const renderTree = nodes =>
    nodes?.map(node => (
      <SiteEquipTreeSearch
        key={node.id}
        nodeId={node.id}
        labelText={node.name}
        checked={!!checkedItems[node.id]}
        onCheck={(id, checked) => handleCheck(id, checked, node, levelData)}
      >
        {node.children ? renderTree(node.children) : null}
      </SiteEquipTreeSearch>
    ));

  return (
    <>
    {loadingLevelData ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={6}>
          <CircularProgress />
        </Box>
      ) : hasFetched && _.isEmpty(levelData) ? (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={6}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Sorry, there are no site equipments to show.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Try selecting a different filter or building.
          </Typography>
        </Box>
      ) : (
        <>
          <div className="search-bar-container">
            <input
              type="text"
              placeholder="Search by ID"
              className="search-bar-input"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <SearchIcon className={classes.customIcon} />
          </div>
          <TreeView
            className={classes.root}
            defaultCollapseIcon={<ArrowDropDownIcon style={{ color: '#EBEBEB' }} />}
            defaultExpandIcon={<ArrowRightIcon style={{ color: '#EBEBEB' }} />}
            expanded={expanded}
            onNodeToggle={handleNodeToggle}
          >
            {renderTree(levelData)}
          </TreeView>
        </>
      )}
    </>
  )
}