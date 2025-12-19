const COLLECTIONS = {
    SITE_COLL_DEF: {
        _name: 'Sites collection',
        _shortName: 'geo_sites_coll',
        _description: 'Sites Feature collection',
        _userType: 'geo_sites_coll'
    },
    BUILDINGS_COLL_DEF: {
        _name: 'Buildings Collection',
        _shortName: 'building_coll',
        _description: 'Buildings Collection',
        _userType: 'building_coll'
    },
    MODEL_ELEMENT_DEF: {
        _userType: 'rvt_element'
    },
    MODEL_ELEMENT_PROPERTIES_DEF: {
        _userType: 'rvt_element_props'
    },
    MODEL_ELEMENT_TYPES_DEF: {
        _userType: 'rvt_type_elements'
    }
}

const site = COLLECTIONS.SITE_COLL_DEF;

const building = COLLECTIONS.BUILDINGS_COLL_DEF;

const entityCollections = {
    "site": {
        "entity":site,
        related: {
            buildings: building
        },
        inverslyRelated: {}
    },
    "building": {
        "entity":building,
        related: {},
        inverslyRelated: {
            site: site,
        }
    },
    "modelElement": {
        entity: COLLECTIONS.MODEL_ELEMENT_DEF,
        related: {
            modelProperties: COLLECTIONS.MODEL_ELEMENT_PROPERTIES_DEF,
            modelTypes: COLLECTIONS.MODEL_ELEMENT_TYPES_DEF
        },
        inverslyRelated: {}
    },
}


/* --------------------- small utils --------------------- */

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function uniq(arr) {
    return Array.from(new Set(arr));
}

// Deduplicate by a key function
function uniqBy(arr, keyFn) {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        const key = keyFn(item);
        if (!seen.has(key)) {
            seen.add(key);
            out.push(item);
        }
    }
    return out;
}

function serializeErr(err) {
    return {
        message: err?.message || String(err),
        stack: err?.stack,
    };
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}
const createOrRecreateCollectionFactory = (entityName) => async (input, libraries, ctx, callback) => {

    let { PlatformApi, IafScriptEngine} = libraries

    let proj = await PlatformApi.IafProj.getCurrent(ctx);

    return await IafScriptEngine.createOrRecreateCollection({...entityCollections[entityName].entity, 	_namespaces: proj._namespaces}, ctx);
}

async function createRelatedItem(IafItemSvc, collection, relatedItem, ctx) {
    let result = await IafItemSvc.createRelatedItems(
        collection._userItemId,
        relatedItem,
        ctx
    );
    return result;
}

async function updateRelatedItem(IafItemSvc, collection, relatedItem, ctx) {
    let result = await IafItemSvc.updateRelatedItem(
        collection._userItemId,
        relatedItem._id,
        relatedItem,
        ctx
    );
    return result;
}
async function createRelation(IafItemSvc, relation, parentUserItemId, ctx) {
    if (!relation || !parentUserItemId) return null;

    let relationsResult = await IafItemSvc.addRelations(
        parentUserItemId,
        relation,
        ctx
    );
    return relationsResult;
}
async function getRelations(IafItemSvc, criteria, parentUserItemId, ctx) {
    if (!parentUserItemId) return null;

    let relationsResult = await IafItemSvc.getRelations(
        parentUserItemId,
        criteria,
        ctx
    );
    return relationsResult;
}
async function deleteRelations(IafItemSvc, body, parentUserItemId, ctx) {
    if (!parentUserItemId) return null;

    let relationsResult = await IafItemSvc.deleteRelations(
        parentUserItemId,
        body,
        ctx
    );
    return relationsResult;
}

async function updateRelations(
    IafItemSvc,
    payload,
    parentUserItemId,
    ctx,
    opts = {}
) {
    const {
        order = "create-then-remove",
        chunkSize = 100,
    } = opts;

    if (!IafItemSvc) throw new Error("IafItemSvc is required");
    if (!parentUserItemId) throw new Error("parentUserItemId is required");

    const toCreate = Array.isArray(payload?.toCreate) ? payload.toCreate.filter(Boolean) : [];
    const toRemoveRaw = Array.isArray(payload?.toRemove) ? payload.toRemove.filter(Boolean) : [];

    // Normalize removes to IDs
    const toRemoveIds = uniq(
        toRemoveRaw.map(r => (typeof r === "string" ? r : r?._id)).filter(Boolean)
    );

    // Deduplicate creates (by a stable signature)
    const toCreateDeduped = uniqBy(
        toCreate,
        (r) =>
            `${r._relatedFromId}__${r._relatedUserItemDbId}__${JSON.stringify(
                (Array.isArray(r._relatedToIds) ? [...new Set(r._relatedToIds)] : [])
                    .slice().sort()
            )}`
    ).map(r => ({
        _relatedFromId: r._relatedFromId,
        _relatedToIds: Array.isArray(r._relatedToIds) ? uniq(r._relatedToIds) : [],
        _relatedUserItemDbId: r._relatedUserItemDbId,
    }));

    const result = { created: [], removed: [], errors: [] };

    const runCreates = async () => {
        for (const part of chunk(toCreateDeduped, chunkSize)) {
            if (part.length === 0) continue;
            try {
                // createRelation expects an array of relation objects
                const created = await createRelation(IafItemSvc, part, parentUserItemId, ctx);
                // Some APIs return created rows; collect if available
                if (created) result.created.push(...(Array.isArray(created) ? created : [created]));
            } catch (err) {
                result.errors.push({ op: "createRelation", payload: part, error: serializeErr(err) });
            }
        }
    };

    const runDeletes = async () => {
        for (const part of chunk(toRemoveIds, chunkSize)) {
            if (part.length === 0) continue;
            try {
                await deleteRelations(IafItemSvc, part, parentUserItemId, ctx);
                result.removed.push(...part);
            } catch (err) {
                result.errors.push({ op: "deleteRelations", payload: part, error: serializeErr(err) });
            }
        }
    };

    if (order === "remove-then-create") {
        await runDeletes();
        await runCreates();
    } else {
        // default: "create-then-remove"
        await runCreates();
        await runDeletes();
    }

    return result;
}

const collectionsCache = {}
const getCollections = async (IafItemSvc, _userType, ctx, query = {}) => {
    const key = JSON.stringify({_userType, query})
    if(collectionsCache[key]){
        return collectionsCache[key]
    }
    const q = {...query}
    if(_userType){
        query._userType = _userType
    }
    let res = await IafItemSvc.getNamedUserItems({
        query: {...query, _kind: "collection"}
    }, ctx)
    collectionsCache[key] = res._list
    return res._list
}

const  deleteRelatedItems = async (IafItemSvc, ctx, collection_userType, ids = []) => {

    let coll =(await getCollections(IafItemSvc, collection_userType, ctx))[0]
    const deleteRes= await IafItemSvc.deleteRelatedItems(coll._userItemId, ids);

    return deleteRes;
}

