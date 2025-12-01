const INPUT = [
	{
		ecid: '003',
		facility: 'A',
		unit: '02',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-A-024',
		equipmentId: 'RCP-900-014',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '01',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-011',
		equipmentId: 'RCP-900-011',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '01',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-012',
		equipmentId: 'RCP-900-012',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '01',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-013',
		equipmentId: 'RCP-900-013',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '01',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-014',
		equipmentId: 'RCP-900-014',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '02',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-021',
		equipmentId: 'RCP-900-011',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '02',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-022',
		equipmentId: 'RCP-900-012',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '02',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-023',
		equipmentId: 'RCP-900-013',
	},
	{
		ecid: '004',
		facility: 'B',
		unit: '02',
		base: '001',
		revision: '002',
		siteEquipmentId: 'RCP-B-024',
		equipmentId: 'RCP-900-014',
	},
	{
		ecid: '005',
		facility: 'A',
		unit: '01',
		base: '000',
		revision: '001',
		siteEquipmentId: 'CND-A-01',
		equipmentId: 'CND-900-001',
	},
	{
		ecid: '005',
		facility: 'A',
		unit: '02',
		base: '000',
		revision: '001',
		siteEquipmentId: 'CND-A-02',
		equipmentId: 'CND-900-001',
	},
	{
		ecid: '005',
		facility: 'B',
		unit: '01',
		base: '000',
		revision: '001',
		siteEquipmentId: 'CND-B-01',
		equipmentId: 'CND-900-001',
	},
	{
		ecid: '005',
		facility: 'B',
		unit: '02',
		base: '000',
		revision: '001',
		siteEquipmentId: 'CND-B-02',
		equipmentId: 'CND-900-001',
	},
]

async function getSiteEquipCollections({ facility, unit, libraries, ctx }) {
	const { IafItemSvc } = libraries.PlatformApi
	let equipCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquip", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequip` }
	}, ctx, {
		page: { _pageSize: 1000, _offset: 0 }
	})
	let revCollections = await IafItemSvc.getNamedUserItems({
		query: { _userType: "siteEquipRevs", _itemClass: 'NamedUserCollection', _shortName: `${facility}${unit}-siteequiprevs` }
	}, ctx, {
		page: { _pageSize: 1000, _offset: 0 }
	})

	const siteEquipColl = equipCollections._list.find(c => c._userType === "siteEquip")
	const siteEquipRevsColl = revCollections._list.find(c => c._userType === "siteEquipRevs")

	return { siteEquipColl, siteEquipRevsColl }
}

async function getEcsCollections({ libraries, ctx }) {
	const { IafItemSvc } = libraries.PlatformApi
	let collections = await IafItemSvc.getNamedUserItems({
		query: { _userType: { $in: ["ecs", "ecs-logs"] }, _itemClass: 'NamedUserCollection' }
	}, ctx, {
		page: { _pageSize: 10, _offset: 0 }
	})

	const ecsColl = collections._list.find(c => c._userType === "ecs")
	const ecsLogsColl = collections._list.find(c => c._userType === "ecs-logs")

	return { ecsColl, ecsLogsColl }
}

let scriptModule = {
	async resetSiteEquipment(input, libraries, ctx, callback) {
		const { IafItemSvc } = libraries.PlatformApi
		const { IafScriptEngine } = libraries
		const siteEquip = input || INPUT

		for (const seRev of siteEquip) {
			const {ecid, facility, unit, base, revision, siteEquipmentId, equipmentId} = seRev

			const {siteEquipColl, siteEquipRevsColl} = await getSiteEquipCollections({facility,unit, libraries, ctx})
			const {ecsColl, ecsLogsColl} = await getEcsCollections({libraries, ctx})

			let seWithRevs = await IafScriptEngine.findWithRelated({
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

			seWithRevs = seWithRevs?._list?.[0]
			const revisions = seWithRevs?.revisions?._list
			console.log('revisions', revisions)

			// DO VALIDATION
			const currentRevision = revisions?.find(r => r.revision == revision)
			if (!currentRevision) {
				console.log('Final revision does not exist, EC not closed. Skipping...')
				continue
			}

			const baseRevision = revisions?.find(r => r.revision == base)

			if (!baseRevision) {
				console.log('Base revision does not exist, something is wrong. Skipping...')
				continue
			}

			const seEcLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, {query: {
				ecid,
				site: facility,
				unit,
				'Site Equipment Id': siteEquipmentId,
				'Base Revision': base
			}}, ctx))?._list


			// DO CHANGES
			// Set baseRevision to ISSUED
			const updatedBaseRev = await IafItemSvc.updateRelatedItem(siteEquipRevsColl._userItemId, baseRevision._id, {...baseRevision, 'revision status': 'ISSUED'}, ctx)
			console.log('Updated Base Revision', updatedBaseRev)
			
			// Delete current revision
			const deletedRev = await IafItemSvc.deleteRelatedItem(siteEquipRevsColl._userItemId, currentRevision._id, ctx)
			console.log('Deleted Revision', deletedRev)

			// 4. Revert tip version on SE
			const updatedSe = await IafItemSvc.updateRelatedItem(siteEquipColl._userItemId, seWithRevs._id, {..._.omit(seWithRevs, ['revisions']), tipRevision: base}, ctx)
			console.log('Updated Site Equipment', updatedSe)

			// Delete CLOSED and APPROVED EC Logs
			for (const ecLog of seEcLogs) {
				if (ecLog.status == 'CLOSED' || ecLog.status == 'APPROVED') {
					await await IafItemSvc.deleteRelatedItem(ecsLogsColl._userItemId, ecLog._id, ctx)
				}
			}
		}
	},
}

export default scriptModule