import React, { useEffect, useRef, useState } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import TreeView from '@material-ui/lab/TreeView';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ArrowRightIcon from '@material-ui/icons/ArrowRight';

import { getInitialTreeLevels, getFamiliesLevel, getFamilyTypesLevel } from '../../../services/assetTree';
import { findNodeById, getAncestorIds } from '../../components/ElementDetails/utils/treeHelpers';

import EntityTreeSearch from '../../components/ElementDetails/EntityTreeSearch';

const useStyles = makeStyles(() => ({
  root: {
    width: '100%',
    overflowY: 'visible',
  },
}));

const AssetTree = ({ loadingNodes, setLoadingNodes, setSelectedElements, setTableData }) => {
  const [initialTreeLevels, setInitialTreeLevels] = useState();
  const [expanded, setExpanded] = useState([]);
  const [checkedItems, setCheckedItems] = useState({});
  const [indeterminateItems, setIndeterminateItems] = useState({});
  const [selected, setSelected] = useState(null);

  function useSyncedRef(value) {
    const ref = useRef(value);
    useEffect(() => {
      ref.current = value;
    }, [value]);
    return ref;
  }

  const treeRef = useSyncedRef(initialTreeLevels);
  const checkedItemsRef = useSyncedRef(checkedItems);
  const indeterminateItemsRef = useSyncedRef(indeterminateItems);

  const classes = useStyles();

  useEffect(() => {
    const fetchData = async () => {
      const result = await getInitialTreeLevels();
      setInitialTreeLevels(result);
      setLoadingNodes({}, false);
    };
    fetchData();
  }, [setLoadingNodes]);

  const setNodeLoading = (nodeId, isLoading) => {
    setLoadingNodes((prev) => ({
      ...prev,
      [nodeId]: isLoading,
    }));
  };

  const addChildrenToNode = (tree, nodeId, children) => {
    if (!Array.isArray(tree)) return tree;

    return tree.map((node) => {
      if (!node) return node;

      if (node.id === nodeId) {
        return { ...node, children };
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        return { ...node, children: addChildrenToNode(node.children, nodeId, children) };
      }

      return node;
    });
  };

  const isPlaceholderOnly = (node) => {
    if (!node?.children?.length) return true;
    return node.children.every((c) => !c || c.isPlaceholder || c.id === undefined);
  };

  const getRealChildren = (node) => {
    if (!Array.isArray(node?.children)) return [];
    return node.children.filter((c) => c && !c.isPlaceholder && c.id !== undefined);
  };

  const updateAncestors = (tree, targetId, nextChecked, nextIndeterminate) => {
    const ancestorIds = getAncestorIds(tree, targetId);

    for (let i = ancestorIds.length - 1; i >= 0; i--) {
      const ancestorId = ancestorIds[i];
      const ancestorNode = findNodeById(tree, ancestorId);
      if (!ancestorNode) continue;

      const realChildren = getRealChildren(ancestorNode);
      if (!realChildren.length) continue;

      const childStates = realChildren.map((child) => ({
        checked: !!nextChecked[child.id],
        indeterminate: !!nextIndeterminate[child.id],
      }));

      const allChecked = childStates.length > 0 && childStates.every((s) => s.checked);
      const anyCheckedOrIndeterminate = childStates.some((s) => s.checked || s.indeterminate);

      if (allChecked) {
        nextChecked[ancestorId] = true;
        delete nextIndeterminate[ancestorId];
      } else if (anyCheckedOrIndeterminate) {
        delete nextChecked[ancestorId];
        nextIndeterminate[ancestorId] = true;
      } else {
        delete nextChecked[ancestorId];
        delete nextIndeterminate[ancestorId];
      }
    }
  };

  const syncNewChildrenFromParentState = (parentNodeId, children) => {
    const parentIsChecked = !!checkedItemsRef.current?.[parentNodeId];
    const parentIsIndeterminate = !!indeterminateItemsRef.current?.[parentNodeId];

    if (!parentIsChecked && !parentIsIndeterminate) return;

    setCheckedItems((prev) => {
      const next = { ...prev };

      for (const child of children) {
        if (!child || child.isPlaceholder) continue;

        if (child.level === 4) {
          next[child.id] = true;
        } else {
          delete next[child.id];
        }
      }

      return next;
    });

    setIndeterminateItems((prev) => {
      const next = { ...prev };

      for (const child of children) {
        if (!child || child.isPlaceholder) continue;

        if (child.level === 4) {
          delete next[child.id];
        } else {
          next[child.id] = true;
        }
      }

      return next;
    });
  };

  const loadChildrenForNode = async (nodeId, deep = false) => {
    const node = findNodeById(initialTreeLevels, nodeId);
    if (!node) {
      // eslint-disable-next-line no-console
      console.warn('Node not found:', nodeId);
      return [];
    }

    const hasRealChildren = !isPlaceholderOnly(node);

    if (hasRealChildren && !deep) {
      return getRealChildren(node);
    }

    setNodeLoading(nodeId, true);

    try {
      let children = [];

      if (node.level === 1) {
        const unitPromises = (node.children || []).map((unit) => loadChildrenForNode(unit.id, deep));
        children = await Promise.all(unitPromises);
        children = children.flat();
      } else if (node.level === 2) {
        const families = await getFamiliesLevel(node.structureName);

        children = (families || []).map((f, i) => {
          const rawId = f.id ?? f.family ?? f.name ?? i;
          return {
            ...f,
            id: `${node.id}/family/${encodeURIComponent(String(rawId))}`,
            level: 3,
            structureName: node.structureName,
            family: f.family ?? f.name ?? f.id,
            children: Array.isArray(f.children) && f.children.length ? f.children : [{ isPlaceholder: true }],
          };
        });
      } else if (node.level === 3) {
        const familyName = node.family || node.name;
        const types = await getFamilyTypesLevel(node.structureName, familyName);

        children = (types || []).map((t, i) => {
          const typeLabel = t.name ?? t.type ?? t.typeName ?? String(t.typeId ?? t.id ?? i);
          const stableTypeId = t.typeId ?? t.id ?? t.typeDoc?.id ?? t.typeDoc?._id ?? i;

          return {
            ...t,
            id: `${node.id}/type/${encodeURIComponent(String(stableTypeId))}`,
            name: typeLabel,
            level: 4,
            structureName: node.structureName,
            family: familyName,
            type: typeLabel,
            typeId: t.typeId ?? t.id,
            typeDoc: t.typeDoc ?? t.type, // tolerate older shape
            children: [],
          };
        });
      }

      syncNewChildrenFromParentState(nodeId, children);
      setInitialTreeLevels((prev) => addChildrenToNode(prev, nodeId, children));

      if (deep && children.length > 0) {
        await Promise.all(children.map((child) => loadChildrenForNode(child.id, true)));
      }

      return children;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error loading node children:', err);
      return [];
    } finally {
      setLoadingNodes({}, false);
    }
  };

  const handleNodeToggle = async (event, nodeIds) => {
    const newlyExpanded = nodeIds.find((id) => !expanded.includes(id));
    setExpanded(nodeIds);

    if (newlyExpanded) {
      await loadChildrenForNode(newlyExpanded);
    }
  };

  // ============================================================
  // Table row builder: ONE ROW PER TYPE + dynamic columns
  // ============================================================

  const getTypeStableId = (typeNode) => {
    const doc = typeNode?.typeDoc;
    const id = doc?.id ?? typeNode?.typeId ?? doc?.source_id ?? doc?._id;
    return id != null ? String(id) : '-';
  };

  const getTypeDisplayName = (typeNode) => {
    const docName = typeNode?.typeDoc?.name;
    return typeNode?.name ?? docName ?? '-';
  };

  const getPropCellValue = (prop) => {
    const raw = prop?.val ?? prop?.dVal ?? prop?.name ?? '-';
    if (prop?.uom && raw !== '-' && raw != null && String(raw) !== '') return `${raw} ${prop.uom}`;
    return raw != null && String(raw) !== '' ? raw : '-';
  };

  const buildRowForType = (typeNode) => {
    const typeId = getTypeStableId(typeNode);
    const typeName = getTypeDisplayName(typeNode);

    const props =
      typeNode?.typeDoc?.properties && typeof typeNode.typeDoc.properties === 'object'
        ? typeNode.typeDoc.properties
        : {};

    const row = {
      __rowKey: `type::${typeId}`,
      'Type Name': typeName,
      'Type ID': typeId,
    };

    for (const [propKey, propObj] of Object.entries(props)) {
      row[propKey] = getPropCellValue(propObj);
    }

    return row;
  };

  const updateTableForTypeToggle = (typeNode, nextIsChecked) => {
    if (!setTableData || !typeNode) return;

    const row = buildRowForType(typeNode);

    setTableData((prev) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const map = new Map(prevList.map((r) => [String(r.__rowKey), r]));

      if (nextIsChecked) map.set(row.__rowKey, row);
      else map.delete(row.__rowKey);

      return Array.from(map.values());
    });
  };

  const handleCheck = async (id, isChecked, node = null) => {
    if (!node) return;

    const liveNode = findNodeById(treeRef.current, node.id) || node;

    if (liveNode.level < 4 && isPlaceholderOnly(liveNode)) {
      await loadChildrenForNode(liveNode.id, true);
    }

    const refreshedNode = findNodeById(treeRef.current, liveNode.id) || liveNode;

    const isLeaf = refreshedNode.level === 4;

    let newChecked = { ...checkedItemsRef.current };
    let newIndeterminate = { ...indeterminateItemsRef.current };

    const toAddTypes = new Set();
    const toRemoveTypes = new Set();

    const isTypeLeaf = (n) => n?.level === 4;

    const toggleDescendants = (children, action) => {
      if (!Array.isArray(children)) return;

      children.forEach((child) => {
        if (!child || child.isPlaceholder) return;

        const leaf = isTypeLeaf(child);

        if (action === 'checkLeaves') {
          if (leaf) {
            newChecked[child.id] = true;
            delete newIndeterminate[child.id];
            if (child.name) toAddTypes.add(child.name);

            // ✅ table row add for each leaf
            updateTableForTypeToggle(child, true);
          } else {
            delete newChecked[child.id];
            newIndeterminate[child.id] = true;
          }
        } else if (action === 'uncheck') {
          if (leaf && newChecked[child.id] && child.name) {
            toRemoveTypes.add(child.name);
          }

          // ✅ table row remove for each leaf (if it was checked)
          if (leaf && (newChecked[child.id] || newIndeterminate[child.id])) {
            updateTableForTypeToggle(child, false);
          }

          delete newChecked[child.id];
          delete newIndeterminate[child.id];
        }

        toggleDescendants(getRealChildren(child), action);
      });
    };

    const wasChecked = !!newChecked[id];
    const wasIndeterminate = !!newIndeterminate[id];

    if (isLeaf) {
      const nextIsChecked = !(wasChecked || wasIndeterminate);

      if (wasChecked || wasIndeterminate) {
        delete newChecked[id];
        delete newIndeterminate[id];
        if (refreshedNode.name) toRemoveTypes.add(refreshedNode.name);
      } else {
        newChecked[id] = true;
        delete newIndeterminate[id];
        if (refreshedNode.name) toAddTypes.add(refreshedNode.name);
      }

      // ✅ add/remove the ONE table row for this type
      updateTableForTypeToggle(refreshedNode, nextIsChecked);
    } else {
      if (wasChecked || wasIndeterminate) {
        delete newChecked[id];
        delete newIndeterminate[id];
        toggleDescendants(getRealChildren(refreshedNode), 'uncheck');
      } else {
        delete newChecked[id];
        newIndeterminate[id] = true;
        toggleDescendants(getRealChildren(refreshedNode), 'checkLeaves');
      }
    }

    updateAncestors(treeRef.current, id, newChecked, newIndeterminate);

    if (toAddTypes.size > 0 || toRemoveTypes.size > 0) {
      setSelectedElements((prev) => {
        const prevList = Array.isArray(prev) ? prev.slice() : [];
        const filtered = prevList.filter((name) => !toRemoveTypes.has(name));
        toAddTypes.forEach((name) => {
          if (!filtered.includes(name)) filtered.push(name);
        });
        return filtered;
      });
    }

    setCheckedItems(newChecked);
    setIndeterminateItems(newIndeterminate);
  };

  const renderTree = (nodes) => {
    return nodes?.map((node) => {
      if (!node || !node.id) return null;

      const isLeaf = node.level === 4;

      return (
        <EntityTreeSearch
          key={node.id}
          nodeId={node.id}
          labelText={node.name}
          checked={!!checkedItems[node.id]}
          indeterminate={!!indeterminateItems[node.id]}
          onCheck={(nodeId, checked) => handleCheck(nodeId, checked, node)}
          loadingNodes={loadingNodes[node.id]}
          expandIcon={!isLeaf ? <ArrowRightIcon style={{ color: '#dbdbdb', fontSize: '25px' }} /> : null}
          collapseIcon={!isLeaf ? <ArrowDropDownIcon style={{ color: '#dbdbdb', fontSize: '25px' }} /> : null}
        >
          {Array.isArray(node.children) ? renderTree(node.children) : null}
        </EntityTreeSearch>
      );
    });
  };

  return (
    <TreeView className={classes.root} expanded={expanded} onNodeToggle={handleNodeToggle} selected={selected}>
      {renderTree(initialTreeLevels)}
    </TreeView>
  );
};

export default AssetTree;