const attachEntityToParentFactory = (entityName, parentEntityName) => async ({entity, parent}, libraries, ctx, callback) => {
    let { PlatformApi } = libraries
    const { IafItemSvc } = PlatformApi

    const entityColl = (await getCollections(IafItemSvc, entityCollections[entityName].entity._userType, ctx))[0]
    const parentCollection = (await getCollections(IafItemSvc, entityCollections[parentEntityName].entity._userType, ctx))[0]

    let relationData = [{
        _relatedFromId: parent._id, //parentid
        _relatedToIds: Array.isArray(entity) ? entity.map(e=>e._id) : [entity._id],
        _relatedUserItemDbId: entityColl._userItemId
    }];

    const relation = await createRelation(IafItemSvc, relationData, parentCollection._userItemId, ctx)
    return relation || {}
}

const getEntityFactory = (entityName) => async (input, libraries, ctx, callback) => {
    let { PlatformApi, IafScriptEngine } = libraries
    const { IafItemSvc } = PlatformApi

    const parent = (await getCollections(IafItemSvc, entityCollections[entityName].entity._userType, ctx))[0]
    const {query = {} } = input || {}

    const q = {
        parent: {
            query: query[entityName] || {},
            collectionDesc: {
                _userItemId: parent._userItemId,
                _userType: parent._userType,
            },
        }
    }
    //console.log("q",q)
    let parentWithChildList = await IafScriptEngine.findWithRelated(q, ctx);
    //console.log("parentWithChildList")
    //console.log("parentWithChildList",parentWithChildList._list.length)


    const entities = parentWithChildList._list || [];

    return entities

}

    const getAllRelatedItemsPaged = async (userItemId, queryObj, IafItemSvc, ctx) => {
    const pageSize = 200
    let offset = 0
    let all = []

    while (true) {
        const res = await IafItemSvc.getRelatedItems(
        userItemId,
        {
            query: queryObj,
            options: { page: { _pageSize: pageSize, _offset: offset } },
        },
        ctx
        )

        const list = res?._list || []
        all = all.concat(list)

        if (list.length < pageSize) break
        offset += pageSize
    }

    return all
    }

const getEntityWithRelatedFactory = (entityName) => async (input, libraries, ctx, callback) => {
  let { PlatformApi, IafScriptEngine } = libraries
  const { IafItemSvc } = PlatformApi

  const parent = (await getCollections(IafItemSvc, entityCollections[entityName].entity._userType, ctx))[0]
  console.log('parent', parent)

  const { query = {}, relatedPaths, inverslyRelatedPaths, relatedFilter } = input || {}

  const relatedInput = relatedPaths?.reduce((accum, r) => {
    accum[r] = entityCollections[entityName].related[r]
    return accum
  }, {})

  const inverslyRelatedInput = inverslyRelatedPaths?.reduce((accum, r) => {
    accum[r] = entityCollections[entityName].inverslyRelated[r]
    return accum
  }, {})

  const related = relatedInput || entityCollections[entityName].related
  const inverslyRelated = inverslyRelatedInput || entityCollections[entityName].inverslyRelated

  let findWithRelated = {
    parent: {
      query: query[entityName] || {},
      collectionDesc: {
        _userItemId: parent._userItemId,
        _userType: parent._userType,
      },
    },
  }

  // IMPORTANT: do NOT filter buildings out of inverslyRelated if you want inverse-fetch
  const relatedWithoutEmbedded = Object.fromEntries(
    Object.entries(related || {}).filter(([key]) => key !== 'buildings')
  )

  const hasRelated = Object.keys(relatedWithoutEmbedded).length > 0
  const hasInverse = inverslyRelated && Object.keys(inverslyRelated).length > 0

  if (hasRelated || hasInverse) {
    findWithRelated.related = []
      .concat(
        hasRelated
          ? Object.entries(relatedWithoutEmbedded).map(([key, r]) => ({
              relatedDesc: { _relatedUserType: r._userType },
              query: query[key] || {},
              as: key,
            }))
          : []
      )
      .concat(
        hasInverse
          ? Object.entries(inverslyRelated).map(([key, r]) => ({
              relatedDesc: { _relatedUserType: r._userType, _isInverse: true },
              query: query[key] || {},
              as: key,
            }))
          : []
      )
  }

  if (relatedFilter) {
    const { filterQuery = {}, relatedFilterPaths, inverslyRelatedFilterPaths, operand = '$and' } = relatedFilter || {}

    const relatedFilterInput = relatedFilterPaths?.reduce((accum, r) => {
      accum[r] = entityCollections[entityName].related[r]
      return accum
    }, {})

    const inverslyRelatedFilterInput = inverslyRelatedFilterPaths?.reduce((accum, r) => {
      accum[r] = entityCollections[entityName].inverslyRelated[r]
      return accum
    }, {})

    const relatedFilterRelated = relatedFilterInput || []
    const relatedFilterInverslyRelated = inverslyRelatedFilterInput || []

    findWithRelated.relatedFilter = {
      includeResult: true,
      [operand]: Object.entries(relatedFilterRelated)
        .map(([key, r]) => ({
          relatedDesc: { _relatedUserType: r._userType },
          query: filterQuery[key] || {},
          as: key,
        }))
        .concat(
          Object.entries(relatedFilterInverslyRelated).map(([key, r]) => ({
            relatedDesc: { _relatedUserType: r._userType, _isInverse: true },
            query: filterQuery[key] || {},
            as: key,
          }))
        ),
    }
  }

  console.log('getEntityWithRelatedFactory findWithRelated', findWithRelated)

  let parentWithChildList = await IafScriptEngine.findWithRelated(findWithRelated, ctx)
  console.log('getEntityWithRelatedFactory parentWithChildList', parentWithChildList)

  const entities = parentWithChildList._list || []

  if(entityName === 'building') {

  const buildingsColl = (await getCollections(IafItemSvc, 'building_coll', ctx))[0]

    await Promise.all(
        entities.map(async (site) => {
        site.buildings = await getAllRelatedItemsPaged(
            buildingsColl._userItemId,
            { siteId: site.siteId },
            IafItemSvc,
            ctx
        )
        })
    )

}

  entities.forEach((e) => {
    e._metadata._userItemId = parent._userItemId

    // related => many
    Object.keys(entityCollections[entityName].related || {}).forEach((prop) => {
      const v = e[prop]
      e[prop] = Array.isArray(v) ? v : v?._list
    })

    // inverslyRelated => ALSO many (do NOT collapse to [0], because buildings is plural)
    Object.keys(entityCollections[entityName].inverslyRelated || {}).forEach((prop) => {
      const v = e[prop]
      e[prop] = Array.isArray(v) ? v : v?._list || []
    })

    // ensure buildings always an array
    if (!Array.isArray(e.buildings)) {
      e.buildings = []
    }
  })

  return entities
}

