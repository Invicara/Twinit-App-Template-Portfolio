
// turn the graph query results of paths into a tree
const makeGraphResultTree = (root, paths, references) => {
	console.log(root, paths)

	paths.forEach((p) => {
		addChildToParent(root, p, references)
	})
	
	return root
}

// recursively build a tree from parent and child paths
const addChildToParent = (parent, childToAdd, references) => {
	
	if (!parent.children) parent.children = []

	let addThisChild, nextChild

	let existingParent = parent.children.find(c => c._id === childToAdd._id)
	if (!existingParent) {
		if (childToAdd.child) {
			nextChild = childToAdd.child
			let { child, ...rest } = childToAdd
			addThisChild = rest
		} else {
			addThisChild = childToAdd
		}

		let childReference = references[addThisChild._userItemId][addThisChild._userItemVersionId][addThisChild._id]
		addThisChild = {...addThisChild, ...childReference}
		parent.children.push(addThisChild)

		if (nextChild) {
			addChildToParent(addThisChild, nextChild, references)
		}
	} else if (childToAdd.child) {
		addChildToParent(existingParent, childToAdd.child, references)
	}

	return parent
}


async function returnStatus() {
   return {
      status: 200,
      statusMessage: "Success",
      message: "Hitachi OMAPI available"
   }
}

async function getEcs(input, libraries, ctx) {
    const { IafItemSvc } = libraries.PlatformApi

    let _pageSize = input?.params?.pageSize ? input.params.pageSize : 100
    let _offset = input?.params?.offset ? input.params.offset : 0
    let options = {page: { _pageSize, _offset }}

    let query = {}
    if (input?.ecid) {
        query = { id: input.ecid }
    }

    let collections = await IafItemSvc.getNamedUserItems({
        query: { _userType: { $in: ["ecs", "ecs-logs"]} , _itemClass: 'NamedUserCollection' }
        }, ctx, { page: {_pageSize: 10, _offset: 0} 
    })

    const ecsColl =  collections._list.find(c => c._userType === "ecs")
    const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")

    const ecs = (await IafItemSvc.getRelatedItems(ecsColl._userItemId, {query}, ctx, options))?._list

    const statusHierarchy = ['REGISTERED', 'APPROVED', 'CLOSED']

    for (const ec of ecs) {
        let relatedLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, { query: {ecid: ec.id } }, ctx, { page: { getAllItems: true }}))?._list

        let closedCount = relatedLogs.filter(log => log.status === "CLOSED").length
        let approvedCount = relatedLogs.filter(log => log.status === "APPROVED").length - closedCount
        let registeredCount = relatedLogs.filter(log => log.status === "REGISTERED").length - closedCount - approvedCount


        const siteEquipMap = {}
        let lastDateReviewed = ""
        for (const log of relatedLogs) {
            if (!lastDateReviewed && log.dateReviewed) {
                lastDateReviewed = log.dateReviewed
            } else if (log.dateReviewed && new Date(log.dateReviewed) > new Date(lastDateReviewed)) {
                lastDateReviewed = log.dateReviewed
            }

            if (!siteEquipMap[log['Site Equipment Id']]) {
                siteEquipMap[log['Site Equipment Id']] = log
                continue
            }

            const existing = siteEquipMap[log['Site Equipment Id']]
            const existingIndex = statusHierarchy.findIndex(s => s == existing?.status)
            const currentIndex = statusHierarchy.findIndex(s => s == log?.status)

            if (currentIndex > existingIndex) {
                siteEquipMap[log['Site Equipment Id']] = log
            }
        }

        ec.lastDateReviewed = lastDateReviewed
        ec.logs = siteEquipMap
        ec.status = {
            REGISTERED: registeredCount,
            APPROVED: approvedCount,
            CLOSED: closedCount
        }
    }

    return {
        status: 200,
        statusMessage: "Success",
        ecs
    }
}

