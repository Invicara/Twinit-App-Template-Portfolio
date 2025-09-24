export async function setup(input, libraries, ctx, callback) {

   const { manifest, packageData, project } = input
   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   let newCollections, referenceEquipment, referenceEquipmentRevisions, engChanges
   let siteEquipMap = {}

   // example of using manifest data to access and read json data from the template package
   if (manifest.custom.collections) {
      let collectionsString = await packageData.file(manifest.custom.collections).async("string")
      let collections = JSON.parse(collectionsString)

      let existingCollections = await IafItemSvc.getNamedUserItems({
         query: { _itemClass: 'NamedUserCollection' }
      }, ctx, { page: {_pageSize: 200, _offset: 0}})

      //example of using PlatformAPI to configure the project via this script
      if (collections && collections.length) {
         for (let coll of collections) {
            coll._namespaces = project._namespaces

            // remove collections if they exist
            const currentCollection = existingCollections._list.find(ec => ec._name === coll._name)
            if (currentCollection) {
               await IafItemSvc.deleteNamedUserItem(currentCollection._id, ctx)
               callback(`INFO: Deleted collection: ${currentCollection._name}`)
            }

         }

         // recreate collections
         try {
            newCollections = await IafItemSvc.createNamedUserItems(collections, 'NamedUserCollection', ctx)
            console.log(newCollections)
            callback(`INFO: These collections created: ${newCollections._list.map(c => c._name).join(', ')}`)
         } catch(error) {
            callback("ERROR: error creating collections in setup script, check console log for details")
            console.error("ERROR: error creating collections in setup script")
            console.error(error)
         }

         // populate items in collections
         try {

            // populate reference equipment
            const refEquipColl = newCollections._list.find(c => c._name === "Reference Equipment")
            if (!refEquipColl) {
                callback(`ERROR: Could not find Reference Equipment collection`)
            } else {
               let referenceEquipmentString = await packageData.file(manifest.custom.referenceEquipment).async("string")
               let referenceEquipmentItemDefs = JSON.parse(referenceEquipmentString)

               referenceEquipment =  await IafScriptEngine.createItems({
                  _userItemId: refEquipColl._userItemId,
                  _namespaces: project._namespaces,
                  items: referenceEquipmentItemDefs
               }, ctx)

               callback(`INFO: Created Reference Equipment Items`)
               console.log('referenceEquipment', referenceEquipment)
            }

            // populate reference equipment revisions
            const refEquipRevsColl = newCollections._list.find(c => c._name === "Reference Equipment Revisions")
            if (!refEquipRevsColl) {
                callback(`ERROR: Could not find Reference Equipment Revisions collection`)
            } else {
               let revisionsString = await packageData.file(manifest.custom.referenceEquipmentRevisions).async("string")
               let revisions = JSON.parse(revisionsString)

               console.log('revisions', revisions)

               let revsToCreate = []
               revisions.forEach(rev => {
                  rev.equipmentIds.forEach(equipid => {
                     let refEquipId = referenceEquipment.find(re => re["Equipment Id"] === equipid)._id

                     revsToCreate.push({
                        ...rev.revision,
                        equipmentId: equipid,
                        _relationships: [
                           {
                              _relatedUserItemDbId: refEquipColl._userItemId,
                              _relatedToIds: [refEquipId]
                           }
                        ]
                     })
                  })
               })

               console.log('revsToCreate', revsToCreate)
               referenceEquipmentRevisions = await IafItemSvc.createRelatedItems(refEquipRevsColl._userItemId, revsToCreate, ctx)

               callback(`INFO: Created Reference Equipment Revision Items`)
               console.log('referenceEquipmentRevisions', referenceEquipmentRevisions)

               // populate site equipment and site equipment revisions
               for (const site of manifest.custom.sites) {

                  let siteEquipColl = newCollections._list.find(c => c._shortName === `${site._shortName}-siteequip`)
                  let siteEquipRevsColl = newCollections._list.find(c => c._shortName === `${site._shortName}-siteequiprevs`)

                  if (!siteEquipColl || !siteEquipRevsColl) {
                     callback(`ERROR: Could not find Site Equipment ${site._shortName} collections`)
                  } else {
                     let siteEquipmentString = await packageData.file(site.siteEquipment).async("string")
                     let siteEquipmentItemDefs = JSON.parse(siteEquipmentString)

                     let newSiteEquip =  await IafScriptEngine.createItems({
                        _userItemId: siteEquipColl._userItemId,
                        _namespaces: project._namespaces,
                        items: siteEquipmentItemDefs
                     }, ctx)

                     siteEquipMap[`${site._shortName}-siteequip`] = newSiteEquip

                     callback(`INFO: Created Site ${site._shortName} Equipment Items`)
                     console.log('newSiteEquip', newSiteEquip)
                     console.log('siteEquipMap', siteEquipMap)

                     let siteEquipmentRevsString = await packageData.file(site.siteEquipmentRevisions).async("string")
                     let siteEquipmentRevItemDefs = JSON.parse(siteEquipmentRevsString)

                     let newSiteEquipRevs = []
                     siteEquipmentRevItemDefs.forEach(rev => {
                        rev.equipmentIds.forEach(equipid => {
                           let refEquipId = newSiteEquip.find(re => re["Equipment Id"] === equipid)._id

                           newSiteEquipRevs.push({
                              ...rev.revision,
                              equipmentId: equipid,
                              _relationships: [
                                 {
                                    _relatedUserItemDbId: siteEquipColl._userItemId,
                                    _relatedToIds: [refEquipId]
                                 }
                              ]
                           })
                        })
                     })

                     console.log('newSiteEquipRevs', newSiteEquipRevs)
                     let siteEquipmentRevisions = await IafItemSvc.createRelatedItems(siteEquipRevsColl._userItemId, newSiteEquipRevs, ctx)

                     callback(`INFO: Created Site ${site._shortName} Equipment Revision Items`)
                     console.log('siteEquipmentRevisions', siteEquipmentRevisions)

                  }

               }
            }

            // populate Engineering Changes
            const ecColl = newCollections._list.find(c => c._name === "Engineering Changes")
            if (!ecColl) {
                callback(`ERROR: Could not find Engineering Changes collection`)
            } else {
               let ecString = await packageData.file(manifest.custom.engineeringChanges).async("string")
               let ecItemDefs = JSON.parse(ecString)

               let cleanedEcs = ecItemDefs.map(ecid => {
                  let { referenceEquipment, affectedEquipment, ...ecDef } = ecid
                  return ecDef
               })

               console.log('ecs to create', cleanedEcs)

               engChanges =  await IafScriptEngine.createItems({
                  _userItemId: ecColl._userItemId,
                  _namespaces: project._namespaces,
                  items: cleanedEcs
               }, ctx)

               callback(`INFO: Created Engineering Change Items`)
               console.log('engChanges', engChanges)

               // relate ecs to reference equipment revisions and site equipment
               let ecToRefRevRelations = []
               let ecToSiteEquipRelations = []

               engChanges.forEach(ecItem => {
                  console.log('ecItem', ecItem)
                  let ecDef = ecItemDefs.find(ecid => ecid.id === ecItem.id)

                  // relations to reference revisions
                  let relatedRefRevIds = ecDef.referenceEquipment.map(re => {
                     let refRev = referenceEquipmentRevisions._list.find(rer => rer.equipmentId === re.id && rer.revision === re.rev)
                     return { _id: refRev._id }
                  })

                  ecToRefRevRelations.push({
                     parentItem: { _id: ecItem._id},
				         relatedItems: relatedRefRevIds,
                  })

                  // relations for site equipment
                  ecDef.affectedEquipment.forEach(ae => {
                     let relObj = { 
                        childSiteEquipColl: newCollections._list.find(c => c._shortName === ae.collectionShortName)._userItemId
                     }

                     let childSiteEquipment = ae.ids.map(childId => {
                        console.log('childId', childId)
                        console.log(siteEquipMap[ae.collectionShortName])
                        let siteEquip = siteEquipMap[ae.collectionShortName].find(se => se["Equipment Id"] === childId)
                        return { _id: siteEquip._id}
                     })

                     relObj.relations = [
                        {
                           parentItem: { _id: ecItem._id},
                           relatedItems: childSiteEquipment
                        }
                     ]

                     ecToSiteEquipRelations.push(relObj)
                  })
                  
               })

               console.log('ecToRefRevRelations', ecToRefRevRelations)
               console.log('ecToSiteEquipRelations', ecToSiteEquipRelations)

               let ecToRefRevCreateResult = await IafScriptEngine.createRelations({
                     parentUserItemId: ecColl._userItemId,
                     _userItemId: refEquipRevsColl._userItemId,
                     _namespaces: project._namespaces,
                     relations: ecToRefRevRelations
               }, ctx)

               callback(`INFO: Created Engineering Change to Reference Revision Relations`)
               console.log('ecToRefRevCreateResult', ecToRefRevCreateResult)

               for (const siteRelationDef of ecToSiteEquipRelations) {
                  let siteRelDefRes = await IafScriptEngine.createRelations({
                     parentUserItemId: ecColl._userItemId,
                     _userItemId: siteRelationDef.childSiteEquipColl,
                     _namespaces: project._namespaces,
                     relations: siteRelationDef.relations
                  }, ctx)

                  console.log(`result of ec to site relations`, siteRelDefRes)
               }

               callback(`INFO: Created Engineering Change to Site Equipment Relations`)

               // populate EC Audit Logs
               let logsString = await packageData.file(manifest.custom.engineeringChangesAuditLogs).async("string")
               let logs = JSON.parse(logsString)

               let bulkLogCreateRes = await IafScriptEngine.createItemsBulk({
                  _userItemId: newCollections._list.find(c => c._shortName === 'ecs-logs')._userItemId,
                  items: logs
               }, ctx)

               console.log('bulkLogCreateRes', bulkLogCreateRes)

               callback(`INFO: Created Engineering Change Audit Logs`)
            }


         } catch(error) {
            callback("ERROR: error creating data set items in collections in setup script, check console log for details")
            console.error("ERROR: error creating data set items in collections in setup script")
            console.error(error)
         }

      }
   }

}