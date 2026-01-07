import React, { useEffect, useState, useRef } from "react";

import { makeStyles } from '@material-ui/core/styles'
import TreeView from '@material-ui/lab/TreeView'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'

import { getInitialTreeLevels, getEquipTypeLevel, getElementsLevel } from '../../../services/assetTree'
import { findNodeById, getAncestorIds } from '../../components/ElementDetails/utils/treeHelpers'

import EntityTreeSearch from '../../components/ElementDetails/EntityTreeSearch'

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    overflowY: 'visible'
  }
}))

const AssetTree = ({loadingNodes, setLoadingNodes, setSelectedElements, setTableData}) => {
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

    const hasDisplayableProperties = (properties) => {
        if (!properties || typeof properties !== 'object') return false

        return Object.values(properties).some(
            prop => Boolean(prop?.psDispName)
        )
    }

    const transformToTreeNodes = (nodeId, structureName, items, level) => {
    if (!Array.isArray(items)) return []

    return items.map((item, index) => {
        // RVT element objects
        if (item && typeof item === 'object') {
        const key = item._id || item.source_id || item.id || index

        const expandable = hasDisplayableProperties(item.properties);

        return {
            id: `${nodeId}/${key}`,
            name: item.name || String(key),
            level,
            structureName,
            element: item,
            children: expandable ? [{}] : [], 
        }
    }

        // old string case
        if (typeof item === 'string') {
        return {
            id: `${nodeId}/${encodeURIComponent(item)}`,
            name: item,
            level,
            structureName,
            children: level === 5 ? [] : [{}],
        }
        }

        return null
    }).filter(Boolean)
    }

    const propertiesToTreeNodes = (parentNode, propertiesObj) => {
  if (!propertiesObj || typeof propertiesObj !== 'object') return []

  return Object.entries(propertiesObj)
    .filter(([, propVal]) => Boolean(propVal?.psDispName))
    .map(([propKey, propVal]) => {
      const label = propVal?.dName || propKey
      const key = propVal?.id || propVal?.name || propKey

      return {
        id: `${parentNode.id}/prop/${encodeURIComponent(String(key))}`,
        name: label,
        level: parentNode.level + 1, // <- property level (likely 4)
        structureName: parentNode.structureName,
        property: propVal,    
        children: [],
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
                console.log('Loaded level 1 children for node', children);
            } else if (node.level === 2) {
                const elements = await getElementsLevel(node.structureName)
                console.log('Fetched elements for node', elements);
                children = transformToTreeNodes(node.id, node.structureName, elements, 3)
            } else if (node.level === 3) {
                if (node.element?.properties) {
                    children = propertiesToTreeNodes(node, node.element.properties)
                } else {
                    const equipTypes = await getEquipTypeLevel(node.id, node.structureName)
                    children = transformToTreeNodes(node.id, node.structureName, equipTypes, 4)
                }
            } else {
                // fallback to old behaviour if needed
                const equipTypes = await getEquipTypeLevel(node.id, node.structureName)
                children = transformToTreeNodes(node.id, node.structureName, equipTypes, 4)
            
                
                setTableData(prev => {
                    const dataMap = new Map()
                    if (Array.isArray(prev)) {
                        prev.forEach(item => dataMap.set(item.nameId, item))
                    }
                    
                    elementData.forEach(item => dataMap.set(item.nameId, item))
                    
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
                        
                        // Add level 5 nodes to selectedElements
                        if (child.level === 5) {
                            setSelectedElements(prev => {
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
                            
                            // Add level 5 nodes to selectedElements
                            setSelectedElements(prev => {
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

  let newChecked = { ...checkedItems }
  let newIndeterminate = { ...indeterminateItems }

  const toAddLevel5 = new Set()
  const toRemoveLevel5 = new Set()

  const isPropertyLeafFn = (n) => n?.level === 4 && !!n?.property

  const addPropertyRow = (prop) => ({
    Name: prop?.dName,
    ID: prop?.id,
    'Display Name': prop?.psDispName,
    'Source Type': prop?.srcType,
    'Value': prop?.val
  })

  const toAddProps = new Map() // key: String(id) -> row
  const toRemovePropIds = new Set() // Set<String(id)>

  const toggleDescendants = (children, action) => {
    if (!children) return

    children.forEach(child => {
      const isLeafEquip = child.level === 5
      const isLeafProp = isPropertyLeafFn(child)
      const isLeaf = isLeafEquip || isLeafProp

      if (action === 'checkLeaves') {
        if (isLeaf) {
          newChecked[child.id] = true
          delete newIndeterminate[child.id]

          if (isLeafEquip && child.name) toAddLevel5.add(child.name)

          if (isLeafProp) {
            const p = child.property
            toAddProps.set(String(p.id), addPropertyRow(p))
            toRemovePropIds.delete(String(p.id))
          }
        } else {
          delete newChecked[child.id]
          newIndeterminate[child.id] = true
        }
      } else if (action === 'uncheck') {
        if (isLeafEquip && newChecked[child.id]) {
          toRemoveLevel5.add(child.name)
        }

        if (isLeafProp) {
          const p = child.property
          toRemovePropIds.add(String(p.id))
          toAddProps.delete(String(p.id))
        }

        delete newChecked[child.id]
        delete newIndeterminate[child.id]
      }

      toggleDescendants(child.children, action)
    })
  }

  const updateAncestors = (tree, targetId) => {
    const ancestorIds = getAncestorIds(tree, targetId)

    for (let i = ancestorIds.length - 1; i >= 0; i--) {
      const ancestorId = ancestorIds[i]
      const ancestorNode = findNodeById(tree, ancestorId)
      if (!ancestorNode || !ancestorNode.children) continue

      const childStates = ancestorNode.children.map(child => ({
        checked: !!newChecked[child.id],
        indeterminate: !!newIndeterminate[child.id],
      }))

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
  const thisIsPropLeaf = isPropertyLeafFn(node)

  if (level === 5 || thisIsPropLeaf) {
    // leaf toggle (equipment OR property)
    if (wasChecked || wasIndeterminate) {
      delete newChecked[id]
      delete newIndeterminate[id]

      if (thisIsPropLeaf) {
        toRemovePropIds.add(String(node.property.id))
        toAddProps.delete(String(node.property.id))
      } else if (node.name) {
        toRemoveLevel5.add(node.name)
      }
    } else {
      newChecked[id] = true
      delete newIndeterminate[id]

      if (thisIsPropLeaf) {
        const p = node.property
        toAddProps.set(String(p.id), addPropertyRow(p))
        toRemovePropIds.delete(String(p.id))
      } else if (node.name) {
        toAddLevel5.add(node.name)
      }
    }
  } else {
    // parent node clicked: selects/unselects exposed descendants
    if (wasChecked || wasIndeterminate) {
      delete newChecked[id]
      delete newIndeterminate[id]
      toggleDescendants(node.children, 'uncheck')
    } else {
      delete newChecked[id]
      newIndeterminate[id] = true
      toggleDescendants(node.children, 'checkLeaves')
    }
  }

  updateAncestors(treeRef.current, id)

  if (toAddLevel5.size > 0 || toRemoveLevel5.size > 0) {
    setSelectedElements(prev => {
      const prevList = Array.isArray(prev) ? prev.slice() : []
      const filtered = prevList.filter(name => !toRemoveLevel5.has(name))
      toAddLevel5.forEach(name => {
        if (!filtered.includes(name)) filtered.push(name)
      })
      return filtered
    })
  }

  // Apply property table updates ONCE (handles parent selects + leaf toggles)
 if (toAddProps.size > 0 || toRemovePropIds.size > 0) {
  setTableData(prev => {
    const prevList = Array.isArray(prev) ? prev : []
    const map = new Map(prevList.map(r => [String(r.ID), r]))

    // removals
    toRemovePropIds.forEach(idStr => map.delete(String(idStr)))

    // additions
    toAddProps.forEach((row, idStr) => map.set(String(idStr), row))

    return Array.from(map.values())
  })
}

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