import { IafProj, IafSession, IafItemSvc } from '@dtplatform/platform-api';
import { IafScriptEngine } from '@dtplatform/iaf-script-engine';
import { getModelTypeElements } from '../../setup/scripts/omapi_entities.mjs';

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

// export async function getElementsLevel(structureName) {
//   const ctx = IafProj.getCurrent()
//   const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
//   const elementsLevelUrl = `${baseOmapiUrl}/model/typeElements`

//   //const modelTypeElements = getModelTypeElements();

//   const resultTest = await getModelTypeElements(
//     { params: { structureName } },
//     { PlatformApi: { IafItemSvc }, IafScriptEngine },
//     ctx
//   );

//   console.log('resultTest', resultTest);


//   let system = []

//     const url = `${baseOmapiUrl}/model/typeElements/${encodeURIComponent(structureName)}`

//     try {
//     //   const res = await fetch(url, {
//     //   method: 'GET',
//     //   mode: 'cors',
//     //   headers: {
//     //     Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
//     //     'Content-Type': 'application/json',
//     //   },
//     // })

//     const json = resultTest;
//     console.log('json', json);
//     const result = json?._result

//     // if (res.ok && result?.status === 200) {
//     //   return result._list || []
//     // }

//     return json?._list || []
//     //return result._list || []

//     console.error('OMAPI typeElements call failed', { httpStatus: res.status, jsonStatus: json?.status, json })
//   } catch (err) {
//     console.error('getElementsLevel fetch error:', err)
//   }

//   return []
// }

// export async function getElementsLevel(structureName) {
//   const ctx = IafProj.getCurrent()

//   // returns families when family is not provided
//   const result = await getModelTypeElements(
//     { params: { structureName }, headers: { origin: window.location.origin } },
//     { PlatformApi: { IafItemSvc }, IafScriptEngine },
//     ctx
//   )

//   if (result?.status !== 200) {
//     console.error('getModelTypeElements failed', result?.message, result)
//     return []
//   }

//   // IMPORTANT: return the tree nodes already shaped (family nodes with children placeholder)
//   return result?._list || []
// }

// export async function getFamilyTypesLevel(structureName, family) {
//   const ctx = IafProj.getCurrent()

//   const result = await getModelTypeElements(
//     { params: { structureName, family }, headers: { origin: window.location.origin } },
//     { PlatformApi: { IafItemSvc }, IafScriptEngine },
//     ctx
//   )

//   if (result?.status !== 200) {
//     console.error('getModelTypeElements (types) failed', result?.message, result)
//     return []
//   }

//   return result?._list || []
// }

const call = async (params) => {
  const ctx = IafProj.getCurrent()

  const result = await getModelTypeElements(
    { params, headers: { origin: window.location.origin } },
    { PlatformApi: { IafItemSvc }, IafScriptEngine },
    ctx
  )

  if (result?.status !== 200) {
    console.error('getModelTypeElements failed', result?.message, result)
    return []
  }

  return result?._list || []
}

export async function getFamiliesLevel(structureName) {
  return call({ structureName })
}

export async function getFamilyTypesLevel(structureName, family) {
  return call({ structureName, family })
}

export async function getTypeElementsLevel(structureName, typeId) {
  return call({ structureName, typeId })
}