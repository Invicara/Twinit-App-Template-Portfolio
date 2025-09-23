
async function returnStatus() {
   return {
      status: 200,
      statusMessage: "Success",
      message: "Hitachi OMAPI available"
   }
}

async function getSiteFacilities(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi

   // TO DO page all instead of 1000 _pageSize
   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection' }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })

   let facilities = []

   if (collections._list.length) {
      collections._list.forEach(site => {
         if (!facilities.includes(site._versions[0]._userAttributes.facility)) {
            facilities.push(site._versions[0]._userAttributes.facility)
         }
      })
   }

   facilities.sort()

   return {
      status: 200,
      statusMessage: "Success",
      facilities
   }

}

async function getFacilityUnits(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi

   const facility = decodeURIComponent(input.facility)

   // TO DO page all instead of 1000 _pageSize
   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection' }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })

   let units = []

   if (collections._list.length) {
      collections._list.forEach(site => {

         if (site._versions[0]._userAttributes.facility === facility && !units.includes(site._versions[0]._userAttributes.unit)) {
            units.push(site._versions[0]._userAttributes.unit)
         }

      })
   }

   units.sort()

   return {
      status: 200,
      statusMessage: "Success",
      facility,
      units
   }

}

async function getUnitSystems(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const facility = decodeURIComponent(input.facility)
   const unit = decodeURIComponent(input.unit)

   // TO DO page all instead of 1000 _pageSize
   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequip` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })
   
   if (collections._total !== 1) {
      return {
         status: 400,
         statusMessage: "Bad Request",
         message: `facility ${facility} unit ${unit} does not have site equipment`
      }
   } else {
      let siteColl = collections._list[0]

      let systemIds = await IafScriptEngine.getDistinct({
         collectionDesc: { _userType: siteColl._userType, _userItemId: siteColl._userItemId },
         query: {},
         field: 'systemId',
         options: { getCollInfo: false }
      }, ctx )

      return {
         status: 200,
         statusMessage: "Success",
         facility,
         unit,
         systemIds
      }

   }

}

async function getUnitSystemEquipmentTypes(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const facility = decodeURIComponent(input.facility)
   const unit = decodeURIComponent(input.unit)
   const systemId = decodeURIComponent(input.systemId)

   // TO DO page all instead of 1000 _pageSize
   let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequip` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })
   
   if (collections._total !== 1) {
      return {
         status: 400,
         statusMessage: "Bad Request",
         message: `facility ${facility} unit ${unit} does not have site equipment`
      }
   } else {
      let siteColl = collections._list[0]

      let equipmentTypes = await IafScriptEngine.getDistinct({
         collectionDesc: { _userType: siteColl._userType, _userItemId: siteColl._userItemId },
         query: { systemId },
         field: 'equipmentType',
         options: { getCollInfo: false }
      }, ctx )

      return {
         status: 200,
         statusMessage: "Success",
         facility,
         unit,
         systemId,
         equipmentTypes
      }

   }

}

async function getUnitEquipment(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const facility = decodeURIComponent(input.facility)
   const unit = decodeURIComponent(input.unit)
   const systemId = decodeURIComponent(input.systemId)
   const equipmentType = decodeURIComponent(input.equipmentType)

   // TO DO page all instead of 1000 _pageSize
   let equipCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequip` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })
   let revCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquipRevs", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequiprevs` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })

   const equipColl =  equipCollections._list.find(c => c._userType === "siteEquip")
   const equipRevsColl =  revCollections._list.find(c => c._userType === "siteEquipRevs")

   if (!equipColl || !equipRevsColl) {
      return {
         status: 500,
         statusMessage: "Internal Server Error",
         message: "Error finding site equipment or revisions collections",
         data: { equipCollections, revCollections }
      }
   }

   let equipWithRevs = await IafScriptEngine.findWithRelated({
      parent: {
         query: { systemId, equipmentType },
         collectionDesc: { _userItemId: equipColl._userItemId, _userType: equipColl._userType },
         options: {
            page: { _pageSize: 100, _offset: 0 },
            sort: { "Equipment Id": 1 }
         }
      },
      related: [
         {
            relatedDesc: { _relatedUserType: equipRevsColl._userType, _isInverse: true},
            as: "revisions"
         }
      ]
   }, ctx)

   return {
         status: 200,
         statusMessage: "Success",
         facility,
         unit,
         systemId,
         equipmentType,
         equipment: equipWithRevs
   }

}


// OLD STUFF ======================================================================


async function searchEquipment(input, libraries, ctx) {

   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   let _pageSize = input.params._pageSize ? input.params._pageSize : 100
   let _offset = input.params._offset ? input.params._offset : 0

   const facility = input.params.facility
   const unit = input.params.unit

   if (!facility || !unit) {
      return {
         status: 400,
         statusMessage: "Bad Request",
         message: "faciity and unit are required"
      }
   }

   let query = {}

   if (input.params.systemId && input.params.systemId.length) {
      query.systemId = input.params.systemId
   }

   if (input.params.equipmentType && input.params.equipmentType.length) {
      query.equipmentType = input.params.equipmentType
   }

   if (input.params.equipmentId && input.params.equipmentId.length) {
      query['Equipment Id'] = input.params.equipmentId
   }

   let equipCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequip` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })
   let revCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquipRevs", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequiprevs` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })

   const equipColl =  equipCollections._list.find(c => c._userType === "siteEquip")
   const equipRevsColl =  revCollections._list.find(c => c._userType === "siteEquipRevs")

   if (!equipColl || !equipRevsColl) {
      return {
         status: 500,
         statusMessage: "Internal Server Error",
         message: "Error finding site equipment or revisions collections",
         data: { equipCollections, revCollections }
      }
   }

   let equipWithRevs = await IafScriptEngine.findWithRelated({
      parent: {
         query,
         collectionDesc: { _userItemId: equipColl._userItemId, _userType: equipColl._userType },
         options: {
            page: { _pageSize, _offset },
            sort: { "Equipment Id": 1 }
         }
      },
      related: [
         {
            relatedDesc: { _relatedUserType: equipRevsColl._userType, _isInverse: true},
            as: "revisions"
         }
      ]
   }, ctx)

   return {
      status: 200,
      statusMessage: "Success",
      facility,
      unit,
      query,
      equipment: equipWithRevs
   }

}