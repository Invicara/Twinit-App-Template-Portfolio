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

const callRaw = async ({ structureName, family, typeId, typesBulk } = {}) => {
  const ctx = IafProj.getCurrent();
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const url = new URL(`${baseOmapiUrl}/model/typeElements/${encodeURIComponent(structureName)}`);
  if (family) url.searchParams.set('family', family);
  if (typeId != null) url.searchParams.set('typeId', String(typeId));

  // NEW: bulk types (families + types + typeDoc) in one request
  if (typesBulk) url.searchParams.set('typesBulk', '1');

  const res = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    headers: {
      Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  const result = json?._result;

  if (!res.ok) {
    console.error('OMAPI typeElements call failed', { httpStatus: res.status, json });
    return { status: res.status, _list: [] };
  }

  return result || { status: res.status, _list: [] };
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

export async function getTypeElementsLevel(structureName, typeId) {
  return callRaw({ structureName, typeId }); // returning full object so you can read mode/typeId if needed
}

// NEW: used when expanding a building node to avoid loading families/types per family click
export async function getTypesBulk(structureName) {
  return callList({ structureName, typesBulk: true });
}

// Existing heavy bulk (types + elements). Keep as-is for site/building select logic if you rely on it.
export async function getStructureBulk(structureName) {
  const ctx = IafProj.getCurrent();
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const url = new URL(`${baseOmapiUrl}/model/typeElements/${encodeURIComponent(structureName)}`);
  url.searchParams.set('bulk', '1');

  const res = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    headers: {
      Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  const result = json?._result;

  if (!res.ok) {
    console.error('Bulk call failed', { httpStatus: res.status, json });
    return [];
  }

  return result?._list || [];
}
