import React, { useEffect, useState, useRef } from "react";

import { makeStyles } from '@material-ui/core/styles'
import TreeView from '@material-ui/lab/TreeView'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'

import { getInitialTreeLevels, getSystemLevel, getEquipTypeLevel, getEquipLevel } from '../../../services/assetTree'
import { getAllDescendantIds, findNodeById,calculateAssetTreeSelectionState, getAncestorIds } from '../../components/EquipmentDetails/utils/treeHelpers'

import EntityTreeSearch from '../../components/EquipmentDetails/EntityTreeSearch'

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    overflowY: 'visible'
  }
}))

const AssetTree = ({loadingNodes, setLoadingNodes, setSelectedSiteEquipment, setTableData}) => {
    const [initialTreeLevels, setInitialTreeLevels] = useState()
    const [expanded, setExpanded] = useState([])
    const [checkedItems, setCheckedItems] = useState({})
    const [indeterminateItems, setIndeterminateItems] = useState({})
    const [selected, setSelected] = useState(null)

    function useSyncedRef(value) {
        const ref = useRef(value)
        useEffect(() => { ref.current = value }, [value])
        return ref
    }

    const treeRef = useSyncedRef(initialTreeLevels)

    const classes = useStyles()

    useEffect(() => {
        const fetchData = async() => {
            const result = await getInitialTreeLevels()
            setInitialTreeLevels(result)
            setLoadingNodes({}, false)
        }
      fetchData()
    }, [])

    const setNodeLoading = (nodeId, isLoading) => {
        setLoadingNodes(prev => ({
            ...prev,
            [nodeId]: isLoading,
        }))
    }

    const transformToTreeNodes = (nodeId, structureName, items, level) => {
        if (!items) return []

        return items.map((item, index) => {
            if (typeof item === "string") {
            return {
                id: `${nodeId}/${item}`,
                name: item,
                level,
                structureName,
                children: level === 5 ? [] : [{}],
            }
            }
        })
    }

    const addChildrenToNode = (tree, nodeId, children) => {
        return tree.map(node => {
            if (node.id === nodeId) {
                return { ...node, children }
            } else if (node.children) {
                return { ...node, children: addChildrenToNode(node.children, nodeId, children) }
            }
            return node
        })
    }

    const loadChildrenForNode = async (nodeId, deep = false) => {
        const node = findNodeById(initialTreeLevels, nodeId)
        if (!node) {
            console.warn("Node not found:", nodeId)
            return []
        }

        const hasRealChildren = node.children?.length && node.children.some(child => child.id !== undefined)

        if (hasRealChildren && !deep) {
            return node.children
        }
        setNodeLoading(nodeId, true)

        try {
            let children = []

            if (node.level === 1) {
                const unitPromises = (node.children || []).map(unit => loadChildrenForNode(unit.id, deep))
                children = await Promise.all(unitPromises)
                children = children.flat()
            } else if (node.level === 2) {
                const systems = await getSystemLevel(node.structureName)
                children = transformToTreeNodes(node.id, node.structureName, systems, 3)
            } else if (node.level === 3) {
                const equipTypes = await getEquipTypeLevel(node.id, node.structureName)
                children = transformToTreeNodes(node.id, node.structureName, equipTypes, 4)
            } else if (node.level === 4) {
                const equipmentData = await getEquipLevel(node.id, node.structureName)
                const siteEquipIds = equipmentData.map((data, idx) => data.nameId)
                children = transformToTreeNodes(node.id, node.structureName, siteEquipIds, 5)
                
                setTableData(prev => {
                    const dataMap = new Map()
                    if (Array.isArray(prev)) {
                        prev.forEach(item => dataMap.set(item.nameId, item))
                    }
                    
                    equipmentData.forEach(item => dataMap.set(item.nameId, item))
                    
                    return Array.from(dataMap.values())
                })
            }

            setInitialTreeLevels(prev => addChildrenToNode(prev, nodeId, children))

            // Recursively load deeper levels if deep = true
            if (deep && children.length > 0) {
                await Promise.all(children.map(child => loadChildrenForNode(child.id, true)))
            }

            return children
        } catch (err) {
            console.error("Error loading node children:", err)
            return []
        } finally {
            setLoadingNodes({}, false)
        }
    }

    const handleNodeToggle = async (event, nodeIds) => {
        const newlyExpanded = nodeIds.find(id => !expanded.includes(id))
        setExpanded(nodeIds)
        if (newlyExpanded) {
            await loadChildrenForNode(newlyExpanded)
        }
    }
    
    const handleNodeSelect = async (event, nodeId) => {
        setSelected(nodeId)
        const isAlreadyExpanded = expanded.includes(nodeId)
        
        if (!isAlreadyExpanded) {
            setExpanded(prev => [...prev, nodeId])
            await loadChildrenForNode(nodeId)
        }
    }

    const handleCheck = (id, isChecked, node = null) => {
        if (!node) node = findNodeById(treeRef.current, id)
        if (!node) return

        // If checking a non-leaf (levels 1-4), load children first
        if (isChecked && node.level < 5) {
            const ancestorIds = getAncestorIds(treeRef.current, id)
            // Immediately give UI feedback: mark node + ancestors as indeterminate
            setIndeterminateItems(prev => {
                const next = { ...prev }
                ;[id, ...ancestorIds].forEach(a => { next[a] = true })
                return next
            })

            // Ensure the non-leaf itself is not set as checked prematurely
            setCheckedItems(prev => {
                const next = { ...prev }
                delete next[id]
                return next
            })

            loadChildrenForNode(id, true)
                .then(async () => {
                    // Wait one tick for tree state to settle
                    await Promise.resolve()

                    setCheckedItems(prevChecked => {
                        const {checkedItems: newChecked, indeterminateItems: newIndeterminate} = calculateAssetTreeSelectionState(treeRef.current, prevChecked)

                        setIndeterminateItems(newIndeterminate)

                        return newChecked
                    })
                })
                .catch(err => console.error("loadChildrenForNode failed:", err))

            return
        }

        const descendantIds = getAllDescendantIds(node?.children || [])

        if (node.level === 5) {
            // Update selected site equipment list
            setSelectedSiteEquipment(prev => {
                const currentSelectedSE = Array.isArray(prev) ? [...prev] : []
                if (isChecked) {
                    if (!currentSelectedSE.includes(node.name)) currentSelectedSE.push(node.name)
                } else {
                    return currentSelectedSE.filter(n => n !== node.name)
                }
                return currentSelectedSE
            })
        }

        // Update checkedItems and calculate indeterminate states
        setCheckedItems(prev => {
            const updated = { ...prev }

            if (isChecked) {
                // Only mark this specific node (level 5)
                updated[id] = true
                
                // Mark any descendants if they exist
                descendantIds.forEach(childId => {
                    updated[childId] = true
                })
            } else {
                // Unchecking - remove this node and descendants
                delete updated[id]
                descendantIds.forEach(childId => delete updated[childId])
            }

            // Calculate indeterminate states based on updated checked items
            const { checkedItems: cleanedChecked, indeterminateItems: newIndeterminate } = calculateAssetTreeSelectionState(treeRef.current, updated)
            
            // Update indeterminate states
            setIndeterminateItems(newIndeterminate)
            return cleanedChecked
        })
    }

    const renderTree = (nodes) => {
        return nodes?.map(node => {

            if (!node || !node.id) return null

            const isLeaf = node.level === 5 || !node.children?.length

            return (
                <EntityTreeSearch
                    key={node.id}
                    nodeId={node.id}
                    labelText={node.name}
                    checked={!!checkedItems[node.id]}
                    indeterminate={!!indeterminateItems[node.id]}
                    onCheck={(id, checked) => handleCheck(id, checked, node)}
                    loadingNodes={loadingNodes[node.id]}
                    expandIcon={
                        !isLeaf ? (
                            <ArrowRightIcon style={{ color: "#dbdbdb", fontSize: "25px" }} />
                        ) : null
                    }
                    collapseIcon={
                        !isLeaf ? (
                            <ArrowDropDownIcon style={{ color: "#dbdbdb", fontSize: "25px" }} />
                        ) : null
                    }
                >
                    {node.children ? renderTree(node.children) : null}
                </EntityTreeSearch>
            )
        })
    }

  return (
    <TreeView
        className={classes.root}
        expanded={expanded}
        onNodeToggle={handleNodeToggle}
        selected={selected}
        onNodeSelect={(e, nodeId) => handleNodeSelect(e, nodeId)}
    >
        {renderTree(initialTreeLevels)}
    </TreeView>
  )
};

export default AssetTree;