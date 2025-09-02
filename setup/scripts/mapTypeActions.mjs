let scriptModule = {

    async getMapTypes(input, libraries, ctx, callback){
        const { PlatformApi: { IafItemSvc } } = libraries

        const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: "map_types"}}))._list[0];
        const types = (await IafItemSvc.getRelatedItems(coll._userItemId, {}))._list;
        
        return Object.assign({}, ...types.map(t => ({[t.title]: t})));
    },

    async updateMapType(input, libraries, ctx, callback){
        const { PlatformApi: { IafItemSvc } } = libraries

        const {updatedType} = input

        if(!updatedType){
            console.error("updateMapType script: missing updatedType input")
        }

        const coll = (await IafItemSvc.getNamedUserItems({query: {_shortName: "map_types"}}))._list[0];
        const result = await IafItemSvc.updateRelatedItems(coll._userItemId, [updatedType]);        

    }
}

export default scriptModule