async function getEcLogs(input, libraries, ctx) {
    if (!input?.ecid) {
        return {
            status: 401,
            statusMessage: "Error invalid ID"
        }
    }

    const { IafItemSvc } = libraries.PlatformApi

    let _pageSize = input?.params?.pageSize ? input.params.pageSize : 100
    let _offset = input?.params?.offset ? input.params.offset : 0
    let options = {page: { _pageSize, _offset }}

    let collections = await IafItemSvc.getNamedUserItems({
        query: { _userType: { $in: ["ecs-logs"]} , _itemClass: 'NamedUserCollection' }
        }, ctx, { page: {_pageSize: 10, _offset: 0}  
    })

    const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")
    const ecLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, { query: {ecid: input.ecid } }, ctx, options))?._list

    return {
        status: 200,
        statusMessage: "Success",
        ecLogs
    }
}

async function getEcEquipment(input, libraries, ctx) {

    const { IafItemSvc } = libraries.PlatformApi

    let facility = input.params?.facility ? decodeURIComponent(input.params.facility) : null
    let unit = input.params?.unit ? decodeURIComponent(input.params?.unit) : null
    let compare = input.params?.compare

    const siteFilter = facility ? `${facility}${unit ? unit : ''}` : null
    console.log({siteFilter})

    let collections = await IafItemSvc.getNamedUserItems({
        query: { _userType: { $in: ['ecs', 'siteEquip', 'siteEquipRevs', 'equipRefRevs']}, _itemClass: 'NamedUserCollection' }
        }, ctx, { page: {_pageSize: 100, _offset: 0}
    })

    const ecsColl = collections._list.find(c => c._userType === "ecs")
    const equipRefRevsColl = collections._list.find(c => c._userType === "equipRefRevs")

    let siteEquipCollections = collections._list.filter(c => {
        if (siteFilter) {
            return c._shortName.startsWith(siteFilter) && c._userType === 'siteEquip'
        } else {
            return c._userType === 'siteEquip'
        }
    }).map(c => c._userItemId)
    console.log({siteEquipCollections})

    let siteEquipRevCollections = collections._list.filter(c => {
        if (siteFilter) {
            return c._shortName.startsWith(siteFilter) && c._userType === 'siteEquipRevs'
        } else {
            return c._userType === 'siteEquipRevs'
        }
    }).map(c => c._userItemId)
    console.log({siteEquipCollections})

    if (!ecsColl) {
        return {
            status: 500,
            statusMessage: "Internal Server Error",
            message: "Engineering Changes collection not found"
        }
    }

    let siteEquipGraphQuery = {
        start: { // begin the graph query
            collectionDesc: { // in the ECs NamedUserCollection
                _userItemId: ecsColl._userItemId
            },
            query: { // and find the item with the provided ec id
                id: input.ecid
            }
        },
        to: { // from the item found in the ECs NamedUserCollection (in the start)
            segments: [
                { // follow relations to the site equipment
                    relatedDesc: {
                        _isInverse: false,
                        _relatedUserItemId: { $in: siteEquipCollections }
                    },
                    as: 'siteEquipment',
                    options: {
                        project: {
                            _id: 1,
                            "unitType": 1,
                            "systemId": 1,
                            "Equipment Id": 1,
                            "Equipment Name": 1,
                            "Site Equipment Id": 1,
                            "tipRevision": 1,
                            "equipmentType": 1
                        }
                    }
                },
                {
                    // then to the site equipment revisions
                    relatedDesc: {
                        _isInverse: true,
                        _relatedUserItemId: { $in: siteEquipRevCollections }
                    },
                    from: 'siteEquipment',
                    as: 'siteEquipmentRevs',
                    options: {
                        project: {
                            _id: 1,
                            "revision status date": 1,
                            "revision status": 1,
                            "equipmentId": 1,
                            "properties": 1,
                            "revision": 1,
                            "TechnicalParameters": 1
                        }
                    }
                }
            ],
            as: 'paths',
            response: 'path'
        }
    }

    // run the graph query using $findWithRelatedGraph
	let siteQueryResult = await IafItemSvc.searchRelatedItems({$findWithRelatedGraph: siteEquipGraphQuery}, ctx)
    let siteFromStart = siteQueryResult._list[0]._versions[0]._relatedItems._list[0]
    let { paths, ...treeRoot } = siteFromStart
    let siteTree = makeGraphResultTree(treeRoot, paths._list, siteQueryResult._referencedItems)

    let refEquipGraphQuery = {
        start: { // begin the graph query
            collectionDesc: { // in the ECs NamedUserCollection
                _userItemId: ecsColl._userItemId
            },
            query: { // and find the item with the provided ec id
                id: input.ecid
            }
        },
        to: { // from the item found in the ECs NamedUserCollection (in the start)
            segments: [
                { // follow relations to the reference equip revisions
                    relatedDesc: {
                        _relatedUserType: 'equipRefRevs'
                    },
                    as: 'refEquipRevs',
                    options: {
                        project: {
                            _id: 1,
                            "revision status date": 1,
                            "revision status": 1,
                            "equipmentId": 1,
                            "properties": 1,
                            "revision": 1,
                            "TechnicalParameters": 1
                        }
                    }
                },
                {
                    // and then to the ref equipment itself
                    relatedDesc: {
                        _relatedUserType: 'equipRefs'
                    },
                    from: 'refEquipRevs',
                    as: 'refEquipment',
                    options: {
                        project: {
                            _id: 1,
                            "unitType": 1,
                            "systemId": 1,
                            "Equipment Id": 1,
                            "Equipment Name": 1,
                            "Site Equipment Id": 1,
                            "tipRevision": 1,
                            "equipmentType": 1
                        }
                    }
                }
            ],
            as: 'paths',
            response: 'path'
        }
    }
    console.log({refEquipGraphQuery})

    // run the graph query using $findWithRelatedGraph
	let refQueryResult = await IafItemSvc.searchRelatedItems({$findWithRelatedGraph: refEquipGraphQuery}, ctx)
    console.log(JSON.stringify(refQueryResult))
    let refFromStart = refQueryResult._list[0]._versions[0]._relatedItems._list[0]
    let { paths: refPaths, ...treeRefRoot } = refFromStart
    let refTree = makeGraphResultTree(treeRefRoot, refPaths._list, refQueryResult._referencedItems)

    let { children, ...ec } = siteTree
    ec.siteEquipment = children
    ec.referenceRevisions = refTree.children

    function removeTags(item) {
        delete item._userItemId
        delete item._userItemVersionId
        delete item._version
        delete item.children
    }

    ec.siteEquipment.forEach(se => {
        let revs = se.children
        revs = revs.filter(r => r.revision === se.tipRevision)

        removeTags(se)
        revs.forEach(rev => removeTags(rev))
        
        se.revisions = revs
    })

    ec.referenceRevisions.forEach(re => {
        let refs = re.children
        removeTags(re)
        refs.forEach(ref => removeTags(ref))
        re.referenceEquipment = refs[0]
    })

    if (compare) {
        ec.siteEquipment.forEach(se => {
            se.comparison = {
                properties: se.revisions[0].properties,
                TechnicalParameters: se.revisions[0].TechnicalParameters
            }

            let refRevision = ec.referenceRevisions.find(({ equipmentId }) => equipmentId === se['Equipment Id'])

            se.comparison.properties.forEach(prop => {
                let refProp = refRevision.properties.find(({ name }) => name === prop.name)
                prop.ecValue = refProp ? refProp.val : 'ref prop not found'
            })

            se.comparison.TechnicalParameters.forEach(tp => {
                let refProp = refRevision.TechnicalParameters.find(({ name }) => name === tp.name)
                tp.ecValue = refProp ? refProp.val : 'ref prop not found'
            })

        })

        
    }

    return {
        status: 200,
        statusMessage: "Success",
        ec,
        includesComparson: compare
    }
}