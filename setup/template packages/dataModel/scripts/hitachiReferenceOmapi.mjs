
async function returnStatus() {
   return {
      status: 200,
      statusMessage: "Success",
      message: "Hitachi OMAPI available"
   }
}

async function getReferenceUnitTypes(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "equipRefs", _itemClass: 'NamedUserCollection' }
         }, ctx, { page: {_pageSize: 10, _offset: 0}
   })

   let refEquipColl =  collections._total === 1 ? collections._list[0] : undefined

   if (!refEquipColl) {
      return {
         status: 500,
         statusMessage: "Internal Server Error",
         message: "Error finding reference equipment collection",
         data: collections
      }
   }

   let distinctUnitTypes = await IafScriptEngine.getDistinct({
		collectionDesc: { _userType: refEquipColl._userType, _userItemId: refEquipColl._userItemId },
		field: 'unitType',
		options: { getCollInfo: false }
	}, ctx )

   return {
         status: 200,
         statusMessage: "Success",
         unitTypes: distinctUnitTypes
   }

}

async function getReferenceSystemsByUnitType(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const unitType = decodeURIComponent(input.unitType)

   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "equipRefs", _itemClass: 'NamedUserCollection' }
         }, ctx, { page: {_pageSize: 10, _offset: 0}
   })

   let refEquipColl =  collections._total === 1 ? collections._list[0] : undefined

   if (!refEquipColl) {
      return {
         status: 500,
         statusMessage: "Internal Server Error",
         message: "Error finding reference equipment collection",
         data: collections
      }
   }

   let distinctSystems = await IafScriptEngine.getDistinct({
		collectionDesc: { _userType: refEquipColl._userType, _userItemId: refEquipColl._userItemId },
      query: { unitType },
		field: 'systemId',
		options: { getCollInfo: false }
	}, ctx )

   return {
         status: 200,
         statusMessage: "Success",
         unitType,
         systemIds: distinctSystems
   }

}

async function getReferenceEquipmentTypes(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const unitType = decodeURIComponent(input.unitType)
   const systemId = decodeURIComponent(input.systemId)

   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "equipRefs", _itemClass: 'NamedUserCollection' }
         }, ctx, { page: {_pageSize: 10, _offset: 0}
   })

   let refEquipColl =  collections._total === 1 ? collections._list[0] : undefined

   if (!refEquipColl) {
      return {
         status: 500,
         statusMessage: "Internal Server Error",
         message: "Error finding reference equipment collection",
         data: collections
      }
   }

   let distinctEquipTypes = await IafScriptEngine.getDistinct({
		collectionDesc: { _userType: refEquipColl._userType, _userItemId: refEquipColl._userItemId },
      query: { unitType, systemId},
		field: 'equipmentType',
		options: { getCollInfo: false }
	}, ctx )

   return {
         status: 200,
         statusMessage: "Success",
         unitType,
         systemId,
         equipmentTypes: distinctEquipTypes
   }

}

async function getReferenceEquipment(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const unitType = decodeURIComponent(input.unitType)
   const systemId = decodeURIComponent(input.systemId)
   const equipmentType = decodeURIComponent(input.equipmentType)

   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: { $in: ["equipRefs", "equipRefRevs"]} , _itemClass: 'NamedUserCollection' }
         }, ctx, { page: {_pageSize: 10, _offset: 0}  
   })

   const refEquipColl =  collections._list.find(c => c._userType === "equipRefs")
   const refEquipRevsColl =  collections._list.find(c => c._userType === "equipRefRevs")

   if (!refEquipColl || !refEquipRevsColl) {
      return {
         status: 500,
         statusMessage: "Internal Server Error",
         message: "Error finding reference equipment or revisions collections",
         data: collections
      }
   }

   let refWithRevs = await IafScriptEngine.findWithRelated({
      parent: {
         query: { unitType, systemId, equipmentType },
         collectionDesc: { _userItemId: refEquipColl._userItemId, _userType: refEquipColl._userType },
         options: {
            page: { _pageSize: 100, _offset: 0 },
            sort: { "Equipment Id": 1 }
         }
      },
      related: [
         {
            relatedDesc: { _relatedUserType: refEquipRevsColl._userType, _isInverse: true},
            as: "revisions"
         }
      ]
   }, ctx)

   return {
         status: 200,
         statusMessage: "Success",
         unitType,
         systemId,
         equipmentType,
         equipment: refWithRevs,
   }

}

async function searchEquipment(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   let query = {}
   if (input.params.unitType && input.params.unitType.length) {
      query.unitType = input.params.unitType
   }

   if (input.params.systemId && input.params.systemId.length) {
      query.systemId = input.params.systemId
   }

   if (input.params.equipmentType && input.params.equipmentType.length) {
      query.equipmentType = input.params.equipmentType
   }

   if (input.params.equipmentId && input.params.equipmentId.length) {
      query['Equipment Id'] = input.params.equipmentId
   }

   let _pageSize = input.params._pageSize ? input.params._pageSize : 100
   let _offset = input.params._offset ? input.params._offset : 0

   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: { $in: ["equipRefs", "equipRefRevs"]} , _itemClass: 'NamedUserCollection' }
         }, ctx, { page: {_pageSize: 10, _offset: 0}  
   })

   const refEquipColl =  collections._list.find(c => c._userType === "equipRefs")
   const refEquipRevsColl =  collections._list.find(c => c._userType === "equipRefRevs")

   let refWithRevs = await IafScriptEngine.findWithRelated({
      parent: {
         query: query,
         collectionDesc: { _userItemId: refEquipColl._userItemId, _userType: refEquipColl._userType },
         options: {
            page: { _pageSize, _offset },
            sort: { "Equipment Id": 1 }
         }
      },
      related: [
         {
            relatedDesc: { _relatedUserType: refEquipRevsColl._userType, _isInverse: true},
            as: "revisions"
         }
      ]
   }, ctx)

   refWithRevs._list.forEach (ref => {
      ref.revisions = ref.revisions._list.length ? ref.revisions._list : []
   })

    return {
         status: 200,
         statusMessage: "Success",
         query,
         equipment: refWithRevs
   }

}