const getEntityWithRelatedFactoryModel = (entityName) => async (input, libraries, ctx, callback) => {
  let { PlatformApi, IafScriptEngine } = libraries
  const { IafItemSvc } = PlatformApi
  console.log('modelapiinput', input);
  const parent = (await getCollections(IafItemSvc, entityCollections[entityName].entity._userType, ctx))[0]
  console.log('modelapiparent', parent);
  

  const { query = {}, relatedPaths, inverslyRelatedPaths, relatedFilter } = input || {}

  const relatedInput = relatedPaths?.reduce((accum, r) => {
    accum[r] = entityCollections[entityName].related[r]
    return accum
  }, {})

  const inverslyRelatedInput = inverslyRelatedPaths?.reduce((accum, r) => {
    accum[r] = entityCollections[entityName].inverslyRelated[r]
    return accum
  }, {})

  const related = relatedInput || entityCollections[entityName].related
  const inverslyRelated = inverslyRelatedInput || entityCollections[entityName].inverslyRelated

  let findWithRelated = {
    parent: {
      query: query[entityName] || {},
      collectionDesc: {
        _userItemId: parent._userItemId,
        _userType: parent._userType,
      },
    },
  }

  // IMPORTANT: do NOT filter buildings out of inverslyRelated if you want inverse-fetch
  const relatedWithoutEmbedded = Object.fromEntries(
    Object.entries(related || {}).filter(([key]) => key !== 'buildings')
  )

  const hasRelated = Object.keys(relatedWithoutEmbedded).length > 0
  const hasInverse = inverslyRelated && Object.keys(inverslyRelated).length > 0

  if (hasRelated || hasInverse) {
    findWithRelated.related = []
      .concat(
        hasRelated
          ? Object.entries(relatedWithoutEmbedded).map(([key, r]) => ({
              relatedDesc: { _relatedUserType: r._userType },
              query: query[key] || {},
              as: key,
            }))
          : []
      )
      .concat(
        hasInverse
          ? Object.entries(inverslyRelated).map(([key, r]) => ({
              relatedDesc: { _relatedUserType: r._userType, _isInverse: true },
              query: query[key] || {},
              as: key,
            }))
          : []
      )
  }

  if (relatedFilter) {
    const { filterQuery = {}, relatedFilterPaths, inverslyRelatedFilterPaths, operand = '$and' } = relatedFilter || {}

    const relatedFilterInput = relatedFilterPaths?.reduce((accum, r) => {
      accum[r] = entityCollections[entityName].related[r]
      return accum
    }, {})

    const inverslyRelatedFilterInput = inverslyRelatedFilterPaths?.reduce((accum, r) => {
      accum[r] = entityCollections[entityName].inverslyRelated[r]
      return accum
    }, {})

    const relatedFilterRelated = relatedFilterInput || []
    const relatedFilterInverslyRelated = inverslyRelatedFilterInput || []

    findWithRelated.relatedFilter = {
      includeResult: true,
      [operand]: Object.entries(relatedFilterRelated)
        .map(([key, r]) => ({
          relatedDesc: { _relatedUserType: r._userType },
          query: filterQuery[key] || {},
          as: key,
        }))
        .concat(
          Object.entries(relatedFilterInverslyRelated).map(([key, r]) => ({
            relatedDesc: { _relatedUserType: r._userType, _isInverse: true },
            query: filterQuery[key] || {},
            as: key,
          }))
        ),
    }
  }

  console.log('getEntityWithRelatedFactory findWithRelated', findWithRelated)

  let parentWithChildList = await IafScriptEngine.findWithRelated(findWithRelated, ctx)
  console.log('getEntityWithRelatedFactory parentWithChildList', parentWithChildList)

  const entities = parentWithChildList._list || []

  if(entityName === 'building') {

  const buildingsColl = (await getCollections(IafItemSvc, 'building_coll', ctx))[0]

    await Promise.all(
        entities.map(async (site) => {
        site.buildings = await getAllRelatedItemsPaged(
            buildingsColl._userItemId,
            { siteId: site.siteId },
            IafItemSvc,
            ctx
        )
        })
    )

}

  entities.forEach((e) => {
    e._metadata._userItemId = parent._userItemId

    // related => many
    Object.keys(entityCollections[entityName].related || {}).forEach((prop) => {
      const v = e[prop]
      e[prop] = Array.isArray(v) ? v : v?._list
    })

    // inverslyRelated => ALSO many (do NOT collapse to [0], because buildings is plural)
    Object.keys(entityCollections[entityName].inverslyRelated || {}).forEach((prop) => {
      const v = e[prop]
      e[prop] = Array.isArray(v) ? v : v?._list || []
    })

    // ensure buildings always an array
    if (!Array.isArray(e.buildings)) {
      e.buildings = []
    }
  })

  console.log('modelapientities', entities);

  return entities
}

const updateEntityFactory = (entityName) => async (input = null, libraries, ctx, callback) => {
    const { PlatformApi } = libraries
    const { IafItemSvc } = PlatformApi

    if(!input) return;

    let coll =(await getCollections(IafItemSvc, entityCollections[entityName].entity._userType, ctx))[0];
    let result = await IafItemSvc.updateRelatedItem(coll._userItemId, input._id, input, ctx)

    return result
}

const deleteEntityFactory = (entityName) => async (input = null, libraries, ctx, callback) => {
    const { PlatformApi } = libraries
    const { IafItemSvc } = PlatformApi

    const {id = null} = input || {};

    if(!id) return;

    return await deleteRelatedItems(IafItemSvc,ctx, entityCollections[entityName].entity._userType, [id]);
}

const createEntityFactory = (entityName) => async (input = null, libraries, ctx, callback) => {
    const { PlatformApi } = libraries
    const { IafItemSvc } = PlatformApi
    if(!input) return;
    const requestId = input.requestId || uuidv4();
    let coll =(await getCollections(IafItemSvc, entityCollections[entityName].entity?._userType, ctx))[0]
    let result = await IafItemSvc.createRelatedItems(coll._userItemId, [{...input,requestId}], ctx, {})
    const persisted = (await IafItemSvc.getRelatedItems(coll._userItemId, {query:{requestId}}, ctx))._list[0];
    if (entityName === 'building' && input.siteId) {
    const sitesColl = (await getCollections(IafItemSvc, 'geo_sites_coll', ctx))[0]

    const siteRes = await IafItemSvc.getRelatedItems(
      sitesColl._userItemId,
      { query: { siteId: input.siteId } },
      ctx
    )

    const site = siteRes?._list?.[0]

    if (site) {
      const current = Array.isArray(site.buildings) ? site.buildings : []

      // de-dupe by buildingId or _id (choose what’s stable for you)
      const next = current.some((b) => b?.buildingId === persisted?.buildingId || b?._id === persisted?._id)
        ? current
        : current.concat(persisted)

      // IMPORTANT: use the correct update method your SDK provides
      // If you have IafItemSvc.updateRelatedItems / updateItem / patch etc., use that.
      await IafItemSvc.updateRelatedItems(
        sitesColl._userItemId,
        [{ ...site, buildings: next }],
        ctx,
        {}
      )
    }
  }
    return persisted
}


/*
Create and attach steps at once for comment
 */
