export const getAllDescendantIds = (children = []) => {
  let ids = []
  children.forEach(child => {
    ids.push(child.id)
    if (child.children) ids = ids.concat(getAllDescendantIds(child.children))
  })
  return ids
}

export const findNodeById = (nodes, targetId) => {
  for (let node of nodes) {
    if (node.id === targetId) return node
    if (node.children) {
      const found = findNodeById(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

export const findParent = (nodes, childId, parent = null) => {
  for (let node of nodes) {
    if (node.id === childId) return parent
    if (node.children) {
      const res = findParent(node.children, childId, node)
      if (res) return res
    }
  }
  return null
}

export const expandAllParents = (nodes, matched, parents = []) => {
  let expandedSet = new Set()
  nodes.forEach(node => {
    if (matched.includes(node.id)) {
      parents.forEach(p => expandedSet.add(p))
      expandedSet.add(node.id)
    }
    if (node.children) {
      const childExpanded = expandAllParents(node.children, matched, [...parents, node.id])
      childExpanded.forEach(e => expandedSet.add(e))
    }
  })
  return expandedSet
}

export const getSelectedThirdLevelIds = (tree, checkedItems) => {
  let result = []

  const traverse = (nodes) => {
    nodes.forEach(node => {
      if (!node.children || node.children.length === 0) {
        // It's a leaf node (3rd level)
        if (checkedItems[node.id]) {
          result.push(node.siteEquipId)
        }
      } else {
        traverse(node.children)
      }
    })
  }

  traverse(tree)
  return result
}

export const findNodeAndDescendants = (tree, query) => {
  let results = []

  const search = (nodes) => {
    for (let node of nodes) {
      if (node.name.toLowerCase().includes(query.toLowerCase())) {
        // Found a match — add it and all descendants
        results.push(node.id)
        if (node.children) {
          results.push(...getAllDescendantIds(node.children))
        }
      } else if (node.children) {
        search(node.children)
      }
    }
  }

  search(tree)
  return results
}


export const calculateTreeSelectionState = (tree, checkedItems) => {
  const updated = { ...checkedItems }
  const newIndeterminate = {}

  const computeSelectionState = (node) => {
    if (!node.children || node.children.length === 0) {
      return updated[node.id] ? "checked" : "unchecked"
    }

    const childStates = node.children.map(computeSelectionState)
    const allChecked = childStates.every(state => state === "checked")
    const allUnchecked = childStates.every(state => state === "unchecked")

    let currentState
    if (allChecked) {
      currentState = "checked"
      updated[node.id] = true
      delete newIndeterminate[node.id]
    } else if (allUnchecked) {
      currentState = "unchecked"
      delete updated[node.id]
      delete newIndeterminate[node.id]
    } else {
      currentState = "partial"
      delete updated[node.id]
      newIndeterminate[node.id] = true
    }

    return currentState
  }

  tree.forEach(computeSelectionState)

  return { checkedItems: updated, indeterminateItems: newIndeterminate }
}
