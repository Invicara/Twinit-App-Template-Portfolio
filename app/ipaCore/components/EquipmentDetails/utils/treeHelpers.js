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

export const countThirdLevel = (nodes, checked, depth = 1) => {
  let count = 0
  nodes?.forEach(node => {
    if (depth === 3 && checked[node.id]) count++
    if (node.children) count += countThirdLevel(node.children, checked, depth + 1)
  })
  return count
}

export const getMatchingIdsAndDescendants = (nodes, query) => {
  let result = []
  const lowerQuery = query.toLowerCase()

  nodes.forEach(node => {
    const isMatch = node.id.toLowerCase().includes(lowerQuery)
    if (isMatch) {
      result.push(node.id)
      if (node.children) result = result.concat(getAllDescendantIds(node.children))
    } else if (node.children) {
      result = result.concat(getMatchingIdsAndDescendants(node.children, query))
    }
  })
  return result
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