const createAndAttachToEntityFactory = (entityName, parentEntityName) => async ({parent, entity}, libraries, ctx, callback) => {
    let { PlatformApi } = libraries
    const { IafItemSvc } = PlatformApi

    const createFactory = createEntityFactory(entityName);

    const parentColl = (await getCollections(IafItemSvc, entityCollections[parentEntityName].entity?._userType, ctx))[0]
    const entityColl = (await getCollections(IafItemSvc, entityCollections[entityName].entity?._userType, ctx))[0]
    const persisted = (await createFactory(entity,libraries, ctx, callback));

    let relationData = [{
        _relatedFromId: parent._id, //parentid
        _relatedToIds: [persisted._id], // comments id
        _relatedUserItemDbId: entityColl._userItemId
    }];

    const relation = await createRelation(IafItemSvc, relationData, parentColl._userItemId, ctx)
    return persisted
}

// Factory: create a new entity, then attach it to exactly one parent resolved by a key on the entity.
// If multiple parents match, keeps the canonical one and removes relations to the others.
const createAndAttachToOneParentFactory = (entityName, parentEntityName) => async ({ parentKeyId= "siteId", entity }, libraries, ctx, callback) => {
    const { PlatformApi } = libraries;
    const { IafItemSvc } = PlatformApi;

    // Helper: pick exactly one canonical parent deterministically
    function chooseCanonicalParent(parents) {
        if (!Array.isArray(parents) || parents.length === 0) return null;
        // Prefer most recently updated; fallback to created; then array order
        const score = (p) => {
            const u = p._updatedAt ? new Date(p._updatedAt).getTime() : 0;
            const c = p._createdAt ? new Date(p._createdAt).getTime() : 0;
            return Math.max(u, c);
        };
        return parents.slice().sort((a, b) => score(b) - score(a))[0];
    }

    if (!parentKeyId) {
        throw new Error("parentKeyId is required");
    }
    if (!entity || entity[parentKeyId] == null) {
        throw new Error(`entity.${parentKeyId} is required to resolve the parent. Entity: ${JSON.stringify(entity)}`);
    }

    // 1) Create the new entity
    const createEntity = createEntityFactory(entityName);
    const persisted = await createEntity(entity, libraries, ctx, callback);

    // 2) Resolve collections
    const parentColl = (await getCollections(
        IafItemSvc,
        entityCollections[parentEntityName].entity?._userType,
        ctx
    ))?.[0];
    const entityColl = (await getCollections(
        IafItemSvc,
        entityCollections[entityName].entity?._userType,
        ctx
    ))?.[0];

    if (!parentColl?.[ "_userItemId" ]) {
        throw new Error(`Parent collection not found for ${parentEntityName}`);
    }
    if (!entityColl?.[ "_userItemId" ]) {
        throw new Error(`Entity collection not found for ${entityName}`);
    }

    // 3) Fetch ALL candidate parents by key on the entity
    const getParent = getEntityFactory(parentEntityName);
    const parentQuery = { [parentEntityName]: { [parentKeyId]: entity[parentKeyId] } };
    const parentsResult = await getParent({ query: parentQuery }, libraries, ctx, callback);
    const parentList = Array.isArray(parentsResult)
        ? parentsResult
        : (parentsResult ? [parentsResult] : []);

    if (parentList.length === 0) {
        throw new Error(
            `No ${parentEntityName} found where ${parentKeyId} == ${String(entity[parentKeyId])}`
        );
    }

    // 4) Choose canonical parent, treat the rest as "unnecessary"
    const canonicalParent = chooseCanonicalParent(parentList);
    const unnecessaryParents = parentList.filter(p => p._id !== canonicalParent._id);

    // 5) Find existing relations (any parent → this child, within this relation space & child collection)
    let existingRels = (await getRelations(
        IafItemSvc,
        parentColl._userItemId,
        ctx,
        {
            _relatedToId: persisted._id,                         // SDK should match where child id is in _relatedToIds
            _relatedUserItemDbId: entityColl._userItemId,        // make sure it's the same child collection binding
        }
    )) || [];
    existingRels = existingRels._list ? existingRels._list : []

    // 6) Ensure no attachments to unnecessary parents
    //    - If a relation row from an unnecessary parent contains this child, remove it (update or delete if empty)
    for (const rel of existingRels) {
        if (rel._relatedFromId && unnecessaryParents.some(p => p._id === rel._relatedFromId)) {
            const toIds = Array.isArray(rel._relatedToIds) ? rel._relatedToIds.slice() : [];
            const idx = toIds.indexOf(persisted._id);
            if (idx !== -1) toIds.splice(idx, 1);

            if (toIds.length === 0) {
                await deleteRelations(IafItemSvc, [rel], parentColl._userItemId, ctx);
            } else {
                const updated = { ...rel, _relatedToIds: toIds };
                await updateRelations(IafItemSvc, {toRemove: [rel], toCreate: [updated]}, parentColl._userItemId, ctx);
            }
        }
    }

    // 7) Also proactively sweep any relation rows *owned by the unnecessary parents* that might include this child,
    //    even if they weren't caught above (defensive clean-up).
    for (const badParent of unnecessaryParents) {
        let badParentRows = (await getRelations(
            IafItemSvc,
            parentColl._userItemId,
            ctx,
            {
                _relatedFromId: badParent._id,
                _relatedUserItemDbId: entityColl._userItemId,
            }
        )) || [];
        badParentRows = badParentRows._list ? badParentRows._list : badParentRows;

        for (const rel of badParentRows) {
            if (Array.isArray(rel._relatedToIds) && rel._relatedToIds.includes(persisted._id)) {
                const toIds = rel._relatedToIds.filter(id => id !== persisted._id);
                if (toIds.length === 0) {
                    await deleteRelations(IafItemSvc, [rel], parentColl._userItemId, ctx);
                } else {
                    await updateRelations(
                        IafItemSvc,
                        { toRemove: [rel], toCreate: [{...rel, _relatedToIds: toIds}] },
                        parentColl._userItemId,
                        ctx
                    );
                }
            }
        }
    }

    // 8) Now ensure attachment to the canonical parent
    let canonicalRows = (await getRelations(
        IafItemSvc,
        parentColl._userItemId,
        ctx,
        {
            _relatedFromId: canonicalParent._id,
            _relatedUserItemDbId: entityColl._userItemId,
        }
    )) || [];
    canonicalRows = canonicalRows._list ? canonicalRows._list : canonicalRows;

    // If there's already a row for canonical parent → child-collection, append child id if missing
    const parentRow = canonicalRows.find(r => r._relatedFromId === canonicalParent._id);
    if (parentRow) {
        const toIds = new Set(parentRow._relatedToIds || []);
        if (!toIds.has(persisted._id)) {
            toIds.add(persisted._id);
            await updateRelations(
                IafItemSvc,
                { toRemove: [parentRow], toCreate: [{ ...parentRow, _relatedToIds: Array.from(toIds) }] },
                parentColl._userItemId,
                ctx
            );
        }
    } else {
        const relationData = [
            {
                _relatedFromId: canonicalParent._id,
                _relatedToIds: [persisted._id],
                _relatedUserItemDbId: entityColl._userItemId,
            },
        ];
        await createRelation(IafItemSvc, relationData, parentColl._userItemId, ctx);
    }

    // Optional: return extra metadata so callers can see what was cleaned up
    persisted.__parentResolution = {
        canonicalParentId: canonicalParent._id,
        removedParentIds: unnecessaryParents.map(p => p._id),
    };

    return persisted;
};

