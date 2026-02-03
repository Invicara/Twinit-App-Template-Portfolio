import React, { useEffect, useRef, useState } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import TreeView from '@material-ui/lab/TreeView';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ArrowRightIcon from '@material-ui/icons/ArrowRight';

import {
  getInitialTreeLevels,
  getFamiliesLevel,
  getFamilyTypesLevel,
  getTypeElementsLevel,
  getStructureBulk,
  getTypesBulk
} from '../../../services/assetTree';
import { findNodeById, getAncestorIds } from '../../components/ElementDetails/utils/treeHelpers';

import EntityTreeSearch from '../../components/ElementDetails/EntityTreeSearch';

const useStyles = makeStyles(() => ({
  root: {
    width: '100%',
    overflowY: 'visible',
  },
}));

const runWithLimit = async (items, limit, worker) => {
  const list = Array.isArray(items) ? items : [];
  const n = Math.max(1, Number(limit) || 6);

  const results = new Array(list.length);
  let i = 0;

  const runners = Array.from({ length: Math.min(n, list.length) }, async () => {
    while (i < list.length) {
      const idx = i++;
      results[idx] = await worker(list[idx], idx);
    }
  });

  await Promise.all(runners);
  return results;
};

const AssetTree = ({ loadingNodes, setLoadingNodes, setSelectedElements, setTableData }) => {
  const [initialTreeLevels, setInitialTreeLevels] = useState();
  const [expanded, setExpanded] = useState([]);
  const [checkedItems, setCheckedItems] = useState({});
  const [indeterminateItems, setIndeterminateItems] = useState({});
  const [selected, setSelected] = useState(null);

  // Ref-counting + row storage by (structureName::typeId)
  const typeSelectionCountRef = useRef(new Map());
  const rowsByTypeKeyRef = useRef(new Map());
  const siteExcludedTypeKeysRef = useRef(new Map());
  const buildingExcludedTypeKeysRef = useRef(new Map());

  // NEW: cache for preloaded families+types by building (structureName)
  // structureName -> Array<familyNodeChildren>
  const typesBulkCacheRef = useRef(new Map());

  // Scope bookkeeping: scopeKey -> Set(typeKey)
  // scopeKey examples:
  // - site::<siteId>
  // - building::<structureName>
  // - leaf::<structureName>::<typeId>
  const scopeToTypeKeysRef = useRef(new Map());

  // Site exclusions: siteScopeKey -> Set(buildingScopeKey)
  const siteExcludedBuildingsRef = useRef(new Map());

  const INIT_LOAD_ID = '__tree_init__';

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

  // ref-counted loading (single source of truth)
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

  const withLoading = async (nodeId, fn) => {
    beginLoading(nodeId);
    try {
      return await fn();
    } finally {
      endLoading(nodeId);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      await withLoading(INIT_LOAD_ID, async () => {
        const result = await getInitialTreeLevels();
        if (!cancelled) setInitialTreeLevels(result);
      });
    };

    fetchData();

    return () => {
      cancelled = true;
    };
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

  const clearDescendantsVisualState = (node, nextChecked, nextIndeterminate) => {
    const desc = collectDescendants(node);
    for (const d of desc) {
      delete nextChecked[d.id];
      delete nextIndeterminate[d.id];
    }
  };

  const isAnyAncestorSelected = (tree, nodeId, checkedMap, indeterminateMap) => {
    const ancestors = getAncestorIds(tree, nodeId);
    return ancestors.some((aid) => checkedMap?.[aid] || indeterminateMap?.[aid]);
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

  const getIdsFromNodeId = (nodeId) => {
    const parts = String(nodeId || '').split('/');
    const siteId = parts[0] || null;
    const buildingId = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    return { siteId, buildingId };
  };

  const isBuildingExcludedByActiveSite = (nodeId) => {
    const tree = treeRef.current;
    const { siteId, buildingId } = getIdsFromNodeId(nodeId);
    if (!siteId || !buildingId) return false;

    const buildingNode = findNodeById(tree, buildingId);
    const structureName = buildingNode?.structureName;
    if (!structureName) return false;

    const siteScopeKey = `site::${String(siteId)}`;
    if (!scopeToTypeKeysRef.current.has(siteScopeKey)) return false;

    const excluded = siteExcludedBuildingsRef.current.get(siteScopeKey);
    if (!excluded) return false;

    const buildingScopeKey = `building::${String(structureName)}`;
    return excluded.has(buildingScopeKey);
  };

  const syncNewChildrenFromParentState = (parentNodeId, children) => {
    if (isBuildingExcludedByActiveSite(parentNodeId)) return;

    const tree = treeRef.current;

    const parentSelected =
      !!checkedItemsRef.current?.[parentNodeId] || !!indeterminateItemsRef.current?.[parentNodeId];

    const ancestorSelected = isAnyAncestorSelected(
      tree,
      parentNodeId,
      checkedItemsRef.current,
      indeterminateItemsRef.current,
    );

    if (!parentSelected && !ancestorSelected) return;

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

  const buildFamiliesAndTypesFromBulk = ({ buildingNodeId, structureName, bulkList }) => {
    // bulkList expected to contain items like:
    // { family, type, typeId, typeDoc } (elements optional)
    const list = Array.isArray(bulkList) ? bulkList : [];

    const familiesMap = new Map(); // familyName -> { id, name, level, structureName, family, children: [] }
    const seenTypeIdsByFamily = new Map(); // familyName -> Set(typeId)

    for (const item of list) {
      const familyNameRaw = item?.family ?? item?.revitFamily ?? item?.Family ?? item?.nameFamily;
      const typeLabelRaw = item?.type ?? item?.name ?? item?.typeName ?? item?.revitType;
      const typeIdRaw = item?.typeId ?? item?.id ?? item?.typeDoc?.id ?? item?.typeDoc?._id;

      const familyName = familyNameRaw != null && String(familyNameRaw).trim() !== '' ? String(familyNameRaw) : null;
      const typeLabel = typeLabelRaw != null && String(typeLabelRaw).trim() !== '' ? String(typeLabelRaw) : null;
      const stableTypeId = typeIdRaw != null ? String(typeIdRaw) : null;

      if (!familyName || !typeLabel || !stableTypeId) continue;

      if (!familiesMap.has(familyName)) {
        const famNodeId = `${buildingNodeId}/family/${encodeURIComponent(String(familyName))}`;
        familiesMap.set(familyName, {
          id: famNodeId,
          name: familyName,
          level: 3,
          structureName,
          family: familyName,
          children: [],
        });
        seenTypeIdsByFamily.set(familyName, new Set());
      }

      const seenSet = seenTypeIdsByFamily.get(familyName);
      if (seenSet.has(stableTypeId)) continue;
      seenSet.add(stableTypeId);

      const famNode = familiesMap.get(familyName);

      famNode.children.push({
        id: `${famNode.id}/type/${encodeURIComponent(String(stableTypeId))}`,
        name: typeLabel,
        level: 4,
        structureName,
        family: familyName,
        type: typeLabel,
        typeId: item?.typeId ?? item?.id ?? item?.typeDoc?.id,
        typeDoc: item?.typeDoc ?? item?.type,
        children: [],
      });
    }

    // sort families and types for stable display
    const families = Array.from(familiesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const fam of families) {
      fam.children = (Array.isArray(fam.children) ? fam.children : []).sort((a, b) => a.name.localeCompare(b.name));
      // if no types for some reason, keep placeholder
      if (!fam.children.length) fam.children = [{ isPlaceholder: true }];
    }

    // if nothing came back, fall back to old API to avoid breaking UI
    if (!families.length) return null;

    return families;
  };

  const loadChildrenForNode = async (nodeId, deep = false) => {
    const node = findNodeById(treeRef.current, nodeId);
    if (!node) {
      // eslint-disable-next-line no-console
      console.warn('Node not found:', nodeId);
      return [];
    }

    const hasRealChildren = !isPlaceholderOnly(node);
    if (hasRealChildren && !deep) return getRealChildren(node);

    return withLoading(nodeId, async () => {
      let children = [];

      if (node.level === 1) {
        const unitPromises = (node.children || []).map((unit) => loadChildrenForNode(unit.id, deep));
        children = (await Promise.all(unitPromises)).flat();
      } else if (node.level === 2) {
  // NEW: expand building -> prefetch all families+types in one bulk call (cached)
  const structureName = node.structureName;

  if (structureName && typesBulkCacheRef.current.has(structureName)) {
    children = typesBulkCacheRef.current.get(structureName);
  } else {
    try {
      const bulk = await getTypesBulk(structureName);
      const bulkList = Array.isArray(bulk) ? bulk : bulk?._list || [];

      const built = buildFamiliesAndTypesFromBulk({
        buildingNodeId: node.id,
        structureName,
        bulkList,
      });

      if (built) {
        children = built;
        typesBulkCacheRef.current.set(structureName, children);
      } else {
        // fallback (old behavior)
        const families = await getFamiliesLevel(structureName);
        children = (families || []).map((f, i) => {
          const rawId = f.id ?? f.family ?? f.name ?? i;
          return {
            ...f,
            id: `${node.id}/family/${encodeURIComponent(String(rawId))}`,
            level: 3,
            structureName,
            family: f.family ?? f.name ?? f.id,
            children: Array.isArray(f.children) && f.children.length ? f.children : [{ isPlaceholder: true }],
          };
        });
      }
    } catch (e) {
      // fallback (old behavior)
      const families = await getFamiliesLevel(structureName);
      children = (families || []).map((f, i) => {
        const rawId = f.id ?? f.family ?? f.name ?? i;
        return {
          ...f,
          id: `${node.id}/family/${encodeURIComponent(String(rawId))}`,
          level: 3,
          structureName,
          family: f.family ?? f.name ?? f.id,
          children: Array.isArray(f.children) && f.children.length ? f.children : [{ isPlaceholder: true }],
        };
      });
    }
  }
} else if (node.level === 3) {
        // If building bulk created this family node, it already has types children
        // so this branch should rarely run. Keep it as a safe fallback.
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
    });
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

  const getTypeMarkValue = (typeDoc) => {
    const p = typeDoc?.properties?.['Type Mark'] ?? typeDoc?.properties?.TypeMark ?? typeDoc?.properties?.typeMark;
    if (!p) return '-';
    return getPropCellValue(p);
  };

  const buildRowForElement = (typeNode, elementDoc) => {
    const typeDoc = typeNode?.typeDoc;

    const typeId = String(typeNode?.typeId ?? typeDoc?.id ?? typeDoc?._id ?? '-');
    const typeName = typeNode?.name ?? typeDoc?.name ?? '-';

    const revitFamily = typeNode?.family ?? typeNode?.typeDoc?.family ?? '-';
    const revitType = typeNode?.type ?? typeNode?.name ?? '-';
    const typeMark = getTypeMarkValue(typeDoc);

    const elementId = String(elementDoc?.id ?? elementDoc?.source_id ?? elementDoc?._id ?? '-');
    const elementName = elementDoc?.name ?? elementId;

    const typeProps = flattenPropertiesToRow(typeDoc?.properties);
    const elementProps = flattenPropertiesToRow(elementDoc?.properties);

    const mergedProps = { ...typeProps, ...elementProps };

    return {
      __rowKey: `type::${typeId}::el::${elementId}`,
      'Type Name': typeName,
      'Type ID': typeId,
      'Revit Family': revitFamily,
      'Revit Type': revitType,
      'Type Mark': typeMark,
      'Element Name': elementName,
      'Element ID': elementId,
      ...mergedProps,
    };
  };

  const fetchElementsForType = async (typeNode) => {
    const typeId = typeNode?.typeId ?? typeNode?.typeDoc?.id;
    if (typeId == null) return [];

    const cacheKey = `${typeNode?.structureName ?? ''}::${String(typeId)}`;
    const cached = elementsCacheRef.current.get(cacheKey);
    if (cached) return cached;

    return withLoading(typeNode.id, async () => {
      const elementsResponse = await getTypeElementsLevel(typeNode.structureName, typeId);
      const elements = elementsResponse?._list || [];
      elementsCacheRef.current.set(cacheKey, elements);
      return elements;
    });
  };

  const ensureLoaded = async (n) => {
    if (!n) return { loaded: false, children: [] };

    if (n.level < 4 && isPlaceholderOnly(n)) {
      const children = await loadChildrenForNode(n.id, false);
      return { loaded: true, children };
    }

    return { loaded: false, children: getRealChildren(n) };
  };

  const makeTypeKey = (structureName, typeId) => `${String(structureName)}::${String(typeId)}`;

  const rebuildTableFromTypeMap = () => {
    const seen = new Set();
    const allRows = [];

    for (const rows of rowsByTypeKeyRef.current.values()) {
      if (!Array.isArray(rows) || !rows.length) continue;

      for (const r of rows) {
        const k = String(r?.__rowKey ?? '');
        if (!k) continue;

        if (seen.has(k)) continue;
        seen.add(k);

        allRows.push(r);
      }
    }

    setTableData(allRows);
  };

  const incType = ({ structureName, typeId, rows }) => {
    const typeKey = makeTypeKey(structureName, typeId);

    const prevCount = typeSelectionCountRef.current.get(typeKey) || 0;
    typeSelectionCountRef.current.set(typeKey, prevCount + 1);

    if (!rowsByTypeKeyRef.current.has(typeKey)) {
      rowsByTypeKeyRef.current.set(typeKey, rows);
    }
  };

  const decType = ({ structureName, typeId }) => {
    const typeKey = makeTypeKey(structureName, typeId);

    const prevCount = typeSelectionCountRef.current.get(typeKey) || 0;
    const nextCount = Math.max(0, prevCount - 1);

    if (nextCount === 0) {
      typeSelectionCountRef.current.delete(typeKey);
      rowsByTypeKeyRef.current.delete(typeKey);
    } else {
      typeSelectionCountRef.current.set(typeKey, nextCount);
    }
  };

  const getSiteScopeForBuilding = (buildingNode) => {
    const tree = treeRef.current;

    if (buildingNode?.level === 1) return `site::${String(buildingNode.id)}`;

    const ancestors = getAncestorIds(tree, buildingNode.id) || [];
    for (const aid of ancestors) {
      const aNode = findNodeById(tree, aid);
      if (aNode?.level === 1) return `site::${String(aNode.id)}`;
    }

    return null;
  };

  const excludeBuildingFromSite = ({ siteScopeKey, buildingScopeKey, buildingTypeKeys }) => {
    if (!siteScopeKey) return;

    const excluded = siteExcludedBuildingsRef.current.get(siteScopeKey) || new Set();
    excluded.add(buildingScopeKey);
    siteExcludedBuildingsRef.current.set(siteScopeKey, excluded);

    for (const tk of buildingTypeKeys) {
      const { structureName, typeId } = parseTypeKey(tk);
      decType({ structureName, typeId });
    }

    const siteKeys = scopeToTypeKeysRef.current.get(siteScopeKey);
    if (siteKeys) {
      for (const tk of buildingTypeKeys) siteKeys.delete(tk);
      scopeToTypeKeysRef.current.set(siteScopeKey, siteKeys);
    }
  };

  const includeBuildingBackIntoSite = ({ siteScopeKey, buildingScopeKey, buildingNormalized }) => {
    if (!siteScopeKey) return;

    const excluded = siteExcludedBuildingsRef.current.get(siteScopeKey);
    if (excluded) {
      excluded.delete(buildingScopeKey);
      if (!excluded.size) siteExcludedBuildingsRef.current.delete(siteScopeKey);
      else siteExcludedBuildingsRef.current.set(siteScopeKey, excluded);
    }

    const siteKeys = scopeToTypeKeysRef.current.get(siteScopeKey) || new Set();

    for (const tk of buildingNormalized.typeKeys) siteKeys.add(tk);

    for (const [typeKey, rows] of buildingNormalized.rowsByTypeKey.entries()) {
      const [structureName, typeId] = String(typeKey).split('::');
      incType({ structureName, typeId, rows });
    }

    scopeToTypeKeysRef.current.set(siteScopeKey, siteKeys);
  };

  const normalizeBulk = ({ structureName, bulkList }) => {
    const typeKeys = new Set();
    const rowsByTypeKey = new Map();

    const list = Array.isArray(bulkList) ? bulkList : [];

    for (const item of list) {
      const typeId = item.typeId ?? item?.typeDoc?.id;
      if (typeId == null) continue;

      const typeKey = makeTypeKey(structureName, typeId);
      typeKeys.add(typeKey);

      const typeNodeLike = {
        structureName,
        family: item.family,
        type: item.type,
        typeId,
        name: item.type,
        typeDoc: item.typeDoc,
      };

      const elements = Array.isArray(item.elements) ? item.elements : [];
      const rows = [];

      const seenElIds = new Set();

      for (const elWrap of elements) {
        const el = elWrap?.element ?? elWrap;

        const elId = String(el?.id ?? el?._id ?? el?.source_id ?? '');
        if (!elId) continue;

        if (seenElIds.has(elId)) continue;
        seenElIds.add(elId);

        const r = buildRowForElement(typeNodeLike, el);
        r.__rowKey = `typeKey::${typeKey}::el::${elId}`;
        rows.push(r);
      }

      rowsByTypeKey.set(typeKey, rows);
    }

    return { typeKeys, rowsByTypeKey };
  };

  const applySelectionToExistingSubtree = (rootNode, nextChecked, nextIndeterminate) => {
    if (!rootNode) return;

    const walk = (n) => {
      const kids = getRealChildren(n);
      if (!kids.length) return;

      for (const c of kids) {
        if (!c || c.isPlaceholder) continue;

        if (c.level === 4) {
          nextChecked[c.id] = true;
          delete nextIndeterminate[c.id];
        } else {
          delete nextChecked[c.id];
          nextIndeterminate[c.id] = true;
        }

        walk(c);
      }
    };

    walk(rootNode);
  };

  // ==========================
  // IMPORTANT: unify leaf toggle
  // ==========================
  const buildRowsForTypeNode = async (typeNode) => {
    const typeId = typeNode?.typeId ?? typeNode?.typeDoc?.id;
    if (typeId == null) return { typeKey: null, rows: [] };

    const structureName = typeNode?.structureName ?? '';
    const typeKey = makeTypeKey(structureName, typeId);

    const elements = await fetchElementsForType(typeNode);
    const list = Array.isArray(elements) ? elements : [];

    const seenElIds = new Set();
    const rows = [];

    for (const elWrap of list) {
      const el = elWrap?.element ?? elWrap;

      const elId = String(el?.id ?? el?._id ?? el?.source_id ?? '');
      if (!elId) continue;

      if (seenElIds.has(elId)) continue;
      seenElIds.add(elId);

      const r = buildRowForElement(typeNode, el);
      r.__rowKey = `typeKey::${typeKey}::el::${elId}`;
      rows.push(r);
    }

    return { typeKey, rows };
  };

  const getSiteScopeForNodeId = (nodeId) => {
    const tree = treeRef.current;

    const self = findNodeById(tree, nodeId);
    if (self?.level === 1) return `site::${String(self.id)}`;

    const ancestors = getAncestorIds(tree, nodeId) || [];

    for (const aid of ancestors) {
      const aNode = findNodeById(tree, aid);
      if (aNode?.level === 1) return `site::${String(aNode.id)}`;
    }

    return null;
  };

  const getExcludedTypeSet = ({ siteScopeKey, buildingScopeKey, create = false }) => {
    if (!siteScopeKey || !buildingScopeKey) return null;

    const byBuilding = siteExcludedTypeKeysRef.current.get(siteScopeKey);
    if (!byBuilding) {
      if (!create) return null;
      const m = new Map();
      siteExcludedTypeKeysRef.current.set(siteScopeKey, m);
      return getExcludedTypeSet({ siteScopeKey, buildingScopeKey, create });
    }

    const set = byBuilding.get(buildingScopeKey);
    if (!set) {
      if (!create) return null;
      const s = new Set();
      byBuilding.set(buildingScopeKey, s);
      return s;
    }

    return set;
  };

  const getBuildingScopeKeyForNode = (node) => {
    const structureName = node?.structureName;
    if (!structureName) return null;
    return `building::${String(structureName)}`;
  };

  const getBuildingScopeKeyForNodeId = (nodeId) => {
    const tree = treeRef.current;
    const { buildingId } = getIdsFromNodeId(nodeId);
    if (!buildingId) return null;

    const buildingNode = findNodeById(tree, buildingId);
    return getBuildingScopeKeyForNode(buildingNode);
  };

  const getBuildingExcludedSet = (buildingScopeKey, create = false) => {
    if (!buildingScopeKey) return null;

    const existing = buildingExcludedTypeKeysRef.current.get(buildingScopeKey);
    if (existing) return existing;

    if (!create) return null;

    const s = new Set();
    buildingExcludedTypeKeysRef.current.set(buildingScopeKey, s);
    return s;
  };

  const excludeTypeFromBuilding = ({ buildingScopeKey, typeKey }) => {
    if (!buildingScopeKey || !typeKey) return;

    const excludedSet = getBuildingExcludedSet(buildingScopeKey, true);
    if (excludedSet.has(typeKey)) return;

    excludedSet.add(typeKey);

    const buildingKeys = scopeToTypeKeysRef.current.get(buildingScopeKey);
    if (buildingKeys && buildingKeys.has(typeKey)) {
      const [structureName, typeId] = String(typeKey).split('::');
      decType({ structureName, typeId });

      buildingKeys.delete(typeKey);
      scopeToTypeKeysRef.current.set(buildingScopeKey, buildingKeys);
    }
  };

  const includeTypeBackIntoBuilding = async ({ buildingScopeKey, typeNode }) => {
    if (!buildingScopeKey || !typeNode) return;

    const typeId = typeNode?.typeId ?? typeNode?.typeDoc?.id;
    const structureName = typeNode?.structureName ?? '';
    if (typeId == null) return;

    const typeKey = makeTypeKey(structureName, typeId);

    const excludedSet = getBuildingExcludedSet(buildingScopeKey, false);
    if (!excludedSet || !excludedSet.has(typeKey)) return;

    excludedSet.delete(typeKey);
    if (excludedSet.size === 0) buildingExcludedTypeKeysRef.current.delete(buildingScopeKey);

    const buildingKeys = scopeToTypeKeysRef.current.get(buildingScopeKey) || new Set();
    if (!buildingKeys.has(typeKey)) {
      buildingKeys.add(typeKey);
      scopeToTypeKeysRef.current.set(buildingScopeKey, buildingKeys);

      const cachedRows = rowsByTypeKeyRef.current.get(typeKey);
      const rows =
        Array.isArray(cachedRows) && cachedRows.length ? cachedRows : (await buildRowsForTypeNode(typeNode)).rows;

      incType({ structureName, typeId, rows });
    }
  };

  const parseTypeKey = (typeKey) => {
    const s = String(typeKey || '');
    const idx = s.lastIndexOf('::');
    if (idx === -1) return { structureName: s, typeId: '' };
    return { structureName: s.slice(0, idx), typeId: s.slice(idx + 2) };
  };

  const excludeTypeFromSite = ({ siteScopeKey, buildingScopeKey, typeKey }) => {
    if (!siteScopeKey || !buildingScopeKey || !typeKey) return;

    const set = getExcludedTypeSet({ siteScopeKey, buildingScopeKey, create: true });
    if (set.has(typeKey)) return;

    set.add(typeKey);

    const { structureName, typeId } = parseTypeKey(typeKey);
    decType({ structureName, typeId });

    const siteKeys = scopeToTypeKeysRef.current.get(siteScopeKey);
    if (siteKeys) {
      siteKeys.delete(typeKey);
      scopeToTypeKeysRef.current.set(siteScopeKey, siteKeys);
    }
  };

  const includeTypeBackIntoSite = async ({ siteScopeKey, buildingScopeKey, typeNode }) => {
    if (!siteScopeKey || !buildingScopeKey || !typeNode) return;

    const typeId = typeNode?.typeId ?? typeNode?.typeDoc?.id;
    const structureName = typeNode?.structureName ?? '';
    if (typeId == null) return;

    const typeKey = makeTypeKey(structureName, typeId);

    const set = getExcludedTypeSet({ siteScopeKey, buildingScopeKey, create: false });
    if (!set || !set.has(typeKey)) return;

    set.delete(typeKey);

    const byBuilding = siteExcludedTypeKeysRef.current.get(siteScopeKey);
    if (byBuilding) {
      const left = byBuilding.get(buildingScopeKey);
      if (left && left.size === 0) byBuilding.delete(buildingScopeKey);
      if (byBuilding.size === 0) siteExcludedTypeKeysRef.current.delete(siteScopeKey);
    }

    const siteKeys = scopeToTypeKeysRef.current.get(siteScopeKey) || new Set();
    siteKeys.add(typeKey);
    scopeToTypeKeysRef.current.set(siteScopeKey, siteKeys);

    const { rows } = await buildRowsForTypeNode(typeNode);
    incType({ structureName, typeId, rows });
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

const typeId = leafNode?.typeId ?? leafNode?.typeDoc?.id;
const structureName = leafNode?.structureName ?? '';
if (typeId == null) return;

const typeKey = makeTypeKey(structureName, typeId);
const leafScopeKey = `leaf::${typeKey}`;

const siteScopeKey = getSiteScopeForNodeId(leafNode.id);
const siteIsActive = siteScopeKey && scopeToTypeKeysRef.current.has(siteScopeKey);
const siteBuildingScopeKey = `building::${String(structureName)}`;

const buildingScopeKey = getBuildingScopeKeyForNodeId(leafNode.id);
const buildingIsActive = buildingScopeKey && scopeToTypeKeysRef.current.has(buildingScopeKey);

if (shouldCheck) {
newChecked[leafNode.id] = true;
delete newIndeterminate[leafNode.id];
if (leafNode.name) toAddTypes.add(leafNode.name);

if (siteIsActive) {
await includeTypeBackIntoSite({ siteScopeKey, buildingScopeKey: siteBuildingScopeKey, typeNode: leafNode });
return;
}

if (buildingIsActive) {
await includeTypeBackIntoBuilding({ buildingScopeKey, typeNode: leafNode });
return;
}

const { rows } = await buildRowsForTypeNode(leafNode);
scopeToTypeKeysRef.current.set(leafScopeKey, new Set([typeKey]));
incType({ structureName, typeId, rows });
return;
}

delete newChecked[leafNode.id];
delete newIndeterminate[leafNode.id];
if (leafNode.name) toRemoveTypes.add(leafNode.name);

if (siteIsActive) {
excludeTypeFromSite({ siteScopeKey, buildingScopeKey: siteBuildingScopeKey, typeKey });
return;
}

if (buildingIsActive) {
excludeTypeFromBuilding({ buildingScopeKey, typeKey });
return;
}

const typeKeys = scopeToTypeKeysRef.current.get(leafScopeKey);
if (typeKeys) {
for (const tk of typeKeys) {
const [sn, tid] = String(tk).split('::');
decType({ structureName: sn, typeId: tid });
}
scopeToTypeKeysRef.current.delete(leafScopeKey);
}
};

// Leaf type click
if (isTypeLeaf(liveNode)) {
await toggleLeaf(liveNode, nextIsChecked);

// IMPORTANT: rebuild once after leaf toggle
rebuildTableFromTypeMap();

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

// SITE
if (liveNode.level === 1) {
await withLoading(liveNode.id, async () => {
const scopeKey = `site::${String(liveNode.id)}`;

const buildings = Array.isArray(liveNode.children) ? liveNode.children : [];
const buildingNodes = buildings.filter((b) => b && b.level === 2 && b.structureName);

if (!nextIsChecked) {
const typeKeys = scopeToTypeKeysRef.current.get(scopeKey);
if (typeKeys) {
for (const tk of typeKeys) {
const { structureName, typeId } = parseTypeKey(tk);
decType({ structureName, typeId });
}
scopeToTypeKeysRef.current.delete(scopeKey);
}

siteExcludedBuildingsRef.current.delete(scopeKey);
siteExcludedTypeKeysRef.current.delete(scopeKey);

rebuildTableFromTypeMap();

delete newChecked[id];
delete newIndeterminate[id];

for (const b of buildingNodes) {
delete newChecked[b.id];
delete newIndeterminate[b.id];

const liveBuildingNode = findNodeById(treeRef.current, b.id) || b;
clearDescendantsVisualState(liveBuildingNode, newChecked, newIndeterminate);
}

setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
return;
}

siteExcludedBuildingsRef.current.delete(scopeKey);

delete newChecked[id];
newIndeterminate[id] = true;

for (const b of buildingNodes) {
delete newChecked[b.id];
newIndeterminate[b.id] = true;

const buildingScopeKey = `building::${String(b.structureName)}`;
const excluded = siteExcludedBuildingsRef.current.get(scopeKey);
const isExcluded = excluded && excluded.has(buildingScopeKey);

if (!isExcluded) {
const liveBuildingNode = findNodeById(treeRef.current, b.id) || b;
applySelectionToExistingSubtree(liveBuildingNode, newChecked, newIndeterminate);
}
}

const bulkResults = await runWithLimit(buildingNodes, 6, async (b) => {
const bulk = await getStructureBulk(b.structureName);
const bulkList = Array.isArray(bulk) ? bulk : bulk?._list || [];
return { structureName: b.structureName, bulkList };
});

const siteTypeKeys = new Set();

for (const r of bulkResults) {
const normalized = normalizeBulk({ structureName: r.structureName, bulkList: r.bulkList });

for (const tk of normalized.typeKeys) siteTypeKeys.add(tk);

for (const [typeKey, rows] of normalized.rowsByTypeKey.entries()) {
const [structureName, typeId] = String(typeKey).split('::');
incType({ structureName, typeId, rows });
}
}

scopeToTypeKeysRef.current.set(scopeKey, siteTypeKeys);

rebuildTableFromTypeMap();

setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
});

return;
}

// BUILDING
if (liveNode.level === 2) {
await withLoading(liveNode.id, async () => {
const buildingScopeKey = `building::${String(liveNode.structureName)}`;

const siteScopeKey = getSiteScopeForBuilding(liveNode);
const siteIsActive = siteScopeKey && scopeToTypeKeysRef.current.has(siteScopeKey);

const getBuildingNormalized = async () => {
const bulk = await getStructureBulk(liveNode.structureName);
const bulkList = Array.isArray(bulk) ? bulk : bulk?._list || [];
return normalizeBulk({ structureName: liveNode.structureName, bulkList });
};

if (!nextIsChecked) {
if (siteIsActive) {
const normalized = await getBuildingNormalized();
excludeBuildingFromSite({
siteScopeKey,
buildingScopeKey,
buildingTypeKeys: normalized.typeKeys,
});

delete newChecked[id];
delete newIndeterminate[id];
clearDescendantsVisualState(liveNode, newChecked, newIndeterminate);

rebuildTableFromTypeMap();
setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
return;
}

const typeKeys = scopeToTypeKeysRef.current.get(buildingScopeKey);
if (typeKeys) {
for (const tk of typeKeys) {
const { structureName, typeId } = parseTypeKey(tk);
decType({ structureName, typeId });
}
scopeToTypeKeysRef.current.delete(buildingScopeKey);
}

// REQUIRED FIX: clear stale per-building exclusions when building is turned off
buildingExcludedTypeKeysRef.current.delete(buildingScopeKey);

rebuildTableFromTypeMap();

delete newChecked[id];
delete newIndeterminate[id];
clearDescendantsVisualState(liveNode, newChecked, newIndeterminate);

setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
return;
}

// CHECK BUILDING
if (siteIsActive) {
const excluded = siteExcludedBuildingsRef.current.get(siteScopeKey);
const isExcluded = excluded && excluded.has(buildingScopeKey);

if (isExcluded) {
const normalized = await getBuildingNormalized();
includeBuildingBackIntoSite({
siteScopeKey,
buildingScopeKey,
buildingNormalized: normalized,
});

delete newChecked[id];
newIndeterminate[id] = true;

const liveBuildingNode = findNodeById(treeRef.current, liveNode.id) || liveNode;
applySelectionToExistingSubtree(liveBuildingNode, newChecked, newIndeterminate);

rebuildTableFromTypeMap();
setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
return;
}

delete newChecked[id];
newIndeterminate[id] = true;

const liveBuildingNode = findNodeById(treeRef.current, liveNode.id) || liveNode;
applySelectionToExistingSubtree(liveBuildingNode, newChecked, newIndeterminate);

setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
return;
}

delete newChecked[id];
newIndeterminate[id] = true;

applySelectionToExistingSubtree(liveNode, newChecked, newIndeterminate);

// REQUIRED FIX: reset exclusions on fresh building select so it behaves like "select all"
buildingExcludedTypeKeysRef.current.delete(buildingScopeKey);

const normalized = await getBuildingNormalized();

scopeToTypeKeysRef.current.set(buildingScopeKey, normalized.typeKeys);

for (const [typeKey, rows] of normalized.rowsByTypeKey.entries()) {
const [structureName, typeId] = String(typeKey).split('::');
incType({ structureName, typeId, rows });
}

rebuildTableFromTypeMap();

setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
});

return;
}

// BRANCH (facility/family/etc)
const branchNodeId = liveNode.id;

await withLoading(branchNodeId, async () => {
if (nextIsChecked) {
delete newChecked[id];
newIndeterminate[id] = true;
} else {
delete newChecked[id];
delete newIndeterminate[id];
}

let loadedChildren = [];
let loaded = false;

if (liveNode.level < 4) {
const res = await ensureLoaded(liveNode);
loaded = res.loaded;
loadedChildren = res.children;
}

let typesToToggle = [];

if (liveNode.level === 3 && loaded) {
typesToToggle = loadedChildren.filter((n) => n?.level === 4);
} else {
typesToToggle = collectDescendants(liveNode).filter((n) => n?.level === 4);
}

for (const typeNode of typesToToggle) {
await (async () => {
const typeWasChecked = !!checkedItemsRef.current?.[typeNode.id] || !!indeterminateItemsRef.current?.[typeNode.id];
const shouldCheck = nextIsChecked;

// If branch select-all and leaf already checked, we still want it checked; if unselect, we want it unselected.
// So just toggle directly.
await (async () => {
const typeId = typeNode?.typeId ?? typeNode?.typeDoc?.id;
if (typeId == null) return;

await (async () => {
const leafShouldCheck = shouldCheck;
// reuse the leaf toggle logic by calling handleCheck path:
// We directly invoke toggleLeaf-equivalent by calling handleCheck would be messy here,
// so we rely on the same toggling we used above by just calling toggleLeaf through a closure.
})();
})();
})();

// We can safely reuse the existing leaf toggling function by calling it directly:
// (declare it above branch in code, but we’re inside handleCheck scope; we still have toggleLeaf here)
// So just do:
// eslint-disable-next-line no-await-in-loop
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

// REQUIRED FIX: rebuild ONCE after branch toggles
rebuildTableFromTypeMap();

setCheckedItems(newChecked);
setIndeterminateItems(newIndeterminate);
});
};

 const renderTree = (nodes) => {
  return nodes?.map((node) => {
    if (!node || !node.id) return null;

    const isLeaf = node.level === 4;
    const showCheckbox = node.level >= 3;
    const disableLabelClick = node.level < 3; // <-- NEW: site/building

    return (
      <EntityTreeSearch
        key={node.id}
        nodeId={node.id}
        labelText={node.name}
        checked={!!checkedItems[node.id]}
        showCheckbox={showCheckbox}
        indeterminate={!!indeterminateItems[node.id]}
        disableLabelClick={disableLabelClick} // <-- NEW
        onCheck={(nodeId, checked) => handleCheck(nodeId, checked, node)}
        loadingNodes={!!loadingNodes?.[node.id]} // <-- make prop match component
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
