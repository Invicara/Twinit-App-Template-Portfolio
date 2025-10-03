

import React, { useRef, useContext, useState, useEffect } from 'react'

import { IafProj, IafSession, IafItemSvc } from '@dtplatform/platform-api';
import { IafScriptEngine } from "@dtplatform/iaf-script-engine";
   // used to access viewer commands, not used in this example
export async function engineeringChangesAPIs ()  {
     const loadscripts= await IafScriptEngine.getVar("loadedScripts");
     console.log('alex scripts', loadscripts);
    const ctx = IafProj.getCurrent();
  //  console.log('platformcontext', ctx);
    const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`
   //const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/`
      let getUrls = [
         `${baseOmapiUrl}/engineeringchanges`,
         `${baseOmapiUrl}/engineeringchanges/001/logs?pageSize=5`
      ]

      let postUrls = []

      let testResults = []

      try {

         for ( const testUrl of getUrls) {

            let response = await fetch(testUrl, {
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
                  console.log(testUrl)
                  console.log(result)
                  testResults.push({testUrl, result})
               } else {
                  testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl} call returned status other than 200`})
                  console.log(result)
               }
            } else {
               testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl} call failed`})
               console.log(response)
            }

         }

         for ( const testUrl of postUrls) {

            let response = await fetch(testUrl.url, {
               method: 'POST',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(testUrl.body)
            })

            if (response.ok) {
               let result = await response.json()
               if (result._result.status === 200) {
                  console.log(testUrl)
                  console.log(result)
                  testResults.push({testUrl, result})
               } else {
                  testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl} call returned status other than 200`})
                   console.log(result)
               }
            } else {
               testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl} call failed`})
               console.log(response)
            }

         }

      } catch (error) {
         testResults.push({message: `ERROR: OMAPI failed`})
         console.log('omapi error', error, ctx)
      }

      const ecs = testResults?.[0]?.result?._result?.ecs;
      const formattedECs = transformECs(ecs);
      return formattedECs;

   }

function transformECs(ecsObj) {
  const ecs = Object.values(ecsObj);

  return ecs.map(ec => {
    const updated = { ...ec };

    // Rename title and type
    if (updated.title) {
      updated['EC Title'] = updated.title;
      delete updated.title;
    }
    if (updated.type) {
      updated['EC Type'] = updated.type;
      delete updated.type;
    }

    // Ensure logs is an array
    const logs = Array.isArray(updated.logs)
      ? updated.logs
      : updated.logs
      ? Object.values(updated.logs)  // if logs is an object, take its values
      : [];

    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];

      // Transform dateReviewed
      if (lastLog.dateReviewed) {
        const rawDate = lastLog.dateReviewed.replace(':T', 'T'); // fix API typo
        const dateObj = new Date(rawDate);
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = dateObj.getUTCFullYear();
        updated['Date Reviewed'] = `${day}/${month}/${year}`;
      } else {
        updated['Date Reviewed'] = '';
      }

      // Transform ecid
      updated['EC ID'] = lastLog.ecid ?? '';

      if (lastLog['Base Revision']) updated['Base Revision'] = lastLog['Base Revision'];
      if (lastLog['Equipment Revision']) updated['Equipment Revision'] = lastLog['Equipment Revision'];
    }

    // Always store logs as an array
    updated.logs = logs;

    // Remove old fields to avoid duplication
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

export async function engineeringChangePendingRevision(ECObj) {
  const ctx = IafProj.getCurrent();
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`

  const {facility, unit, equipmentId, siteEquipmentId, properties, TechnicalParameters, username} = ECObj

   const siteEqurl = {
      url: `${baseOmapiUrl}/siteequip/pendingrevision`,
      body: {
        facility, 
        unit, 
        equipmentId, 
        siteEquipmentId, 
        properties, 
        TechnicalParameters, 
        username
      },
    };

    const res = JSON.stringify(siteEqurl.body)


      // Has not been testing yet, waiting for HIT-91
  // try {
  //   let response = await fetch(siteEqurl/url, {
  //         method: 'POST',
  //         mode: 'cors',
  //         headers: {
  //           Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
  //           'Content-Type': 'application/json'
  //         },
  //        body: JSON.stringify(siteEqurl.body),
  //     })

  //   if (response.ok) {
  //     let result = await response.json()
  //     if (result._result.status === 200) {
  //         res.push(result._result.ec)
  //     } else {
  //         res.push({testUrl, message: `ERROR: OMAPI ${testUrl} call returned status other than 200`})
  //     }
  //   } else {
  //     res.push({testUrl, message: `ERROR: OMAPI ${testUrl} call failed`})
  //   }
  // } catch(err) {
  //     console.log(err)
  // }
}