const updateAndAttachToOneParentFactory = (entityName, parentEntityName) => async ({ parentKeyId= "siteId", entity }, libraries, ctx, callback) => {
    const { PlatformApi } = libraries;
    const { IafItemSvc } = PlatformApi;

    // Helper: pick exactly one canonical parent deterministically
    function chooseCanonicalParent(parents) {
        if (!Array.isArray(parents) || parents.length === 0) return null;
        // Prefer most recently updated; fallback to created; then array order
        const score = (p) => {
            const u = p._updatedAt ? new Date(p._updatedAt).getTime() : 0;
            const c = p._createdAt ? new Date(p._createdAt).getTime() : 0;
            return Math.max(u, c);
        };
        return parents.slice().sort((a, b) => score(b) - score(a))[0];
    }

    if (!parentKeyId) {
        throw new Error("parentKeyId is required");
    }
    if (!entity || entity[parentKeyId] == null) {
        throw new Error(`entity.${parentKeyId} is required to resolve the parent. Entity: ${JSON.stringify(entity)}`);
    }

    // 1) Update the entity
    const updateEntity = updateEntityFactory(entityName);
    const persisted = await updateEntity(entity, libraries, ctx, callback);

    // 2) Resolve collections
    const parentColl = (await getCollections(
        IafItemSvc,
        entityCollections[parentEntityName].entity?._userType,
        ctx
    ))?.[0];
    const entityColl = (await getCollections(
        IafItemSvc,
        entityCollections[entityName].entity?._userType,
        ctx
    ))?.[0];

    if (!parentColl?.[ "_userItemId" ]) {
        throw new Error(`Parent collection not found for ${parentEntityName}`);
    }
    if (!entityColl?.[ "_userItemId" ]) {
        throw new Error(`Entity collection not found for ${entityName}`);
    }

    // 3) Fetch ALL candidate parents by key on the entity
    const getParent = getEntityFactory(parentEntityName);
    const parentQuery = { [parentEntityName]: { [parentKeyId]: entity[parentKeyId] } };
    const parentsResult = await getParent({ query: parentQuery }, libraries, ctx, callback);
    const parentList = Array.isArray(parentsResult)
        ? parentsResult
        : (parentsResult ? [parentsResult] : []);

    if (parentList.length === 0) {
        throw new Error(
            `No ${parentEntityName} found where ${parentKeyId} == ${String(entity[parentKeyId])}`
        );
    }

    // 4) Choose canonical parent, treat the rest as "unnecessary"
    const canonicalParent = chooseCanonicalParent(parentList);
    const unnecessaryParents = parentList.filter(p => p._id !== canonicalParent._id);

    // 5) Find existing relations (any parent → this child, within this relation space & child collection)
    let existingRels = (await getRelations(
        IafItemSvc,
        parentColl._userItemId,
        ctx,
        {
            _relatedToId: persisted._id,                         // SDK should match where child id is in _relatedToIds
            _relatedUserItemDbId: entityColl._userItemId,        // make sure it's the same child collection binding
        }
    )) || [];
    existingRels = existingRels._list ? existingRels._list : []

    // 6) Ensure no attachments to unnecessary parents
    //    - If a relation row from an unnecessary parent contains this child, remove it (update or delete if empty)
    for (const rel of existingRels) {
        if (rel._relatedFromId && unnecessaryParents.some(p => p._id === rel._relatedFromId)) {
            const toIds = Array.isArray(rel._relatedToIds) ? rel._relatedToIds.slice() : [];
            const idx = toIds.indexOf(persisted._id);
            if (idx !== -1) toIds.splice(idx, 1);

            if (toIds.length === 0) {
                await deleteRelations(IafItemSvc, [rel], parentColl._userItemId, ctx);
            } else {
                const updated = { ...rel, _relatedToIds: toIds };
                await updateRelations(IafItemSvc, {toRemove: [rel], toCreate: [updated]}, parentColl._userItemId, ctx);
            }
        }
    }

    // 7) Also proactively sweep any relation rows *owned by the unnecessary parents* that might include this child,
    //    even if they weren't caught above (defensive clean-up).
    for (const badParent of unnecessaryParents) {
        let badParentRows = (await getRelations(
            IafItemSvc,
            parentColl._userItemId,
            ctx,
            {
                _relatedFromId: badParent._id,
                _relatedUserItemDbId: entityColl._userItemId,
            }
        )) || [];
        badParentRows = badParentRows._list ? badParentRows._list : badParentRows;

        for (const rel of badParentRows) {
            if (Array.isArray(rel._relatedToIds) && rel._relatedToIds.includes(persisted._id)) {
                const toIds = rel._relatedToIds.filter(id => id !== persisted._id);
                if (toIds.length === 0) {
                    await deleteRelations(IafItemSvc, [rel], parentColl._userItemId, ctx);
                } else {
                    await updateRelations(
                        IafItemSvc,
                        { toRemove: [rel], toCreate: [{...rel, _relatedToIds: toIds}] },
                        parentColl._userItemId,
                        ctx
                    );
                }
            }
        }
    }

    // 8) Now ensure attachment to the canonical parent
    let canonicalRows = (await getRelations(
        IafItemSvc,
        parentColl._userItemId,
        ctx,
        {
            _relatedFromId: canonicalParent._id,
            _relatedUserItemDbId: entityColl._userItemId,
        }
    )) || [];
    canonicalRows = canonicalRows._list ? canonicalRows._list : canonicalRows;

    // If there's already a row for canonical parent → child-collection, append child id if missing
    const parentRow = canonicalRows.find(r => r._relatedFromId === canonicalParent._id);
    if (parentRow) {
        const toIds = new Set(parentRow._relatedToIds || []);
        if (!toIds.has(persisted._id)) {
            toIds.add(persisted._id);
            await updateRelations(
                IafItemSvc,
                { toRemove: [parentRow], toCreate: [{ ...parentRow, _relatedToIds: Array.from(toIds) }] },
                parentColl._userItemId,
                ctx
            );
        }
    } else {
        const relationData = [
            {
                _relatedFromId: canonicalParent._id,
                _relatedToIds: [persisted._id],
                _relatedUserItemDbId: entityColl._userItemId,
            },
        ];
        await createRelation(IafItemSvc, relationData, parentColl._userItemId, ctx);
    }

    // Optional: return extra metadata so callers can see what was cleaned up
    persisted.__parentResolution = {
        canonicalParentId: canonicalParent._id,
        removedParentIds: unnecessaryParents.map(p => p._id),
    };

    return persisted;
};


