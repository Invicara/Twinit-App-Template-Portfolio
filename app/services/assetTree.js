import { IafProj, IafSession, IafItemSvc } from '@dtplatform/platform-api';
import { IafScriptEngine } from '@dtplatform/iaf-script-engine';
import { getModelTypeElements } from '../../setup/scripts/omapi_entities.mjs';

function splitStructureName(structureName) {
  return structureName.split(/[-_]/).filter((word) => word !== 'Facility' && word !== 'Unit');
}

// Get Facilities and Units levels
export async function getInitialTreeLevels() {
  const ctx = IafProj.getCurrent();

  const BaseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;
  const URL = `${BaseOmapiUrl}/site/all`;

  const treeData = [];

  try {
    const response = await fetch(URL, {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();

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
        };
        treeData.push(facilityNode);
      });
    } else {
      // eslint-disable-next-line no-console
      console.error('OMAPI facilities call failed', response.status);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Facility fetch error:', err);
  }

  return treeData;
}

const callRaw = async (params) => {
  const ctx = IafProj.getCurrent();

  const result = await getModelTypeElements(
    { params, headers: { origin: window.location.origin } },
    { PlatformApi: { IafItemSvc }, IafScriptEngine },
    ctx
  );

  if (result?.status !== 200) {
    // eslint-disable-next-line no-console
    console.error('getModelTypeElements failed', result?.message, result);
    return { status: result?.status ?? 500, _list: [] };
  }

  return result;
};

const callList = async (params) => {
  const result = await callRaw(params);
  return result?._list || [];
};

export async function getFamiliesLevel(structureName) {
  return callList({ structureName });
}

export async function getFamilyTypesLevel(structureName, family) {
  return callList({ structureName, family });
}

/**
 * Elements for a Type
 * Returns the full backend response so the UI can access:
 *   - status
 *   - mode
 *   - typeId
 *   - _list (elements)
 */
export async function getTypeElementsLevel(structureName, typeId) {
  return callRaw({ structureName, typeId });
}