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
        Object.keys(entityCollections[entityName].related).forEach(pagedProperty=>{
            e[pagedProperty] = e[pagedProperty] && e[pagedProperty]._list;

        })
        Object.keys(entityCollections[entityName].inverslyRelated).forEach(pagedProperty=>{
            e[pagedProperty] = e[pagedProperty] && e[pagedProperty]._list && e[pagedProperty]._list.length>0 ? e[pagedProperty]._list[0] : undefined;
        })
    });

    return entities

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

//SITE ENTITY
const recreateSitesCollection = createOrRecreateCollectionFactory("site");
const createSite = createEntityFactory("site");

//BUILDING ENTITY
const recreateBuildingsCollection = createOrRecreateCollectionFactory("building");
const createBuilding = createEntityFactory("building");
const createBuildingAndAttachToSite = createAndAttachToEntityFactory("building","site");

/*
function getRunnableScripts() {
	return [
		{ name: "------SETUP", script: ""},
		{ name: "Create Sites Collections", script: "recreateSitesCollection" },
		{ name: "Create Buildings Collections", script: "recreateBuildingsCollection" },
		{ name: "Create All Collections Using Input", script: "runAllSetupSteps" }
	]
}*/



let scriptModule = {
    async runAllSetupSteps(input, libraries, originalCtx) {

        const {UiUtils,PlatformApi} = libraries;

        let {actualParams} = input || {};

        if(!actualParams){
            let jsonFile = await UiUtils.IafLocalFile.selectFiles({ multiple: true, accept: ".json" })
            let values = await UiUtils.IafLocalFile.loadFiles(jsonFile)
            values = JSON.parse(values[0])
            actualParams = values;
        }

        const siteEntities = actualParams.siteEntities;
        const buildingEntities = actualParams.buildingEntities;
        const buildingsToSiteMap = actualParams.buildingsToSiteMap;

        const projects = await PlatformApi.IafProj.getProjects({ _namespaces: originalCtx._namespaces }, originalCtx);
        const project = projects[0];

        //console.log(`${input.orchRunId} input`, input || {});
        //console.log(`${input.orchRunId} project`, project || {});

        const ctx = {
            ...originalCtx,
            project,
            storage:{
                project
            }
        }

        await recreateSitesCollection(null, libraries, ctx);
        await recreateBuildingsCollection(null, libraries, ctx);

        const createdMap = {}
        if(Array.isArray(siteEntities)){
            for(const site of siteEntities){
                const persisted = await createSite(site, libraries, ctx);
                createdMap[persisted.name] = persisted;
            }
        }

        if(Array.isArray(buildingEntities)){
            for(const building of buildingEntities){
                const siteName = building.siteId;
                if(siteName && createdMap[siteName]){
                    const persisted = await createBuildingAndAttachToSite({parent: createdMap[siteName], entity: building}, libraries, ctx);
                } else {
                    await createBuilding(building, libraries, ctx);
                }
            }
        }

    }
}
export default scriptModule
