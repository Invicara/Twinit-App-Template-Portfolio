import React, { useEffect, useRef, useState } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import TreeView from '@material-ui/lab/TreeView';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ArrowRightIcon from '@material-ui/icons/ArrowRight';

import { getInitialTreeLevels, getFamiliesLevel, getFamilyTypesLevel, getTypeElementsLevel } from '../../../services/assetTree';
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

  const elementsCacheRef = useRef(new Map());

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

  // CHANGED: ref-counted loading (single source of truth)
  const loadingCountRef = useRef(new Map());

  const beginLoading = (nodeId) => {
    if (!nodeId) return;

    const prev = loadingCountRef.current.get(nodeId) || 0;
    loadingCountRef.current.set(nodeId, prev + 1);

    setLoadingNodes((p) => ({ ...p, [nodeId]: true }));
  };

  const endLoading = (nodeId) => {
    if (!nodeId) return;

    const prev = loadingCountRef.current.get(nodeId) || 0;
    const next = Math.max(0, prev - 1);

    if (next === 0) {
      loadingCountRef.current.delete(nodeId);
      setLoadingNodes((p) => {
        const copy = { ...p };
        delete copy[nodeId];
        return copy;
      });
    } else {
      loadingCountRef.current.set(nodeId, next);
      setLoadingNodes((p) => ({ ...p, [nodeId]: true }));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const result = await getInitialTreeLevels();
      setInitialTreeLevels(result);

      // CHANGED: do not globally clear loadingNodes (breaks ref-counting)
      // If you want to clear the initial page load spinner, just ensure none were started.
    };
    fetchData();
  }, []);

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

  const collectDescendants = (node) => {
    const out = [];

    const walk = (n) => {
      const kids = getRealChildren(n);
      if (!kids.length) return;

      for (const c of kids) {
        out.push(c);
        walk(c);
      }
    };

    walk(node);
    return out;
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

    beginLoading(nodeId);

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
            typeDoc: t.typeDoc ?? t.type,
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
      endLoading(nodeId);
    }
  };

  const handleNodeToggle = async (event, nodeIds) => {
    const newlyExpanded = nodeIds.find((id) => !expanded.includes(id));
    setExpanded(nodeIds);

    if (newlyExpanded) {
      await loadChildrenForNode(newlyExpanded);
    }
  };

  const getPropCellValue = (prop) => {
    const raw = prop?.val ?? prop?.dVal ?? prop?.name ?? '-';
    if (prop?.uom && raw !== '-' && raw != null && String(raw) !== '') return `${raw} ${prop.uom}`;
    return raw != null && String(raw) !== '' ? raw : '-';
  };

  const flattenPropertiesToRow = (props) => {
    const out = {};
    if (!props || typeof props !== 'object') return out;

    for (const [propKey, propObj] of Object.entries(props)) {
      out[propKey] = getPropCellValue(propObj);
    }

    return out;
  };

  const buildRowForElement = (typeNode, elementDoc) => {
    const typeDoc = typeNode?.typeDoc;
    const typeId = String(typeNode?.typeId ?? typeDoc?.id ?? typeDoc?._id ?? '-');
    const typeName = typeNode?.name ?? typeDoc?.name ?? '-';

    const elementId = String(elementDoc?.id ?? elementDoc?.source_id ?? elementDoc?._id ?? '-');
    const elementName = elementDoc?.name ?? elementId;

    const typeProps = flattenPropertiesToRow(typeDoc?.properties);
    const elementProps = flattenPropertiesToRow(elementDoc?.properties);

    const mergedProps = { ...typeProps, ...elementProps };

    return {
      __rowKey: `type::${typeId}::el::${elementId}`,
      'Type Name': typeName,
      'Type ID': typeId,
      'Element Name': elementName,
      'Element ID': elementId,
      ...mergedProps,
    };
  };

  const buildRowsForElements = ({ typeNode, elements }) => {
    const list = Array.isArray(elements) ? elements : [];

    return list.map((el) => {
      const elementDoc = el?.element ?? el;
      return buildRowForElement(typeNode, elementDoc);
    });
  };

  const removeRowsForType = (typeId) => {
    if (!setTableData) return;

    setTableData((prev) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const prefix = `type::${String(typeId)}::el::`;
      return prevList.filter((r) => !String(r?.__rowKey ?? '').startsWith(prefix));
    });
  };

  const addRowsForType = (typeNode, elements) => {
    if (!setTableData) return;

    const typeId = typeNode?.typeId ?? typeNode?.typeDoc?.id;
    const rows = buildRowsForElements({ typeNode, elements });

    setTableData((prev) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const map = new Map(prevList.map((r) => [String(r.__rowKey), r]));

      const prefix = `type::${String(typeId)}::el::`;
      for (const key of Array.from(map.keys())) {
        if (String(key).startsWith(prefix)) map.delete(key);
      }

      rows.forEach((r) => map.set(String(r.__rowKey), r));
      return Array.from(map.values());
    });
  };

  const fetchElementsForType = async (typeNode) => {
    const typeId = typeNode?.typeId ?? typeNode?.typeDoc?.id;
    if (typeId == null) return [];

    const cacheKey = `${typeNode?.structureName ?? ''}::${String(typeId)}`;
    const cached = elementsCacheRef.current.get(cacheKey);
    if (cached) return cached;

    // CHANGED: use ref-counted loading so spinner doesn't flicker or end early
    beginLoading(typeNode.id);

    try {
      const elementsResponse = await getTypeElementsLevel(typeNode.structureName, typeId);
      const elements = elementsResponse?._list || elementsResponse || [];

      elementsCacheRef.current.set(cacheKey, elements);
      return elements;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error loading elements for type:', err);
      return [];
    } finally {
      endLoading(typeNode.id);
    }
  };

  const ensureLoaded = async (n) => {
    if (!n) return { loaded: false, children: [] };

    if (n.level < 4 && isPlaceholderOnly(n)) {
      const children = await loadChildrenForNode(n.id, false);
      return { loaded: true, children };
    }

    return { loaded: false, children: getRealChildren(n) };
  };

  const handleCheck = async (id, isChecked, node = null) => {
    if (!node) return;

    const liveNode = findNodeById(treeRef.current, node.id) || node;

    const wasChecked = !!checkedItemsRef.current?.[id];
    const wasIndeterminate = !!indeterminateItemsRef.current?.[id];
    const nextIsChecked = !(wasChecked || wasIndeterminate);

    let newChecked = { ...checkedItemsRef.current };
    let newIndeterminate = { ...indeterminateItemsRef.current };

    const toAddTypes = new Set();
    const toRemoveTypes = new Set();

    const isTypeLeaf = (n) => n?.level === 4;

    const toggleLeaf = async (leafNode, shouldCheck) => {
      if (!leafNode) return;

      if (shouldCheck) {
        newChecked[leafNode.id] = true;
        delete newIndeterminate[leafNode.id];
        if (leafNode.name) toAddTypes.add(leafNode.name);

        const elements = await fetchElementsForType(leafNode);
        addRowsForType(leafNode, elements);
      } else {
        delete newChecked[leafNode.id];
        delete newIndeterminate[leafNode.id];
        if (leafNode.name) toRemoveTypes.add(leafNode.name);

        removeRowsForType(leafNode.typeId ?? leafNode?.typeDoc?.id);
      }
    };

    // Leaf type click
    if (isTypeLeaf(liveNode)) {
      await toggleLeaf(liveNode, nextIsChecked);

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
      return;
    }

    // CHANGED: keep the branch spinner up until the whole operation completes
    // (types load + all element fetches + table updates)
    const branchNodeId = liveNode.id;
    if (nextIsChecked) beginLoading(branchNodeId);

    try {
      // Branch click (site/building/family etc)
      if (nextIsChecked) {
        delete newChecked[id];
        newIndeterminate[id] = true;
      } else {
        delete newChecked[id];
        delete newIndeterminate[id];
      }

      // Ensure family children are loaded on first click
      let loadedChildren = [];
      let loaded = false;

      if (liveNode.level < 4) {
        const res = await ensureLoaded(liveNode);
        loaded = res.loaded;
        loadedChildren = res.children;
      }

      // Resolve which type nodes to toggle
      let typesToToggle = [];

      if (liveNode.level === 3 && loaded) {
        // family node that just loaded its types
        typesToToggle = loadedChildren.filter(isTypeLeaf);
      } else {
        // general fallback
        typesToToggle = collectDescendants(liveNode).filter(isTypeLeaf);
      }

      // Toggle all resolved types (this awaits element fetches too)
      for (const typeNode of typesToToggle) {
        await toggleLeaf(typeNode, nextIsChecked);
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
    } finally {
      if (nextIsChecked) endLoading(branchNodeId);
    }
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
