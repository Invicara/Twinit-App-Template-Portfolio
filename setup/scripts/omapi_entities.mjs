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

const getEntityWithRelatedFactory = (entityName) => async (input, libraries, ctx, callback) => {
    let { PlatformApi, IafScriptEngine } = libraries
    const { IafItemSvc } = PlatformApi

    const parent = (await getCollections(IafItemSvc, entityCollections[entityName].entity._userType, ctx))[0]
    const {query = {}, relatedPaths, inverslyRelatedPaths, relatedFilter } = input || {}

    //RELATED
    const relatedInput = relatedPaths?.reduce((accum,r)=>{
        accum[r] = entityCollections[entityName].related[r]
        return accum;
    },{});
    const inverslyRelatedInput = inverslyRelatedPaths?.reduce((accum,r)=>{
        accum[r] = entityCollections[entityName].inverslyRelated[r];
        return accum;
    },{});

    //console.log("getEntityWithRelatedFactory relatedInput",entityName,relatedInput)
    //console.log("getEntityWithRelatedFactory inverslyRelatedInput",entityName,inverslyRelatedInput)

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
        findWithRelated.related = Object.entries(related).map(([key,r])=>(
            {
                relatedDesc: {_relatedUserType: r._userType},
                query: query[key] || {},
                as: key,
            })).concat(Object.entries(inverslyRelated).map(([key,r])=>({
            relatedDesc: {_relatedUserType: r._userType, _isInverse: true},
            query: query[key] || {},
            as: key,
        })))
    }

    if(relatedFilter){

        //RELATED FILTER
        const {filterQuery = {}, relatedFilterPaths, inverslyRelatedFilterPaths, operand = "$and" } = relatedFilter || {}

        const relatedFilterInput = relatedFilterPaths?.reduce((accum,r)=>{
            accum[r] = entityCollections[entityName].related[r]
            return accum
        },{});
        const inverslyRelatedFilterInput = inverslyRelatedFilterPaths?.reduce((accum,r)=>{
            accum[r] = entityCollections[entityName].inverslyRelated[r]
            return accum
        },{});

        const relatedFilterRelated = relatedFilterInput || [];
        const relatedFilterInverslyRelated = inverslyRelatedFilterInput || [];

        findWithRelated["relatedFilter"] = {
            "includeResult": true,
            [operand]: Object.entries(relatedFilterRelated).map(([key,r])=>(
                {
                    relatedDesc: {_relatedUserType: r._userType},
                    query: filterQuery[key] || {},
                    as: key,
                })).concat(Object.entries(relatedFilterInverslyRelated).map(([key,r])=>(
                {
                    relatedDesc: {_relatedUserType: r._userType, _isInverse: true},
                    query: filterQuery[key] || {},
                    as: key,
                }))
            )
        }
    }


    //console.log("getEntityWithRelatedFactory findWithRelated",findWithRelated)

    let parentWithChildList = await IafScriptEngine.findWithRelated(findWithRelated, ctx);

    //console.log("getEntityWithRelatedFactory parentWithChildList",parentWithChildList)

    const entities = parentWithChildList._list || [];

    entities.forEach(e=>{

        e._metadata._userItemId = parent._userItemId;

        Object.keys(entityCollections[entityName].related).forEach(pagedProperty=>{
            e[pagedProperty] = e[pagedProperty] && e[pagedProperty]._list;

        })
        Object.keys(entityCollections[entityName].inverslyRelated).forEach(pagedProperty=>{
            e[pagedProperty] = e[pagedProperty] && e[pagedProperty]._list && e[pagedProperty]._list.length>0 ? e[pagedProperty]._list[0] : undefined;
        })
    });

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

//SITE ENTITY
const createSite = createEntityFactory("site");
const updateSite = updateEntityFactory("site");
const deleteSite = deleteEntityFactory("site");
const getSitesWithRelated = withDecimalFix(getEntityWithRelatedFactory("site"));

//BUILDING ENTITY
const createBuilding = createEntityFactory("building");
const updateBuilding = updateEntityFactory("building");
const deleteBuilding = deleteEntityFactory("building");
const getBuildingsWithRelated = withDecimalFix(getEntityWithRelatedFactory("building"));
const attachBuildingToSite = createAndAttachToEntityFactory("building","site");
const createBuildingAndAttachToSite = createAndAttachToEntityFactory("building","site");

//MODEL
const getModelElementsWithRelated = getEntityWithRelatedFactory("modelElement");


function getRunnableScripts() {
    return [
        { name: "------GET", script: ""},
        { name: "3. Get Sites", script: "getSitesWithRelated" },
        { name: "3. Get Buildings", script: "getBuildingsWithRelated" },
        { name: "3. Get Model Elements", script: "getModelElementsWithRelated" }
    ]
}
