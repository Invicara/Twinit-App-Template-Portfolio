async function getSiteEquipCollections({ facility, unit, libraries, ctx}) {
   const { IafItemSvc } = libraries.PlatformApi
   let equipCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequip` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })
   let revCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquipRevs", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequiprevs` }
         }, ctx, { page: {_pageSize: 1000, _offset: 0}
   })

   const siteEquipColl =  equipCollections._list.find(c => c._userType === "siteEquip")
   const siteEquipRevsColl =  revCollections._list.find(c => c._userType === "siteEquipRevs")

   return {siteEquipColl, siteEquipRevsColl}
}

async function getEcsCollections({ libraries, ctx }) {
   const { IafItemSvc } = libraries.PlatformApi
   let collections = await IafItemSvc.getNamedUserItems({
      query: { _userType: { $in: ["ecs", "ecs-logs"]} , _itemClass: 'NamedUserCollection' }
      }, ctx, { page: {_pageSize: 10, _offset: 0} 
   })

   const ecsColl =  collections._list.find(c => c._userType === "ecs")
   const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")

   return {ecsColl, ecsLogsColl}
}

function isIntermediateRevision(revision) {
  // Match a string that ends with a letter (case insensitive)
  return /[A-Za-z]$/.test(revision);
}

function incrementToRevision(intermediateRevision) {
	// Remove the letter from the end (extract the numeric part)
	let numericPart = intermediateRevision.replace(/[A-Za-z]$/, "");
	// Convert the numeric part to an integer
	let numericValue = parseInt(numericPart, 10);
	// Increment the number
	numericValue += 1;
	// Format the number back to the original length (with leading zeros)
	let newNumericPart = numericValue.toString().padStart(numericPart.length, '0');

	return newNumericPart;
}

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

