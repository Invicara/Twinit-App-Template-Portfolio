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

    const ecsColl =  collections._list.find(c => c._userType === "ecs")
    const ecsLogsColl =  collections._list.find(c => c._userType === "ecs-logs")

    const ecs = (await IafItemSvc.getRelatedItems(ecsColl._userItemId, {}, ctx, options))?._list

    const statusHierarchy = ['REGISTERED', 'APPROVED', 'CLOSED']

    for (const ec of ecs) {
        let relatedLogs = (await IafItemSvc.getRelatedItems(ecsLogsColl._userItemId, { query: {ecid: ec.id } }, ctx))?._list

        const siteEquipMap = {}
        for (const log of relatedLogs) {
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

        ec.logs = siteEquipMap
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