const getRelatedDistinctFieldsFactory = (entityName) => async (input, libraries, ctx, callback) => {

    let { PlatformApi, IafScriptEngine } = libraries
    const { IafItemSvc, IafFetch, IafSession, IafProj } = PlatformApi

    const parent = (await getCollections(IafItemSvc, entityCollections[entityName].entity._userType, ctx))[0]
    const {query = {}, relatedPaths, inverslyRelatedPaths, relatedDistinctFields } = input || {}

    //RELATED
    const relatedInput = relatedPaths?.reduce((accum,r)=>{
        accum[r] = entityCollections[entityName].related[r]
        return accum;
    },{});
    const inverslyRelatedInput = inverslyRelatedPaths?.reduce((accum,r)=>{
        accum[r] = entityCollections[entityName].inverslyRelated[r];
        return accum;
    },{});

    const related = relatedInput || entityCollections[entityName].related;
    const inverslyRelated = inverslyRelatedInput || entityCollections[entityName].inverslyRelated;

    let findWithRelated = {
        parent: {
            query: query[entityName] || {},
            collectionDesc: {
                _userItemId: parent._userItemId,
                _userType: parent._userType,
            },
        }
    };

    if(related && Object.keys(related).length>0){

        const { field = {}, query={} } = relatedDistinctFields

        findWithRelated.relatedDistinctFields = Object.entries(related).map(([key,r])=>(
            {
                relatedDesc: {_relatedUserType: r._userType},
                query: query[key] || {},
                field: field[key] || {},
                as: key,
            })).concat(Object.entries(inverslyRelated).map(([key,r])=>({
            relatedDesc: {_relatedUserType: r._userType, _isInverse: true},
            query: query[key] || {},
            field: field[key] || {},
            as: key,
        })))
    }

    const refArray = Object.keys(related).concat(Object.keys(inverslyRelated));

    //console.log("getRelatedDistinctFieldsFactory",{related, findWithRelated,relatedDistinctFields});

    let p = await IafProj.getCurrent();
    const baseUri = IafFetch.CONFIG.itemServiceOrigin;
    const namespace = encodeURI(`nsfilter=${p._namespaces[0]}`);
    const response = await fetch(`${baseUri}/itemsvc/api/v1/nameduseritems/search?${namespace}`, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': IafSession.getAuthToken()
        },
        body: JSON.stringify({$findWithRelated:findWithRelated})
    });

    const result = await response.json();
    //console.log("getRelatedDistinctFieldsFactory",{related, findWithRelated,result,relatedDistinctFields});
    return result?._list[0]?._versions?.[0]?._relatedDistinctFields.reduce((accum,data,i)=>{accum[refArray[i]]=data;return accum;},{}) || {}
}

const getDistinctFieldsFactory = (entityName) => async (input, libraries, ctx, callback) => {

    let { PlatformApi, IafScriptEngine } = libraries
    const { IafItemSvc, IafFetch, IafSession, IafProj } = PlatformApi

    const {fields = [] } = input || {}

    let distinctWithMultiInput = fields.map(field=>({
        query: field.query || {},
        field: field.name,
        collectionDesc: entityCollections[entityName].entity,
        "collectionProject": {
            "_id": 1,
            "_userItemId": 1
        },
    }));

    let distinctWithMulti = await IafScriptEngine.getDistinctMulti(distinctWithMultiInput, ctx);
    console.log("distinctWithMulti",{input, distinctWithMultiInput,distinctWithMulti});

    const distinctRelatedItemFields = {
        collectionDesc: entityCollections[entityName].entity,
        "collectionProject": {
            "_id": 1,
            "_userItemId": 1
        },
        "fieldDesc": fields.map(field=>({
            query: field.query || {},
            field: field.name,
            count: field.count,
        }))

    }

    let p = ctx || await IafProj.getCurrent();

    const baseUri = IafFetch.CONFIG.itemServiceOrigin;
    const namespace = encodeURI(`nsfilter=${p._namespaces[0]}`);
    const response = await fetch(`${baseUri}/itemsvc/api/v1/nameduseritems/search?${namespace}`, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': IafSession.getAuthToken(ctx)
        },
        body: JSON.stringify({$distinctRelatedItemFields: distinctRelatedItemFields})
    });

    const result = await response.json();

    const aggregatedResult = {};
    result?._list.map(collection=>{
        const items = collection?._versions?.[0]?._relatedItems;
        if(items){
            Object.entries(items).forEach(([fieldName, uniqueValues])=>{
                uniqueValues.map(uniqueValue=> {
                    aggregatedResult[fieldName] = aggregatedResult[fieldName] || [];

                    if(Object(uniqueValue) !== uniqueValue){
                        const existingValue = aggregatedResult[fieldName].find(ev=>ev.value == uniqueValue);

                        if(!existingValue){
                            aggregatedResult[fieldName].push({value : uniqueValue})
                        }
                    } else {
                        const existingValue = aggregatedResult[fieldName].find(ev=>ev.value == uniqueValue.value);

                        if(existingValue){
                            existingValue.count = existingValue.count + uniqueValue.count;
                        } else {
                            aggregatedResult[fieldName].push(uniqueValue)
                        }
                    }

                })
            })
        }
    })
    console.log("getDistinctFieldsFactory",{input, distinctRelatedItemFields,result, aggregatedResult});
    return {result,aggregatedResult}
}

function decodeDecimal128({ high, low, negative }) {
    const SIGN_BIT_MASK = 0x8000000000000000n;
    const COMBINATION_MASK = 0x7C00000000000000n;
    const EXPONENT_CONTINUATION_MASK = 0x03FFC00000000000n;
    const SIGNIFICAND_MASK = 0x00003FFFFFFFFFFFn;

    // Convert to BigInts
    let highBig = BigInt(high);
    let lowBig = BigInt(low);

    // Combine high and low into a full 128-bit value
    const full = (highBig << 64n) | lowBig;

    // Extract sign
    const isNegative = (highBig & SIGN_BIT_MASK) !== 0n;

    // Extract the combination field (bits 1-5 after sign)
    const comb = (highBig & COMBINATION_MASK) >> 58n;

    // Handle special values
    if (comb === 0x1f) return NaN;
    if (comb === 0x1e) return isNegative ? -Infinity : Infinity;

    // Extract exponent (bits 1–14 after sign)
    const biasedExponent = Number((highBig >> 49n) & 0x3FFFn);
    const exponent = biasedExponent - 6176; // Decimal128 bias is 6176

    // Extract significand (coefficient)
    // We'll combine the last 49 bits of high + all 64 of low
    const significandHigh = highBig & 0x0001FFFFFFFFFFFFn;
    const significand = (significandHigh << 64n) | lowBig;

    // Now convert to a decimal using BigInt math and scaling
    const decimalValue = BigInt(significand.toString());

    // Convert to float (approximate!)
    const floatVal = Number(decimalValue) * 10 ** exponent;

    return isNegative ? -floatVal : floatVal;
}

function modifyCoordinates(coords, callback) {
    return coords.map(item => {
        if (Array.isArray(item)) {
            return modifyCoordinates(item, callback); // recurse into nested arrays
        } else if (typeof item === "object") {
            return callback(item); // apply transformation to object
        } else {
            return item; // if it's neither array nor number, leave it as is
        }
    });
}