async function getUnitSystemEquipments(input, libraries, ctx) {
   const { IafItemSvc } = libraries.PlatformApi
   const { IafScriptEngine } = libraries

   const facility = decodeURIComponent(input.facility)
   const unit = decodeURIComponent(input.unit)
   const systemId = decodeURIComponent(input.systemId)

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
         query: { systemId },
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

   async function createPendingRevision(input, libraries, ctx) {
		const { IafItemSvc } = libraries.PlatformApi
		const { IafScriptEngine } = libraries

		const { facility, unit, equipmentId, siteEquipmentId, properties, TechnicalParameters, username } = input.params

		if (!facility || !unit || !equipmentId || !siteEquipmentId || !properties || !TechnicalParameters || !username) {
			return {
				status: 400,
            statusMessage: "Bad Request",
				message: "Missing required parameter",
			}
		}

      // Check site equip is registered to any EC
      const {ecsLogsColl} = await getEcsCollections({libraries, ctx})
		const query = {
         site: facility,
         unit,
			'Site Equipment Id': siteEquipmentId,
		}
		const ecsLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, {query}, ctx))?._list

		if (!ecsLogs || !ecsLogs?.length) {
			return {
				status: 400,
            statusMessage: "Bad Request",
				message: `Engineering Change for ${siteEquipmentId} not found`
			}
		}

      const {siteEquipColl, siteEquipRevsColl} = await getSiteEquipCollections({facility, unit, libraries, ctx})

		let equipWithRevs = await IafScriptEngine.findWithRelated({
			parent: {
				query: {'Site Equipment Id': siteEquipmentId},
				collectionDesc: { _userItemId: siteEquipColl._userItemId, _userType: siteEquipColl._userType },
				options: {
					page: { _pageSize: 1000, _offset: 0 },
					sort: { "Site Equipment Id": 1 }
				}
			},
			related: [
				{
					relatedDesc: { _relatedUserType: siteEquipRevsColl._userType, _isInverse: true},
					as: "revisions"
				}
			]
		}, ctx)

		const equip = equipWithRevs?._list?.[0]

      // Valid ECs where base revision matches site equip's tipRevision
      // This means there is an EC which instructs site equip to increment by another revision
		const validEcs = ecsLogs.filter(ec => ec['Base Revision'] == equip?.tipRevision)
      if (!validEcs || !validEcs.length) {
         return {
				status: 400,
            statusMessage: "Bad Request",
				message: `No current Engineering Change instructs ${siteEquipmentId} revision to increment any further`
			}
      }

      // ECs where base revision matches SE's tip have been closed
      if (validEcs?.find(ec => ec.status == 'CLOSED')) {
         return {
				status: 400,
            statusMessage: "Bad Request",
				message: `No open Engineering Change exists for ${siteEquipmentId}`
			}
      }

		const tipRevision = equip?.revisions?._list?.find(r => r.revision == equip?.tipRevision)
		const tipRevisionNumber = tipRevision?.revision

		if (!tipRevisionNumber) {
			return {
				status: 400,
            statusMessage: "Bad Request",
				message: "Tip revision not found",
			}
		}

		const date = new Date()
		date.setUTCHours(0,0,0,0)

		// Compare with last major version if user updating a pending revision again with new edits
		let compareRevision = tipRevision
		if (isIntermediateRevision(tipRevisionNumber)) {
			// Revision contains 'A' suffix
			const lastMajorRevisionNumber = tipRevisionNumber.replace(/[A-Za-z]$/, "")
			compareRevision = equip?.revisions?._list?.find(r => r.revision == lastMajorRevisionNumber)
		}
		const edited = {}
		edited.properties = _.differenceBy(properties, compareRevision?.properties, 'val').map(p => p.name)
		edited.TechnicalParameters = _.differenceBy(TechnicalParameters, compareRevision?.TechnicalParameters, 'val').map(tp => tp.name)

		const newRevision = {
			'revision status date': date.toISOString(),
			'revision status': 'PENDING',
			'revision': tipRevisionNumber,
			equipmentId,
			properties,
			TechnicalParameters,
			edited
		}

		let result
		if (isIntermediateRevision(tipRevisionNumber)) {
			// Update existing pending revision
			result = await IafItemSvc.updateRelatedItem(siteEquipRevsColl._userItemId, tipRevision._id, {...tipRevision, ...newRevision}, ctx)
		} else {
			// Create new pending revision
			const incrementedRevision = tipRevisionNumber + 'A'
			const newRevisionWithRelation = {
				...newRevision,
				revision: incrementedRevision,
				_relationships: [
					{
						_relatedUserItemDbId: siteEquipColl._userItemId,
						_relatedToIds: [equip._id]
					}
				]
			}

			result = await IafItemSvc.createRelatedItems(siteEquipRevsColl._userItemId, [newRevisionWithRelation], ctx)
			// Update tipRevision on site equip
			await IafItemSvc.updateRelatedItem(siteEquipColl._userItemId, equip._id, {..._.omit(equip, ['revisions']), tipRevision: incrementedRevision}, ctx)
		}

      // When intermedate revision is created, there should be EC log for APPROVED status.
      const approvedEcLog = validEcs.find(ec => ec.status == 'APPROVED')
      let ecLog
      if (approvedEcLog) {
         // Update existing EC Log which has status APPROVED
         ecLog = await IafItemSvc.updateRelatedItem(ecsLogsColl._userItemId, approvedEcLog._id, {...approvedEcLog, dateReviewed: date.toISOString()}, ctx)
      } else {
         // Create a new EC log with status APPROVED
         // Use REGISTERED EC log as template
         const registeredEcLog = validEcs.find(ec => ec.status == 'REGISTERED')
         if (!registeredEcLog) {
            return {
               status: 400,
               statusMessage: "Bad Request",
               message: 'EC has not been registered'
            }
         } else {
            const newEcLog = {
               ..._.omit(registeredEcLog, ['_id', '_metadata']),
               dateReviewed: date.toISOString(),
               status: 'APPROVED',
               username
            }
            ecLog = await IafItemSvc.createRelatedItems(ecsLogsColl._userItemId, [newEcLog], ctx)
         }
      }

		return {
         status: 200,
         statusMessage: 'Success',
         revision: result,
         ecLog
      }
	}

	async function createApprovedRevision(input, libraries, ctx) {
		const { IafItemSvc } = libraries.PlatformApi
		const { IafScriptEngine } = libraries

		// Require ecid as site equip could be related to multiple ECs
		const { ecid, facility, unit, siteEquipmentId, username } = input.params

		if (!ecid || !facility || !unit || !siteEquipmentId || !username) {
			return {
				status: 400,
				statusMessage: "Bad Request",
				message: "Missing required parameter",
			}
		}

      const {siteEquipColl, siteEquipRevsColl} = await getSiteEquipCollections({facility, unit, libraries, ctx})

		let equipWithRevs = await IafScriptEngine.findWithRelated({
			parent: {
				query: {'Site Equipment Id': siteEquipmentId},
				collectionDesc: { _userItemId: siteEquipColl._userItemId, _userType: siteEquipColl._userType },
				options: {
					page: { _pageSize: 1000, _offset: 0 },
					sort: { "Site Equipment Id": 1 }
				}
			},
			related: [
				{
					relatedDesc: { _relatedUserType: siteEquipRevsColl._userType, _isInverse: true},
					as: "revisions"
				}
			]
		}, ctx)

		const equip = equipWithRevs?._list?.[0]
      const tipRevision = equip?.tipRevision
      const allRevisions = equip?.revisions?._list || []
		const revisionToBump = allRevisions?.find(e => e.revision == tipRevision)

		if (!revisionToBump) {
			return {
				status: 400,
				statusMessage: "Bad request",
				message: "Revision not found"
			}
		}

      const revisionToBumpNumber = revisionToBump.revision

      if (!revisionToBumpNumber) {
			return {
				status: 400,
				statusMessage: "Bad request",
				message: "Not an intermediate revision number"
			}
		}

		// Create new issued revision
		const date = new Date()
		date.setUTCHours(0,0,0,0)
		const incrementedRevision = incrementToRevision(revisionToBumpNumber)

      // Set previous ISSUED rev to REVISED and update the revision date
      const prevIssuedRevisions = allRevisions.filter(r => r['revision status'] == 'ISSUED') || []
      if (prevIssuedRevisions.length) {
         prevIssuedRevisions.forEach(r => {
            r['revision status'] = 'REVISED',
            r['revision status date'] = date.toISOString()
         })
         await IafItemSvc.updateRelatedItems(siteEquipRevsColl._userItemId, prevIssuedRevisions, ctx)
      }
      // Update temporary revision to major revision
      const updatedRevision = await IafItemSvc.updateRelatedItem(siteEquipRevsColl._userItemId, revisionToBump._id, {...revisionToBump, 'revision': incrementedRevision, 'revision status': 'ISSUED', 'revision status date': date.toISOString()}, ctx)
		// Update tipRevision on site equip
		await IafItemSvc.updateRelatedItem(siteEquipColl._userItemId, equip._id, {..._.omit(equip, ['revisions']), tipRevision: incrementedRevision}, ctx)
		
		// Create new EC audit log and set status to CLOSED
		const { ecsLogsColl } = await getEcsCollections({libraries, ctx})
		const ecsLogQuery = {
			ecid,
			site: facility,
			unit,
			'Site Equipment Id': siteEquipmentId
		}
		const ecLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, {query: ecsLogQuery}, ctx))?._list
		const lastEcLog = ecLogs?.find(l => l.status == 'CLOSED') || ecLogs?.find(l => l.status == 'APPROVED') || ecLogs?.find(l => l.status == 'REGISTERED')

		const newEcLog = {
			..._.omit(lastEcLog, ['_id', '_metadata']),
			"Equipment Revision": incrementedRevision,
			dateImplemented: date.toISOString(),
			status: 'CLOSED',
			username
		}

		const createdEcLog = await IafItemSvc.createRelatedItems(ecsLogsColl._userItemId, [newEcLog], ctx)

		return {
			status: 200,
			statusMessage: 'Success',
         updatedRevision,
			createdEcLog
		}
	}

	async function deletePendingRevision(input, libraries, ctx) {
		const { IafItemSvc } = libraries.PlatformApi
		const { IafScriptEngine } = libraries

      let facility = input?.facility ? decodeURIComponent(input.facility) : null
      let unit = input?.unit ? decodeURIComponent(input?.unit) : null
      let siteEquipmentId = input?.siteEquipmentId ? decodeURIComponent(input?.siteEquipmentId) : null
      let revision = input?.revision ? decodeURIComponent(input?.revision) : null

		if (!facility || !unit || !siteEquipmentId || !revision) {
			return {
				status: 400,
            statusMessage: 'Bad request',
				message: "Missing required parameter",
			}
		}

		if (!isIntermediateRevision(revision)) {
			return {
				status: 400,
            statusMessage: 'Bad request',
				message: "Not an intermediate revision number",
			}
		}

      const {siteEquipColl, siteEquipRevsColl} = await getSiteEquipCollections({facility, unit, libraries, ctx})

		let equipWithRevs = await IafScriptEngine.findWithRelated({
			parent: {
				query: {'Site Equipment Id': siteEquipmentId},
				collectionDesc: { _userItemId: siteEquipColl._userItemId, _userType: siteEquipColl._userType },
				options: {
					page: { _pageSize: 1000, _offset: 0 },
					sort: { "Site Equipment Id": 1 }
				}
			},
			related: [
				{
					relatedDesc: { _relatedUserType: siteEquipRevsColl._userType, _isInverse: true},
					as: "revisions",
					query: {
						revision
					}
				}
			]
		}, ctx)
		
		const equip = equipWithRevs?._list?.[0]
		const revisionToDelete = equip?.revisions?._list?.[0]

		if (!revisionToDelete) {
			return {
				status: 400,
				statusMessage: "Bad request",
				message: "Revision not found"
			}
		}

		const result = await IafItemSvc.deleteRelatedItem(siteEquipRevsColl._userItemId, revisionToDelete._id, ctx)
		// Update tipRevision on site equip
		const newTip = revision.replace(/[A-Za-z]$/, "")
		await IafItemSvc.updateRelatedItem(siteEquipColl._userItemId, equip._id, {..._.omit(equip, ['revisions']), tipRevision: newTip}, ctx)

      // Delete matching EC log entry with APPROVED EC status
      // Check site equip is registered to any EC
      const {ecsLogsColl} = await getEcsCollections({libraries, ctx})
		const query = {
         site: facility,
         unit,
			'Site Equipment Id': siteEquipmentId,
		}
		const ecsLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, {query}, ctx))?._list
      const approvedEcLog = ecsLogs.find(ec => ec['Equipment Revision'] == revision && ec.status == 'APPROVED')

      let deletedEcLog
      if (approvedEcLog) {
         deletedEcLog = await IafItemSvc.deleteRelatedItem(ecsLogsColl._userItemId, approvedEcLog._id, ctx)
      }

		return {
         status: 200,
         statusMessage: 'Success',
         result,
         deletedEcLog
      }
	}
