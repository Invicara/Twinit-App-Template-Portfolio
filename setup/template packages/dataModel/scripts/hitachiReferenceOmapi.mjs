
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
         unittypes: distinctUnitTypes
   }

}

async function getReferenceSystemsByUnitType(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const unittype = decodeURIComponent(input.unittype)

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
      query: { unitType: unittype},
		field: 'systemId',
		options: { getCollInfo: false }
	}, ctx )

   return {
         status: 200,
         statusMessage: "Success",
         unittype: unittype,
         systems: distinctSystems
   }

}

async function getReferenceEquipmentTypes(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const unittype = decodeURIComponent(input.unittype)
   const system = decodeURIComponent(input.system)

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
      query: { unitType: unittype, systemId: system},
		field: 'equipmentType',
		options: { getCollInfo: false }
	}, ctx )

   return {
         status: 200,
         statusMessage: "Success",
         unittype: unittype,
         system: system,
         equipmentypes: distinctEquipTypes
   }

}

async function getReferenceEquipment(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const unittype = decodeURIComponent(input.unittype)
   const system = decodeURIComponent(input.system)
   const equiptype = decodeURIComponent(input.equiptype)

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
         query: { unitType: unittype, systemId: system, "Equipment Type": equiptype},
         collectionDesc: { _userItemId: refEquipColl._userItemId, _userType: refEquipColl._userType },
         options: {
            page: { _pageSize: 100, _offset: 0 },
            sort: { "Equipment Id": 1 }
         }
      },
      related: [
         {
            relatedDesc: { _relatedUserType: refEquipRevsColl._userType},
            as: "revisions"
         }
      ]
   })

   refWithRevs._list.forEach (ref => {
      ref.revisions = ref.revisions._list.length ? ref.revisions._list : []
   })

   return {
         status: 200,
         statusMessage: "Success",
         unittype: unittype,
         system: system,
         equipmentypes: equiptype,
         equipment: refWithRevs
   }

}