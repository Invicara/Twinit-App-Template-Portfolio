import { IafProj, IafSession, IafItemSvc } from '@dtplatform/platform-api';
import { IafScriptEngine } from '@dtplatform/iaf-script-engine';
import { CombinatorTranslationEnum } from '@jsonforms/core';

//TODO REMOVE
import { getSitesWithRelated, getModelTypeElementsWithRelated, getStructureModelElements } from '../../setup/scripts/omapi_entities.mjs';

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

      const resultTest = await getSitesWithRelated(null, { PlatformApi: { IafItemSvc }, IafScriptEngine }, ctx);

    console.log('getInitialTreeLevels result', resultTest);

      resultTest.map((res) => {
        // Map through result._result
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

export async function getSystemLevel(structureName) {
  const parentLevels = splitStructureName(structureName)

  const ctx = IafProj.getCurrent()
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const systemLevelUrl = `${baseOmapiUrl}/siteequip/facilities/${parentLevels[0]}/units/${parentLevels[1]}/systems`

  let system = []

  try {
    const response = await fetch(systemLevelUrl, {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const result = await response.json()
      console.log('getSystemLevel result', result);
      if (result._result.status === 200) {
        system = result._result.systemIds
      } else {
        console.error('OMAPI facilities call returned status', result._result.status)
      }
    } else {
      console.error('OMAPI facilities call failed', response.status)
    }
  } catch (err) {
    console.error('Facility fetch error:', err)
  }

  return system
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

export async function getEquipTypeLevel(nodeId, structureName) {
  const levels = nodeId.split("/");
  const ctx = IafProj.getCurrent()
  const parentLevels = splitStructureName(structureName)

  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const equipTypeLevelUrl = `${baseOmapiUrl}/siteequip/facilities/${parentLevels[0]}/units/${parentLevels[1]}/systems/${levels[2]}/equipmenttypes`

  let equipType = []

  try {
    const response = await fetch(equipTypeLevelUrl, {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const result = await response.json()
      if (result._result.status === 200) {
        equipType = result._result.equipmentTypes
      } else {
        console.error('OMAPI facilities call returned status', result._result.status)
      }
    } else {
      console.error('OMAPI facilities call failed', response.status)
    }
  } catch (err) {
    console.error('Facility fetch error:', err)
  }

  return equipType
}

export async function getEquipLevel(nodeId, structureName) {
  const levels = nodeId.split("/");
  const parentLevels = splitStructureName(structureName)

  const ctx = IafProj.getCurrent()
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const equipLevelUrl = `${baseOmapiUrl}/siteequip/facilities/${parentLevels[0]}/units/${parentLevels[1]}/systems/${levels[2]}/equipmenttypes/${levels[3]}/equipment`

  let equipment = []

  try {
    const response = await fetch(equipLevelUrl, {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const result = await response.json()
      if (result._result.status === 200) {
        equipment = result._result.equipment._list
      } else {
        console.error('OMAPI facilities call returned status', result._result.status)
      }
    } else {
      console.error('OMAPI facilities call failed', response.status)
    }
  } catch (err) {
    console.error('Facility fetch error:', err)
  }

  let finalEquipList = []

    equipment.map(item => {
        // Get the latest revision (assuming _list is ordered or only one)
        const latestRevision = item.revisions._list[item.revisions._list.length - 1]

        // Combine properties and technical parameters
        const combinedProperties = [
        ...(latestRevision.properties || []),
        ...(latestRevision.TechnicalParameters || [])
        ];

        finalEquipList.push({
            nameId: item["Site Equipment Id"],
            EquipmentName: item['Equipment Name'],
            Properties: combinedProperties
        })
    });

   console.log('getEquipLevel finalEquipList', finalEquipList)

  return finalEquipList
}
