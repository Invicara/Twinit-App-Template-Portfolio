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

            setCheckedItems(prev => {
                const next = { ...prev }
                children.forEach(child => {
                    if (child.level === 5) delete next[child.id]
                })
                return next
            })

           setIndeterminateItems(prev => {
                const next = { ...prev }

                const parentIsIndeterminate = !!prev[nodeId]
                const parentIsChecked = !!checkedItems[nodeId]

                children.forEach(child => {
                    if (parentIsChecked) {
                        // Parent fully checked → child fully checked
                        delete next[child.id]
                        setCheckedItems(prevChecked => ({ ...prevChecked, [child.id]: true }))
                        
                        // Add level 5 nodes to selectedSiteEquipment
                        if (child.level === 5) {
                            setSelectedSiteEquipment(prev => {
                                const prevList = Array.isArray(prev) ? prev : []
                                if (!prevList.includes(child.name)) {
                                    return [...prevList, child.name]
                                }
                                return prevList
                            })
                        }
                    } else if (parentIsIndeterminate) {
                        // Parent indeterminate → child should be CHECKED for level 5, indeterminate otherwise
                        if (child.level === 5) {
                            delete next[child.id]
                            setCheckedItems(prevChecked => ({ ...prevChecked, [child.id]: true }))
                            
                            // Add level 5 nodes to selectedSiteEquipment
                            setSelectedSiteEquipment(prev => {
                                const prevList = Array.isArray(prev) ? prev : []
                                if (!prevList.includes(child.name)) {
                                    return [...prevList, child.name]
                                }
                                return prevList
                            })
                        } else {
                            delete checkedItems[child.id]
                            next[child.id] = true
                        }
                    } else {
                        // Parent unchecked → child unchecked
                        delete next[child.id]
                        delete checkedItems[child.id]
                    }
                })
                return next
            })

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
            const parentIsIndeterminate = !!indeterminateItems[newlyExpanded]
            const node = findNodeById(treeRef.current, newlyExpanded)

            if (node && node.children) {
                setIndeterminateItems(prev => {
                    const next = { ...prev }

                    node.children.forEach(child => {
                        // Only mark as indeterminate if parent is indeterminate
                        if (parentIsIndeterminate) {
                            delete checkedItems[child.id]
                            next[child.id] = true
                        } else {
                            // Otherwise, ensure they’re completely unchecked
                            delete next[child.id]
                            delete checkedItems[child.id]
                        }
                    })

                    return next
                })
            }
        }
    }

    const handleCheck = (id, isChecked, node = null) => {
        if (!node) return
        const level = node.level

        // Work on copies of current maps so we can update ancestors deterministically
        let newChecked = { ...checkedItems }
        let newIndeterminate = { ...indeterminateItems }

        // Collect level-5 items to add/remove from selectedSiteEquipment in batch
        const toAddLevel5 = new Set()
        const toRemoveLevel5 = new Set()

        /**
         * toggleDescendants(children, action)
         * action = 'checkLeaves'  => mark leaf (level 5) as checked, non-leaf as indeterminate
         * action = 'indeterminate' => mark non-leaf as indeterminate, leave leaves unchanged (if desired)
         * action = 'uncheck' => remove checked/indeterminate for all descendants
         */
        const toggleDescendants = (children, action) => {
            if (!children) return

            children.forEach(child => {
                const isLeaf = child.level === 5

                if (action === 'checkLeaves') {
                    if (isLeaf) {
                        newChecked[child.id] = true
                        delete newIndeterminate[child.id]
                        if (child.name) toAddLevel5.add(child.name)
                    } else {
                        // non-leaf => indeterminate
                        delete newChecked[child.id]
                        newIndeterminate[child.id] = true
                    }
                } else if (action === 'indeterminate') {
                    if (!isLeaf) {
                        delete newChecked[child.id]
                        newIndeterminate[child.id] = true
                    }
                } else if (action === 'uncheck') {
                    if (isLeaf && newChecked[child.id]) {
                        toRemoveLevel5.add(child.name)
                    }
                    delete newChecked[child.id]
                    delete newIndeterminate[child.id]
                }

                toggleDescendants(child.children, action)
            })
        }

        const updateAncestors = (tree, targetId) => {
            const ancestorIds = getAncestorIds(tree, targetId)

            // Iterate from the bottom-most ancestor up toward the root
            for (let i = ancestorIds.length - 1; i >= 0; i--) {
                const ancestorId = ancestorIds[i];
                const ancestorNode = findNodeById(tree, ancestorId)
                if (!ancestorNode || !ancestorNode.children) continue

                const childStates = ancestorNode.children.map(child => ({
                    checked: !!newChecked[child.id],
                    indeterminate: !!newIndeterminate[child.id],
                }));

                const allChecked = childStates.length > 0 && childStates.every(s => s.checked)
                const anyCheckedOrIndeterminate = childStates.some(s => s.checked || s.indeterminate)

                if (allChecked) {
                    newChecked[ancestorId] = true
                    delete newIndeterminate[ancestorId]
                } else if (anyCheckedOrIndeterminate) {
                    delete newChecked[ancestorId]
                    newIndeterminate[ancestorId] = true
                } else {
                    delete newChecked[ancestorId]
                    delete newIndeterminate[ancestorId]
                }
            }
        }

        const wasChecked = !!newChecked[id]
        const wasIndeterminate = !!newIndeterminate[id]

        if (level === 5) {
            // Leaf toggle: toggle its checked state and update selectedSiteEquipment
            if (wasChecked || wasIndeterminate) {
                delete newChecked[id]
                delete newIndeterminate[id]
                if (node.name) toRemoveLevel5.add(node.name)
            } else {
                newChecked[id] = true
                delete newIndeterminate[id]
            if (node.name) toAddLevel5.add(node.name)
            }
        } else {
            // Level 1-4 clicked
            if (wasChecked || wasIndeterminate) {
                // Uncheck this node and all descendants
                delete newChecked[id]
                delete newIndeterminate[id]
                toggleDescendants(node.children, 'uncheck')
            } else {
                // Select parent: parent becomes indeterminate, non-leaf children become indeterminate,
                // leaf (level 5) children become checked
                delete newChecked[id];
                newIndeterminate[id] = true;
                toggleDescendants(node.children, 'checkLeaves')
            }
        }

        // Recompute ancestors now that newChecked/newIndeterminate reflect descendant changes
        updateAncestors(treeRef.current, id)

        // Apply batch updates to selectedSiteEquipment
        if (toAddLevel5.size > 0 || toRemoveLevel5.size > 0) {
            setSelectedSiteEquipment(prev => {
                const prevList = Array.isArray(prev) ? prev.slice() : []

                // remove items
                const filtered = prevList.filter(name => !toRemoveLevel5.has(name))

                // add new, preserving uniqueness
                toAddLevel5.forEach(name => {
                    if (!filtered.includes(name)) filtered.push(name)
                })

                return filtered
            })
        }

        // Commit the checked/indeterminate maps once
        setCheckedItems(newChecked)
        setIndeterminateItems(newIndeterminate)
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
    >
        {renderTree(initialTreeLevels)}
    </TreeView>
  )
};

export default AssetTree;