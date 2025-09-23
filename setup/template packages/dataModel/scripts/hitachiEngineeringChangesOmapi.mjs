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

    let collections = await IafItemSvc.getNamedUserItems({
            query: { _userType: { $in: ["ecs", "ecs-logs"]} , _itemClass: 'NamedUserCollection' }
            }, ctx, { page: {_pageSize: 10, _offset: 0}  
    })

    const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")
    const ecsColl =  collections._list.find(c => c._userType === "ecs")

    let ecsLogs = await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, {}, ctx, options)
    ecsLogs = ecsLogs?._list || []
    const ecsCache = {}

    for (const log of ecsLogs) {
        let ec
        if (ecsCache[log.ecid]) {
            ec = ecsCache[log.ecid]
        } else {
            const res = await IafItemSvc.getRelatedItems(ecsColl._userItemId, {query : {id: log.ecid}}, ctx)
            ec = res?._list?.[0]
            ecsCache[log.ecid] = ec
        }
        log.ec = ec
    }
        return {
        status: 200,
        statusMessage: "Success",
        ecs: ecsLogs
    }
}

async function getEcStatuses(input, libraries, ctx) {
    const { IafItemSvc } = libraries.PlatformApi
    const { IafScriptEngine } = libraries

    let collections = await IafItemSvc.getNamedUserItems({
        query: { _userType: "ecs-logs", _itemClass: 'NamedUserCollection' }
            }, ctx, { page: {_pageSize: 10, _offset: 0}
    })

    let ecsLogsColl =  collections._total === 1 ? collections._list[0] : undefined

    if (!ecsLogsColl) {
        return {
            status: 500,
            statusMessage: "Internal Server Error",
            message: "Error finding EC Logs collection",
            data: collections
        }
    }

    let distinctStatuses = await IafScriptEngine.getDistinct({
        collectionDesc: { _userType: ecsLogsColl._userType, _userItemId: ecsLogsColl._userItemId },
        field: 'status',
        options: { getCollInfo: false }
    }, ctx )

    return {
            status: 200,
            statusMessage: "Success",
            statuses: distinctStatuses
    }
}

async function searchEcs(input, libraries, ctx) {
    const { IafItemSvc } = libraries.PlatformApi

    let ecsQuery = {}
    let ecsLogsQuery = {}

    if (input?.params?.title && input.params.title.length) {
        ecsQuery.title = { $regex: input.params.title, $options: 'i' }
    }

    if (input?.params?.status && input.params.status.length) {
        ecsLogsQuery.status = input.params.status
    }

    let collections = await IafItemSvc.getNamedUserItems({
        query: { _userType: { $in: ["ecs", "ecs-logs"]} , _itemClass: 'NamedUserCollection' }
            }, ctx, { page: {_pageSize: 10, _offset: 0}  
    })

    const ecsColl =  collections._list.find(c => c._userType === "ecs")
    const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")

    const ecs = (await IafItemSvc.getRelatedItems(ecsColl._userItemId, {query: ecsQuery}, ctx, { page: {_pageSize: 1000, _offset: 0}}))?._list
    const ecsLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, {query: ecsLogsQuery}, ctx, { page: {_pageSize: 1000, _offset: 0}}))?._list
    
    const ecIds = ecs.map(ec => ec.id)
    const result = ecsLogs.filter(ecLog => ecIds.includes(ecLog.ecid))

    for (const ecLog of result) {
        const ec = ecs.find(e => e.id == ecLog.ecid)
        ecLog.ec = ec
    }

    return {
        status: 200,
        statusMessage: "Success",
        ecs: result
    }
}