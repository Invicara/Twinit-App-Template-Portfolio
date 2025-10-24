
async function setupCollEntities(input, libraries, ctx, cb){
    const { PlatformApi: { IafItemSvc }, IafScriptEngine, UiUtils } = libraries

    const {collKey} = input || {}

    if(!collKey){
        throw new Error("No collKey passed for new collection entities")
    }

    const jsonFile = await UiUtils.IafLocalFile.selectFiles({ multiple: true, accept: ".json" })
    const entities = (await UiUtils.IafLocalFile.loadJSONFiles(jsonFile))[0]

    const coll = await IafScriptEngine.createOrRecreateCollection({
        _name: collKey,
        _description: collKey,
        _shortName: collKey,			
        _userType: collKey,
        _namespaces: ctx._namespaces			
    }, ctx);

    const results = await IafItemSvc.createRelatedItems(coll._userItemId, entities, ctx);

    return {coll, results}
}

async function uploadFielAndCreateItem(input, libraries, ctx, callback){
	const { IafScriptEngine, PlatformApi: {IafFile, IafProj} } = libraries

	const {containerName, file} = input;

	const proj = await IafProj.getCurrent(ctx);

	let container = (await IafFile.getContainers(proj, {}, ctx ))[0];

	// IafScriptEngine.uploadFile
	let newFile = await IafScriptEngine.uploadFile(file, ctx)

	const fileItem = await IafFile.createFileItemFromFile(container, newFile, ctx);
	return {newFile, fileItem}
}

const scriptModule = {

    async setupMapTypes(input, libraries, ctx, cb){
        return await setupCollEntities({collKey: "map_types"}, libraries, ctx, cb);
    },

    async setupGraphicRefs(input, libraries, ctx, cb){
        return await setupCollEntities({collKey: "map_graphic_references"}, libraries, ctx, cb);
    },

	async setupStructures(input, libraries, ctx, cb){
        return await setupCollEntities({collKey: "map_structures"}, libraries, ctx, cb);
    },

    async setupGraphicContainers(input, libraries, ctx, cb){
		const { PlatformApi: { IafItemSvc, IafFile } } = libraries

        const colls = (await IafItemSvc.getNamedUserItems({query: {_kind: "collection"}}, ctx))._list;

		const thumbnailContainerKey = "graphic_thumbnails"
		const mapGraphicsContainerKey = "map_graphics"

		const root = colls.find(c => c._name === "Root Container");

		return await Promise.all([thumbnailContainerKey, mapGraphicsContainerKey].map(k => IafFile.createContainer(root, {
			_name: k,
			_shortName: k,
			_description: k,
			_userType: k,
		}, ctx)))
    },

    async fillGraphicRefItems(input, libraries, ctx, callback) {

		const { IafScriptEngine, PlatformApi: {IafItemSvc}, UiUtils } = libraries

		const itemName = "VVER"; //graphic reference name to enrich

		const graphicRefsColl = (await IafItemSvc.getNamedUserItems({query: {_kind: "collection", _shortName: "map_graphic_references"}}, ctx))._list?.[0];
		const graphicReferenceItem = (await IafItemSvc.getRelatedItems(graphicRefsColl._userItemId, {query: {name: itemName}}, ctx))._list?.[0];

		const glbFile = (await UiUtils.IafLocalFile.selectFiles({ multiple: false, accept: ".glb" }))[0]
		const mapGraphicsContainerKey = "map_graphics"

		const {fileItem: graphicFile} = await uploadFielAndCreateItem({
			containerName: mapGraphicsContainerKey, 
			file: glbFile
		}, libraries, ctx, callback);

		const pngFile = (await UiUtils.IafLocalFile.selectFiles({ multiple: false, accept: ".png" }))[0]
		const thumbnailContainerKey = "graphic_thumbnails"

		const {fileItem: thumbnailFile} = await uploadFielAndCreateItem({
			containerName: thumbnailContainerKey, 
			file: pngFile
		}, libraries, ctx, callback);

		const updatedItem = {...graphicReferenceItem};
		updatedItem.graphic = graphicFile._fileId;
		updatedItem.thumbnail = thumbnailFile._fileId;

		return await IafItemSvc.updateRelatedItem(graphicRefsColl._userItemId, graphicReferenceItem._id, updatedItem, ctx);
	}

}


export default scriptModule;