const withDecimalFix = (originalFn) => async (input, libraries, ctx, callback) => {
    const resultList = await originalFn(input, libraries, ctx, callback);
    const fixedResult = resultList.map(r=>{
        if(r.latitude && typeof r.latitude === 'object' && !Array.isArray(r.latitude) && r.latitude !== null){
            r.latitude = decodeDecimal128(r.latitude)
        }
        if(r.longitude && typeof r.longitude === 'object' && !Array.isArray(r.longitude) && r.longitude !== null){
            r.longitude = decodeDecimal128(r.longitude)
        }
        if(r.coordinates && typeof r.coordinates === 'object' && Array.isArray(r.coordinates) && r.coordinates !== null){
            r.coordinates = modifyCoordinates(r.coordinates, decodeDecimal128)
        }
        return r;
    })
    return fixedResult;
}

const statusHierarchy = ['REGISTERED', 'APPROVED', 'CLOSED'];
const rank = s => statusHierarchy.indexOf(s);

function computeSiteECStats(sites, ecs, logs, siteRollup = 'any-closed' /* 'all-closed' | 'any-closed' */ ) {
    // 1) Per-target aggregation: site:unit:equipment:ecid -> highest status
    const perTarget = new Map(); // key -> { site, unit, equip, siteEquip, ecid, status }
    for (const log of logs) {
        const site = log.site;
        const unit = log.unit ?? '';
        const equip = log['Equipment Id'] || '';
        const siteEquip = log['Site Equipment Id'] || '';
        const ecid = log.ecid;
        const status = log.status;

    if (!site || !ecid || !status) continue;

        const key = `${site}:${unit}:${equip}:${ecid}`;
        const cur = perTarget.get(key);
        if (!cur || rank(status) > rank(cur.status)) {
            perTarget.set(key, { site, unit, equip, siteEquip, ecid, status });
        }
    }

    // 2) Build site → unit → equipment structures
    const bySite = new Map();
    for (const { site, unit, equip, siteEquip, ecid, status } of perTarget.values()) {
        if (!bySite.has(site)) bySite.set(site, { targets: [], byUnit: new Map() });
        const S = bySite.get(site);
        S.targets.push({ unit, equip, siteEquip, ecid, status });

        if (!S.byUnit.has(unit)) S.byUnit.set(unit, []);
        S.byUnit.get(unit).push({ equip, siteEquip, ecid, status });
    }

    // 3) Per-unit statusCounts (counts per equipment target)
    function emptyCounts() { return { REGISTERED: { _total: 0 }, APPROVED: { _total: 0 }, CLOSED: { _total: 0 } }; }

    const results = sites.map(({ siteId }) => {
        const siteData = bySite.get(siteId);
        const statusCountsPerUnit = {};
        const siteLevelECStatus = new Map(); // ecid -> rolled-up site status for that EC

        if (!siteData) {
            return {
                siteId,
                totalEC: 0,
                statusCounts: emptyCounts(),
                statusCountsPerUnit: {}
            };
        }

        // Per-unit
        for (const [unit, items] of siteData.byUnit.entries()) {
            const counts = emptyCounts();
            for (const { status } of items) counts[status]._total += 1;
            statusCountsPerUnit[unit] = counts;
        }

        // 4) Roll-up to site-level EC status (one status per EC/SiteEquip pair per site)
        // Group targets by ecid/site Equip pair
        const byEcidAndSiteEquip = new Map();
        for (const t of siteData.targets) {
            const key = `${t.ecid}/${t.siteEquip}`
            if (!byEcidAndSiteEquip.has(key)) byEcidAndSiteEquip.set(key, []);
            byEcidAndSiteEquip.get(key).push(t.status);
        }

        for (const [key, statuses] of byEcidAndSiteEquip.entries()) {
            const r = statuses.map(rank);
            const siteStatus =
                siteRollup === 'all-closed'
                    ? statusHierarchy[Math.min(...r)] // lowest wins; CLOSED only if all closed
                    : statusHierarchy[Math.max(...r)]; // highest wins
            siteLevelECStatus.set(key, siteStatus);
        }

        // 5) Per-site statusCounts over ECs (not per equipment)
        const siteCounts = emptyCounts();
        for (const s of siteLevelECStatus.values()) siteCounts[s]._total += 1;

        return {
            siteId,
            totalEC: siteLevelECStatus.size,
            statusCounts: siteCounts,
            statusCountsPerUnit
        };
    });

    return results;
}



function computeSiteECStats2(sites, engineeringChanges, logs) {

    const statusHierarchy = ['REGISTERED', 'APPROVED', 'CLOSED'];

    const siteUnitECStatus = {};

    for (const log of logs) {
        const { site, unit, ecid, status } = log;
        const key = `${site}:${unit}:${ecid}`;
        const current = siteUnitECStatus[key];

        if (!current || statusHierarchy.indexOf(status) > statusHierarchy.indexOf(current)) {
            siteUnitECStatus[key] = status;
        }
    }

    // Aggregate per site
    const result = sites.map(({ siteId }) => {

        const statuses = { REGISTERED: { _total: 0 }, APPROVED: { _total: 0 }, CLOSED: { _total: 0 } };
        const statusesPerUnit = {};


        const rendomFacility = Math.random() < 0.5 ? "A" : "B";

        const ecForSite = Object.entries(siteUnitECStatus).filter(([key]) => key.startsWith(/*siteId*/ rendomFacility + ":"));

        for (const [key, status] of ecForSite) {
            const [, unit] = key.split(":"); // extract unit
            statuses[status]._total++;
            if (!statusesPerUnit[unit]) {
                statusesPerUnit[unit] = { REGISTERED:  { _total: 0 }, APPROVED:  { _total: 0 }, CLOSED:  { _total: 0 } };
            }
            statusesPerUnit[unit][status]._total++;
        }

        return {
            siteId,
            totalEC: ecForSite.length,
            statusCounts: statuses,
            statusCountsPerUnit: statusesPerUnit
        };
    });

    return result;
}


//SITE ENTITY
const createSite =  (input, libraries, ctx) => createEntityFactory("site")(input?.params || {}, libraries, ctx);
const updateSite =  (input, libraries, ctx) => updateEntityFactory("site")(input?.params || {}, libraries, ctx);
const deleteSite =  (input, libraries, ctx) => deleteEntityFactory("site")(input?.params || {}, libraries, ctx);
export const getSitesWithRelated = withDecimalFix(getEntityWithRelatedFactory("site"));

