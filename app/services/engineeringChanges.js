

import React, { useRef, useContext, useState, useEffect } from 'react'

import { IafProj, IafSession, IafItemSvc } from '@dtplatform/platform-api';
import { IafScriptEngine } from "@dtplatform/iaf-script-engine";

export async function engineeringChangesService({ buildingId, facilityId }) {
  const ctx = IafProj.getCurrent();

  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  let getUrls = [
    `${baseOmapiUrl}/engineeringchanges`,
    `${baseOmapiUrl}/engineeringchanges/001/logs?pageSize=20`,
  ];

  let postUrls = [];

  let testResults = [];

  try {
    for (const testUrl of getUrls) {
      let response = await fetch(testUrl, {
        method: "GET",
        mode: "cors",
        headers: {
          Authorization: "Bearer " + IafSession.getAuthToken(ctx),
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        let result = await response.json();
        if (result._result.status === 200) {
          testResults.push({ testUrl, result });
        } else {
          testResults.push({
            testUrl,
            message: `ERROR: OMAPI ${testUrl} call returned status other than 200`,
          });
        }
      } else {
        testResults.push({
          testUrl,
          message: `ERROR: OMAPI ${testUrl} call failed`,
        });
      }
    }

    for (const testUrl of postUrls) {
      let response = await fetch(testUrl.url, {
        method: "POST",
        mode: "cors",
        headers: {
          Authorization: "Bearer " + IafSession.getAuthToken(ctx),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testUrl.body),
      });

      if (response.ok) {
        let result = await response.json();
        if (result._result.status === 200) {
          testResults.push({ testUrl, result });
        } else {
          testResults.push({
            testUrl,
            message: `ERROR: OMAPI ${testUrl} call returned status other than 200`,
          });
        }
      } else {
        testResults.push({
          testUrl,
          message: `ERROR: OMAPI ${testUrl} call failed`,
        });
      }
    }
  } catch (error) {
    testResults.push({ message: `ERROR: OMAPI failed` });
  }

  const ecs = testResults?.[0]?.result?._result?.ecs;

  const formattedECs = transformECs(ecs, buildingId, facilityId);


  return formattedECs;
}

function transformECs(ecsObj, buildingId, facilityId) {
  if (!buildingId) buildingId = 0;
  const ecs = Object.values(ecsObj);

  return ecs.map((ec) => {
    const updated = { ...ec };

    if (updated.title) {
      updated['EC Title'] = updated.title;
      delete updated.title;
    }
    if (updated.type) {
      updated['EC Type'] = updated.type;
      delete updated.type;
    }

    let logs = Array.isArray(updated.logs)
      ? updated.logs
      : updated.logs
      ? Object.values(updated.logs)
      : [];

    logs = logs.filter((log) => log.unit == buildingId && log.site == facilityId);

    updated.status = { REGISTERED: 0, APPROVED: 0, CLOSED: 0 };

    logs.forEach((log) => {
      if (log.status && updated.status.hasOwnProperty(log.status)) {
        updated.status[log.status] += 1;
      }
    });

    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];

      if (lastLog.dateReviewed) {
        const rawDate = lastLog.dateReviewed.replace(':T', 'T'); 
        const dateObj = new Date(rawDate);
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const year = dateObj.getUTCFullYear();
        updated['Date Reviewed'] = `${day}/${month}/${year}`;
      } else {
        updated['Date Reviewed'] = '';
      }

      updated['EC ID'] = lastLog.ecid ?? '';

      if (lastLog['Base Revision']) updated['Base Revision'] = lastLog['Base Revision'];
      if (lastLog['Equipment Revision']) updated['Equipment Revision'] = lastLog['Equipment Revision'];
    }

    updated.logs = logs;

    delete updated.ecid;
    delete updated.dateReviewed;

    return updated;
  });
}

export async function engineeringChangesWithSiteEquipmentAPIS (ECID) {
   const ctx = IafProj.getCurrent();
   const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
   let getUrl = `${baseOmapiUrl}/engineeringchanges/${ECID}/equipment`

   let res = []

      try {
         let response = await fetch(getUrl, {
               method: 'GET',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
                  'Content-Type': 'application/json'
               }
            })

         if (response.ok) {
            let result = await response.json()
            if (result._result.status === 200) {
               res.push(result._result.ec)
            } else {
               res.push({testUrl, message: `ERROR: OMAPI ${testUrl} call returned status other than 200`})
            }
         } else {
            res.push({testUrl, message: `ERROR: OMAPI ${testUrl} call failed`})
         }

      } catch(err) {
         console.log(err)
      }

   const transformedRes = extractSiteEquipRevs(res)
   return transformedRes
}

