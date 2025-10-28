import { IafProj, IafSession, IafItemSvc } from '@dtplatform/platform-api';

// Get Facilities and Units levels
export async function getInitialTreeLevels() {
  const ctx = IafProj.getCurrent()
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const facilitiesUrl = `${baseOmapiUrl}/siteequip/facilities`

  let facilities = []

  try {
    const response = await fetch(facilitiesUrl, {
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
        facilities = result._result.facilities
      } else {
        console.error('OMAPI facilities call returned status', result._result.status)
      }
    } else {
      console.error('OMAPI facilities call failed', response.status)
    }
  } catch (err) {
    console.error('Facility fetch error:', err)
  }

  const tree = []

  // Fetch units for each facility
  await Promise.all(
    facilities.map(async (facility) => {
      const unitUrl = `${baseOmapiUrl}/siteequip/facilities/${facility}/units`

      let units = []
      try {
        const response = await fetch(unitUrl, {
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
            units = result._result.units
          } else {
            console.error(`OMAPI units for ${facility} returned status`, result._result.status)
          }
        } else {
          console.error(`OMAPI units for ${facility} call failed`)
        }
      } catch (err) {
        console.error(`Error fetching units for ${facility}:`, err)
      }

      // Build the structure for this facility
      const facilityNode = {
        id: facility,
        name: facility,
        level: 1,
        children: units.map((unit) => ({
          id: `${facility}/${unit}`,
          name: unit,
          level: 2,
          children: [],
        })),
      }

      tree.push(facilityNode)
    })
  )
  return tree
}

export async function getSystemLevel(nodeId) {
  const levels = nodeId.split("/");
  const ctx = IafProj.getCurrent()
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const systemLevelUrl = `${baseOmapiUrl}/siteequip/facilities/${levels[0]}/units/${levels[1]}/systems`

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

export async function getEquipTypeLevel(nodeId) {
  const levels = nodeId.split("/");
  const ctx = IafProj.getCurrent()
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const equipTypeLevelUrl = `${baseOmapiUrl}/siteequip/facilities/${levels[0]}/units/${levels[1]}/systems/${levels[2]}/equipmenttypes`

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

export async function getEquipLevel(nodeId) {
  const levels = nodeId.split("/");
  const ctx = IafProj.getCurrent()
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
  const equipLevelUrl = `${baseOmapiUrl}/siteequip/facilities/${levels[0]}/units/${levels[1]}/systems/${levels[2]}/equipmenttypes/${levels[3]}/equipment`

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