export const getSitesWithRelatedHit = async (input, libraries, ctx) => {


    const { IafItemSvc } = libraries.PlatformApi;

    const siteIdToFacilityIdMap = {
        "Belleville": "A",
        "St. Laurent": "B",
    }

    const buildingIdToUnitMap = {
        "Belleville-1": "01",
        "Belleville-2": "02",
        "St. Laurent-A1": "01",
        "St. Laurent-B2": "02",
    }

    const sites = await withDecimalFix(getEntityWithRelatedFactory("site"))(input?.params || {}, libraries, ctx);

    let collections = await IafItemSvc.getNamedUserItems({
        query: { _userType: { $in: ["ecs", "ecs-logs"]} , _itemClass: 'NamedUserCollection' }
    }, ctx, { page: {_pageSize: 10, _offset: 0}})

    const ecsColl =  collections._list.find(c => c._userType === "ecs")
    const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")


    const ecs = (await IafItemSvc.getRelatedItems(ecsColl._userItemId, {}, ctx, { page: { getAllItems: true }}))?._list
    let relatedLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, { query: {} }, ctx, { page: { getAllItems: true }}))?._list

    const ecStats = computeSiteECStats([{siteId:"A"},{siteId:"B"}], ecs, relatedLogs);

    const defaultEcsByStatus = {
            "REGISTERED": {
               "_total": 0
            },
            "APPROVED": {
               "_total": 0
            },
            "CLOSED": {
               "_total": 10
            }
    }
    sites.forEach(site=>{
        const randomFacility = Math.random() < 0.5 ? "A" : "B";
        const siteECStats = ecStats.find(stat=>stat.siteId==siteIdToFacilityIdMap[site.siteId]);
        site.ecsByStatus = siteECStats?.statusCounts || defaultEcsByStatus;
        if(site.buildings){
            site.buildings.forEach(building=>{
                const randomUnit = Math.random() < 0.5 ? "01" : "02";
                building.ecsByStatus = siteECStats?.statusCountsPerUnit?.[buildingIdToUnitMap[building.buildingId]] || defaultEcsByStatus
            });
        }
    });

    return sites;



}

const getBuildingsWithRelated = async (input, libraries, ctx) => {
    const siteIdToFacilityIdMap = {
        "Belleville": "A",
        "St. Laurent": "B",
    }

    const buildingIdToUnitMap = {
        "Belleville-1": "01",
        "Belleville-2": "02",
        "St. Laurent-A1": "01",
        "St. Laurent-B2": "02",
    }


    const buildings = await withDecimalFix(getEntityWithRelatedFactory("building"))(input?.params || {}, libraries, ctx);

    let collections = await IafItemSvc.getNamedUserItems({
        query: { _userType: { $in: ["ecs", "ecs-logs"]} , _itemClass: 'NamedUserCollection' }
    }, ctx, { page: {_pageSize: 10, _offset: 0}})

    const ecsColl =  collections._list.find(c => c._userType === "ecs")
    const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")


    const ecs = (await IafItemSvc.getRelatedItems(ecsColl._userItemId, {}, ctx, { page: { getAllItems: true }}))?._list
    let relatedLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, { query: {} }, ctx, { page: { getAllItems: true }}))?._list

    const siteIds = buildings.map(b=>b.siteId).filter(siteId=>!!siteId)
    const sites = [...new Set(siteIds)].map(siteId=>({siteId}));
    const ecStats = computeSiteECStats([{siteId:"A"},{siteId:"B"}], ecs, relatedLogs);

    buildings.forEach(building=>{
        const randomFacility = Math.random() < 0.5 ? "A" : "B";
        const randomUnit = Math.random() < 0.5 ? "01" : "02";
        const siteECStats = ecStats.find(stat=>siteIdToFacilityIdMap[building.siteId]==stat.siteId);
        building.ecsByStatus = siteECStats?.statusCountsPerUnit?.[buildingIdToUnitMap[building.buildingId]]
    });

    return buildings;

}

export const getStructureModelElements = async (input, libraries, ctx) => {
  const { PlatformApi, IafScriptEngine } = libraries
  const { IafItemSvc } = PlatformApi

//   const { structureName } = input || {}
  const { structureName } = input?.params || {}
  if (!structureName) {
    return { status: 400, message: 'Missing structureName', _list: [] }
  }

  // 1) map_structures
  const structuresColl = (await getCollections(IafItemSvc, 'map_structures', ctx))[0]
  if (!structuresColl) {
    return { status: 500, message: 'map_structures_coll not found', _list: [] }
  }

//   const structuresRes = await IafScriptEngine.findWithRelated({
//     query: { name: structureName },
//     collectionDesc: {
//       _userItemId: structuresColl._userItemId,
//       _userType: structuresColl._userType,
//     },
//   }, ctx)

  const structuresRes = await IafScriptEngine.findWithRelated({
    parent: {
      query: { name: structureName },
      collectionDesc: {
        _userItemId: structuresColl._userItemId,
        _userType: structuresColl._userType,
      },
    },
  }, ctx)

  const structure = structuresRes?._list?.[0]
  if (!structure) {
    return { status: 404, message: `No structure found for name '${structureName}'`, _list: [] }
  }

  const { modelName } = structure
  if (!modelName) {
    return { status: 422, message: `Structure '${structureName}' has no modelName`, _list: [] }
  }

  // 2) rvt_type_elements (or whatever your userType is)
  const rvtTypesColl = (await getCollections(IafItemSvc, 'rvt_type_elements', ctx))[0]

  console.log("getStructureModelElements", rvtTypesColl);
  if (!rvtTypesColl) {
    return { status: 500, message: 'rvt_type_elements collection not found', _list: [] }
  }


const rvtTypesRes = await IafScriptEngine.findWithRelated({
  parent: {
    query: {}, // TEMP: no filter, just prove you can get items
    collectionDesc: {
      _userItemId: rvtTypesColl._userItemId,
      _userType: rvtTypesColl._userType,
    },
  },
  options: { limit: 5 },
}, ctx);

  return {
    status: 200,
    structure,
    modelName,
    _list: rvtTypesRes?._list || [],
  }
}


//BUILDING ENTITY
const createBuilding =  (input, libraries, ctx) => createEntityFactory("building")(input?.params || {}, libraries, ctx);
const updateBuilding =  (input, libraries, ctx) => updateEntityFactory("building")(input?.params || {}, libraries, ctx);
const deleteBuilding =  (input, libraries, ctx) => deleteEntityFactory("building")(input?.params || {}, libraries, ctx);
const attachBuildingToSite =  (input, libraries, ctx) => createAndAttachToEntityFactory("building","site")(input?.params || {}, libraries, ctx);
const createBuildingAndAttachToSite = (input, libraries, ctx) => createAndAttachToEntityFactory("building","site")(input?.params || {}, libraries, ctx);
const createBuildingAndAttachToOneSite = (input, libraries, ctx) => createAndAttachToOneParentFactory("building","site")(input?.params || {}, libraries, ctx);
const updateBuildingAndAttachToOneSite = (input, libraries, ctx) =>  updateAndAttachToOneParentFactory("building","site")(input?.params || {}, libraries, ctx);


//MODEL
export const getModelElementsWithRelated = (input, libraries, ctx) => getEntityWithRelatedFactoryModel("modelElement")(input?.params || {}, libraries, ctx);


function getRunnableScripts() {
    return [
        { name: "------GET", script: ""},
        { name: "3. Get Sites", script: "getSitesWithRelated" },
        { name: "3. Get Buildings", script: "getBuildingsWithRelated" },
        { name: "3. Get Model Elements", script: "getModelElementsWithRelated" }
    ]
}