// This will return the latest revsions of any effected Site Equipment from a selected EC
function extractSiteEquipRevs(res) {
  const extractedData = [];

  // Step 1: Get latest revision and add top-level fields
  res[0].siteEquipment.forEach((equip) => {
    if (equip.revisions && equip.revisions.length > 0) {
      const latestRevision = { ...equip.revisions[0] };

      // Add top-level fields to the revision object
      latestRevision.siteEquipmentId = equip["Site Equipment Id"] || null;
      latestRevision.equipmentType = equip.equipmentType || null;

      extractedData.push(latestRevision);
    }
  });

  // Step 2: Transform properties + TechnicalParameters into keyed objects
  const transformedData = extractedData.map((rev) => {
    // Transform `properties`
    const propsObj =
      rev.properties?.reduce((acc, prop) => {
        acc[prop.name] = {
          val: prop.val,
          type: prop.type,
        };
        return acc;
      }, {}) || {};

    // Transform `TechnicalParameters`
    const techParamsObj =
      rev.TechnicalParameters?.reduce((acc, param) => {
        acc[param.name] = {
          val: param.val,
          type: param.type,
          unit: param.unit,
        };
        return acc;
      }, {}) || {};

    return {
      ...rev,
      properties: propsObj,
      TechnicalParameters: techParamsObj,
    };
  });
  return transformedData;
}

export async function treeLevels(facility, unit) {
  const ctx = IafProj.getCurrent();
  const token = IafSession.getAuthToken(ctx);
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // Get all system IDs
    const firstUrl = `${baseOmapiUrl}/siteequip/facilities/${facility}/units/${unit}/systems`;
    const firstRes = await fetch(firstUrl, { headers, mode: "cors" });

    if (!firstRes.ok) throw new Error(`First-level fetch failed: ${firstRes.status}`);
    const firstJson = await firstRes.json();
    const systemIds = firstJson?._result?.systemIds || [];

    let finalData = systemIds.map(systemId => ({
      id: systemId,
      name: systemId,
      children: [],
    }));

    // Fetch all equipment types
    const secondLevelResponses = await Promise.all(
      systemIds.map(systemId => {
        const secondUrl = `${baseOmapiUrl}/siteequip/facilities/${facility}/units/${unit}/systems/${systemId}/equipmenttypes`;
        return fetch(secondUrl, { headers, mode: "cors" }).then(res => res.json());
      })
    );

    // Attach equipment types to finalData
    for (const result of secondLevelResponses) {
      const { systemId, equipmentTypes } = result._result || {};
      const systemNode = finalData.find(sys => sys.id === systemId);
      if (systemNode && Array.isArray(equipmentTypes)) {
        systemNode.children = equipmentTypes.map(eqType => ({
          id: `${systemId}/${eqType}`,
          name: eqType,
          children: [],
        }));
      }
    }

    // Fetch all equipment for each equipment type
    const equipmentFetches = [];
    for (const system of finalData) {
      for (const type of system.children) {
        const typeIdOnly = type.name;
        const thirdUrl = `${baseOmapiUrl}/siteequip/facilities/${facility}/units/${unit}/systems/${system.id}/equipmenttypes/${typeIdOnly}/equipment`;
        equipmentFetches.push(
          fetch(thirdUrl, { headers, mode: "cors" })
            .then(res => res.json())
            .then(json => ({
              systemId: system.id,
              typeId: typeIdOnly,
              data: json?._result?.equipment?._list || [],
            }))
        );
      }
    }

    const equipmentResults = await Promise.all(equipmentFetches);

    // Attach equipment with unique IDs
    for (const { systemId, typeId, data } of equipmentResults) {
      const systemNode = finalData.find(sys => sys.id === systemId);
      const typeNode = systemNode?.children.find(child => child.name === typeId);
      if (typeNode) {
        typeNode.children = data.map(eq => ({
          id: `${systemId}/${typeId}/${eq["Equipment Id"]}`,
          name: eq["Site Equipment Id"],
          siteEquipId: eq["Equipment Id"]
        }));
      }
    }

    console.log("Final tree with unique IDs:", finalData);
    return finalData;
  } catch (err) {
    console.error("Error fetching data:", err);
    throw err;
  }
}
