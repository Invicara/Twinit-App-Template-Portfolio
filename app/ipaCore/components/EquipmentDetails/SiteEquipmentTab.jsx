// SiteEquipmentTab.jsx
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
  expandAllParents,
  getSelectedThirdLevelIds,
  findNodeAndDescendants,
  calculateTreeSelectionState
} from './utils/treeHelpers'
import { ModelContext } from '../../contexts/ModelContext'

import './SiteEquipmentTab.scss'

const focusLogsInViewer = async (
  setSliceElementsByQuery, 
  setSiteEquipment,
  selectedSiteEquipId,
  data
) => {
  const elementIds = ["RCP-900-011", "RCP-900-012", "RCP-900-013", "RCP-900-014"]
  let selectedIds = []
  let rejectedIDs = []

  selectedSiteEquipId.forEach((siteEquipId) => {
    if (elementIds.includes(siteEquipId)) {
      selectedIds.push(siteEquipId)
    } else {
      // BUG #2 - Need to pass through equipment ID instead of Site Equipment ID
      rejectedIDs.push(siteEquipId)
    }
  })

  // update the 3D viewer
  await setSliceElementsByQuery?.([
    {
      propRef: { property: { propertyType: "instance" } },
      queryPartial: { 'properties.Mark.val': { $in: selectedIds } }
    }
  ])

  function findLogsByEquipIds(data, equipIds) {
    return data
      .map(obj => {
        const matchingLogs = (obj.logs || []).filter(log =>
          equipIds.includes(log["Equipment Id"])
        )
        return matchingLogs.length > 0
          // ? { ecId: obj.id, logs: matchingLogs }
          ? { logs: matchingLogs }
          : null
      })
      .filter(Boolean)
  }

  const EcLogs = findLogsByEquipIds(data, selectedSiteEquipId)

  // push into ModelContext like EngineeringChangesTab does

  // BUG #1 - causing undefined error here when selecting SE with no associated EC
  setSiteEquipment({
     data: EcLogs[0]?.logs,
    EC: {} // nothing here yet
  })

  return rejectedIDs
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
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '16px',
    width: '16px',
    color: '#999',
    cursor: 'pointer'
  }
}))

export default function SiteEquipmentTab({levelData, loadingLevelData, hasFetched, data}) {
  const classes = useStyles()
  const { setSliceElementsByQuery, setSiteEquipment, setIsBottomECPanelOpen } = useContext(ModelContext)

  const [expanded, setExpanded] = useState([])
  const [checkedItems, setCheckedItems] = useState({})
  const [searchText, setSearchText] = useState('')
  const [rejectedIds, setRejectedIds] = useState()
  const [indeterminateItems, setIndeterminateItems] = useState({})

  const handleNodeToggle = (_, nodes) => setExpanded(nodes)

  const handleCheck = (id, isChecked, node = null, tree = levelData) => {
    if (!node) node = findNodeById(tree, id)
    const descendantIds = getAllDescendantIds(node?.children || [])

    setCheckedItems(prev => {
      let updated = { ...prev }

      // Toggle current node + descendants
      if (isChecked) {
        updated[id] = true
        descendantIds.forEach(childId => (updated[childId] = true))
      } else {
        delete updated[id]
        descendantIds.forEach(childId => delete updated[childId])
      }

      // Recalculate full tree selection + indeterminate states
      const { checkedItems: cleanedChecked, indeterminateItems: newIndeterminate } =
        calculateTreeSelectionState(tree, updated)

      setIndeterminateItems(newIndeterminate)

      // Update viewer focus
      const selectedSiteEquipId = getSelectedThirdLevelIds(tree, cleanedChecked)
      focusLogsInViewer(setSliceElementsByQuery, setSiteEquipment, selectedSiteEquipId, data).then((value) => {
        setRejectedIds(value)
        if (selectedSiteEquipId.length > 0) {
          setIsBottomECPanelOpen(true)
        }
      })

      return cleanedChecked
    })

    // Expand/collapse descendants visually
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
    if (e.type === 'keydown' && e.key !== 'Enter') return
    const query = searchText.trim()
    if (!query) return

    const matchedIds = findNodeAndDescendants(levelData, query)

    setCheckedItems(prev => {
      const updated = { ...prev }
      matchedIds.forEach(id => (updated[id] = true))

      const thirdLevelIds = getSelectedThirdLevelIds(levelData, updated)
      focusLogsInViewer(setSliceElementsByQuery, setSiteEquipment, thirdLevelIds).then((value) => {
        setRejectedIds(value)
        if (thirdLevelIds.length > 0) {
          setIsBottomECPanelOpen(true)
        }
      })

      return updated
    })

    const { checkedItems: cleanedChecked, indeterminateItems: newIndeterminate } =
    calculateTreeSelectionState(levelData, updated)

    setCheckedItems(cleanedChecked)
    setIndeterminateItems(newIndeterminate)

    // Expand all parent paths for matches
    const newExpanded = Array.from(expandAllParents(levelData, matchedIds))
    setExpanded(newExpanded)
  }

  const renderTree = nodes =>
    nodes?.map(node => (
      <SiteEquipTreeSearch
        key={node.id}
        nodeId={node.id}
        labelText={node.name}
        checked={!!checkedItems[node.id]}
        indeterminate={!!indeterminateItems[node.id]}
        onCheck={(id, checked) => handleCheck(id, checked, node, levelData)}
      >
        {node.children ? renderTree(node.children) : null}
      </SiteEquipTreeSearch>
    ))

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
            <SearchIcon className={classes.customIcon} onClick={handleSearchKeyDown}/>
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
          {rejectedIds && rejectedIds.length > 0 && (
            <div style={{marginTop: '16px'}}>
              <p>No model elements found for the following site equipment:</p>
              <ul style={{ listStyleType: "disc", paddingLeft: "1.5rem" }}>
                {rejectedIds.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  )
}
