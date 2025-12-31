import { IafProj, IafSession } from '@dtplatform/platform-api';


function splitStructureName(structureName) {
    return structureName.split(/[-_]/).filter(word => word !== 'Facility' && word !== 'Unit')
}

// Get Facilities and Units levels
export async function getInitialTreeLevels() {
  const ctx = IafProj.getCurrent()

  const BaseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const URL = `${BaseOmapiUrl}/site/all`

  let treeData = []

  try {
    const response = await fetch(URL, {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const result = await response.json()

      result?._result?.map((res) => {
          const facilityNode = {
            id: res.name,
            name: res.name,
            level: 1,
            children: res.buildings.map((building) => ({
              id: `${res.name}/${building.name}`,
              name: building.name,
              level: 2,
              structureName: building.structureName,
              children: [{}],
            })),
          }
          treeData.push(facilityNode)
      })
     

    } else {
      console.error('OMAPI facilities call failed', response.status)
    }
  } catch (err) {
    console.error('Facility fetch error:', err)
  }

  return treeData
}

export async function getElementsLevel(structureName) {
  const ctx = IafProj.getCurrent()
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const elementsLevelUrl = `${baseOmapiUrl}/model/typeElements`

  let system = []

    const url = `${baseOmapiUrl}/model/typeElements/${encodeURIComponent(structureName)}`

    try {
      const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json',
      },
    })

    const json = await res.json()
    const result = json?._result

    if (res.ok && result?.status === 200) {
      return result._list || []
    }

    console.error('OMAPI typeElements call failed', { httpStatus: res.status, jsonStatus: json?.status, json })
  } catch (err) {
    console.error('getElementsLevel fetch error:', err)
  }

  return []
}
