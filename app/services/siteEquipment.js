import React from "react";
import { IafProj, IafSession, IafItemSvc } from "@dtplatform/platform-api";
import { convertFieldResponseIntoMuiTextFieldProps } from "@mui/x-date-pickers/internals";

export async function siteEquipmentService(changes, facilityId, buildingId, equipmentId) {
  const ctx = IafProj.getCurrent();

  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const type = changes?.['EC TYPE'];
  const ecid = changes?.['EC ID'];

    let getUrls = [
        `${baseOmapiUrl}/engineeringchanges/${ecid}/equipment?facility=${facilityId}&unit=${buildingId}`
      ]



   let postUrl = { url: `${baseOmapiUrl}/siteequip/search`, body: { facility: facilityId, unit: buildingId, equipmentId: equipmentId, equipmentType: type } };
   let referenceUrl = { url: `${baseOmapiUrl}/references/search`, body: { equipmentId: equipmentId, equipmentType: type } }

   let results = [];
   let refResults = [];
   let getResults = [];


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
          getResults.push({ testUrl, result });
        } else {
          getResults.push({
            testUrl,
            message: `ERROR: OMAPI ${testUrl} call returned status other than 200`,
          });
        }
      } else {
        getResults.push({
          testUrl,
          message: `ERROR: OMAPI ${testUrl} call failed`,
        });
      }
    }

    const passUrl = postUrl.url;
    const refUrl = referenceUrl.url;

      try {
      let response = await fetch(postUrl.url, {
        method: "POST",
        mode: "cors",
        headers: {
          Authorization: "Bearer " + IafSession.getAuthToken(ctx),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postUrl.body),
      });

      if (response.ok) {
        let result = await response.json();
        if (result._result.status === 200) {
          results.push({ passUrl, result });
        } else {
          results.push({
            passUrl,
            message: `ERROR: OMAPI ${passUrl} call returned status other than 200`,
          });
        }
      } else {
        results.push({
          passUrl,
          message: `ERROR: OMAPI ${passUrl} call failed`,
        });
      }
    // }
  } catch (error) {
    results.push({ message: error });
  }

      try {
      let response = await fetch(referenceUrl.url, {
        method: "POST",
        mode: "cors",
        headers: {
          Authorization: "Bearer " + IafSession.getAuthToken(ctx),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(referenceUrl.body),
      });

      if (response.ok) {
        let result = await response.json();
        if (result._result.status === 200) {
          refResults.push({ refUrl, result });
        } else {
          refResults.push({
            refUrl,
            message: `ERROR: OMAPI ${refUrl} call returned status other than 200`,
          });
        }
      } else {
        refResults.push({
          refUrl,
          message: `ERROR: OMAPI ${refUrl} call failed`,
        });
      }
    // }
  } catch (error) {
    refResults.push({ message: error });
  }

  
  const res = results?.[0]?.result?._result?.equipment?._list?.[0];

  const siteEq = getResults?.[0]?.result?._result?.ec?.siteEquipment;
  const refs = getResults?.[0]?.result?._result?.ec?.referenceRevisions;

   console.log('EC9 siteEq', siteEq);
  
//   const latestRevision = siteEq.map(item => {
//   if (Array.isArray(item.revisions) && item.revisions.length > 0) {
//     return {
//       ...item,
//       revisions: [item.revisions[item.revisions.length - 1]], // keep only last
//     }
//   }
//   return item
// })
// const siteEq = [
//   {
//     "_id": "68dedc2e56dd1014cc0874ca",
//     "unitType": "900 MW",
//     "systemId": "RCS",
//     "Equipment Id": "RCP-900-011",
//     "Equipment Name": "Reactor Coolant Pump 900MW",
//     "Site Equipment Id": "RCP-B-021",
//     "tipRevision": "001",
//     "equipmentType": "Pump",
//     "revisions": [
//       {
//         "_id": "68dedc2e56dd1014cc0874da",
//         "revision status date": "2011-03-15T00:00:00Z",
//         "revision status": "ISSUED",
//         "equipmentId": "RCP-900-011",
//         "properties": [
//           {
//             "val": "Westinghouse",
//             "name": "Manufacturer",
//             "type": "string"
//           },
//           {
//             "val": "RCP-900",
//             "name": "Model",
//             "type": "string"
//           },
//           {
//             "val": "Class 1",
//             "name": "Safety Class",
//             "type": "string"
//           },
//           {
//             "val": "Operational",
//             "name": "Operating Status",
//             "type": "string"
//           },
//           {
//             "val": "2025-01-22T00:00:00Z",
//             "name": "Operational Status Date",
//             "type": "date"
//           }
//         ],
//         "revision": "001",
//         "TechnicalParameters": [
//           {
//             "val": 2100,
//             "unit": "gpm",
//             "name": "FlowRate",
//             "type": "number"
//           },
//           {
//             "val": 10,
//             "unit": "MW",
//             "name": "Power",
//             "type": "number"
//           }
//         ]
//       }
//     ]
//   },
//   {
//     "_id": "68dedc2e56dd1014cc0874cd",
//     "unitType": "900 MW",
//     "systemId": "RCS",
//     "Equipment Id": "RCP-900-014",
//     "Equipment Name": "Reactor Coolant Pump 900MW",
//     "Site Equipment Id": "RCP-B-024",
//     "tipRevision": "001A",
//     "equipmentType": "Pump",
//     "revisions": [
//       {
//         "_id": "68e0271356dd1014cc097904",
//         "revision status date": "2025-10-03T00:00:00.000Z",
//         "revision status": "PENDING",
//         "equipmentId": "RCP-900-014",
//         "original": {
//             "properties": [
//                {
//                   "val": "Westinghouse",
//                   "name": "Manufacturer",
//                   "type": "string"
//                },
//                {
//                   "val": "RCP-900",
//                   "name": "Model",
//                   "type": "string"
//                },
//                {
//                   "val": "Class 1",
//                   "name": "Safety Class",
//                   "type": "string"
//                },
//                {
//                   "val": "Operational",
//                   "name": "Operating Status",
//                   "type": "string"
//                },
//                {
//                   "val": "2025-01-22T00:00:00Z",
//                   "name": "Operational Status Date",
//                   "type": "date"
//                }
//             ],
//             "TechnicalParameters": [
//                {
//                   "val": 2100,
//                   "unit": "gpm",
//                   "name": "FlowRate",
//                   "type": "number"
//                },
//                {
//                   "val": 10,
//                   "unit": "MW",
//                   "name": "Power",
//                   "type": "number"
//                }
//             ]
//          },
//          "edited": {
//             "properties": [
//                {
//                   "val": "KSB",
//                   "name": "Manufacturer",
//                   "type": "string"
//                },
//                {
//                   "val": "RSR",
//                   "name": "Model",
//                   "type": "string"
//                },
//             //    {
//             //       "val": "2024-10-25T00:00:00Z",
//             //       "name": "Operational Status Date",
//             //       "type": "date"
//             //    }
//             ],
//          },
//         "properties": [
//           {
//             "val": "KSB",
//             "name": "Manufacturer",
//             "type": "string"
//           },
//           {
//             "val": "RSR",
//             "name": "Model",
//             "type": "string"
//           },
//           {
//             "val": "Class 1",
//             "name": "Safety Class",
//             "type": "string"
//           },
//           {
//             "val": "Operational",
//             "name": "Operating Status",
//             "type": "string"
//           },
//           {
//             "val": "2024-10-25T00:00:00Z",
//             "name": "Operational Status Date",
//             "type": "date"
//           }
//         ],
//         "revision": "001A",
//         "TechnicalParameters": [
//           {
//             "val": 2800,
//             "unit": "gpm",
//             "name": "FlowRate",
//             "type": "number"
//           },
//           {
//             "val": 18,
//             "unit": "MW",
//             "name": "Power",
//             "type": "number"
//           }
//         ]
//       }
//     ]
//   },
//   {
//     "_id": "68dedc2e56dd1014cc0874cb",
//     "unitType": "900 MW",
//     "systemId": "RCS",
//     "Equipment Id": "RCP-900-012",
//     "Equipment Name": "Reactor Coolant Pump 900MW",
//     "Site Equipment Id": "RCP-B-022",
//     "tipRevision": "001",
//     "equipmentType": "Pump",
//     "revisions": [
//       {
//         "_id": "68dedc2e56dd1014cc0874db",
//         "revision status date": "2011-03-15T00:00:00Z",
//         "revision status": "ISSUED",
//         "equipmentId": "RCP-900-012",
//         "properties": [
//           {
//             "val": "Westinghouse",
//             "name": "Manufacturer",
//             "type": "string"
//           },
//           {
//             "val": "RCP-900",
//             "name": "Model",
//             "type": "string"
//           },
//           {
//             "val": "Class 1",
//             "name": "Safety Class",
//             "type": "string"
//           },
//           {
//             "val": "Operational",
//             "name": "Operating Status",
//             "type": "string"
//           },
//           {
//             "val": "2025-01-22T00:00:00Z",
//             "name": "Operational Status Date",
//             "type": "date"
//           }
//         ],
//         "revision": "001",
//         "TechnicalParameters": [
//           {
//             "val": 2100,
//             "unit": "gpm",
//             "name": "FlowRate",
//             "type": "number"
//           },
//           {
//             "val": 10,
//             "unit": "MW",
//             "name": "Power",
//             "type": "number"
//           }
//         ]
//       }
//     ]
//   },
//   {
//     "_id": "68dedc2e56dd1014cc0874cc",
//     "unitType": "900 MW",
//     "systemId": "RCS",
//     "Equipment Id": "RCP-900-013",
//     "Equipment Name": "Reactor Coolant Pump 900MW",
//     "Site Equipment Id": "RCP-B-023",
//     "tipRevision": "001A",
//     "equipmentType": "Pump",
    
//     "revisions": [
//       {
//         "_id": "68e0148d277eea0741e299ae",
//         "revision status date": "2025-10-03T00:00:00.000Z",
//         "revision status": "PENDING",
//         "equipmentId": "RCP-900-013",
//         //edited and original property arrays should be here somewhere
//         "original": {
//             "properties": [
//                {
//                   "val": "Westinghouse",
//                   "name": "Manufacturer",
//                   "type": "string"
//                },
//                {
//                   "val": "RCP-900",
//                   "name": "Model",
//                   "type": "string"
//                },
//                {
//                   "val": "Class 1",
//                   "name": "Safety Class",
//                   "type": "string"
//                },
//                {
//                   "val": "Operational",
//                   "name": "Operating Status",
//                   "type": "string"
//                },
//                {
//                   "val": "2025-01-22T00:00:00Z",
//                   "name": "Operational Status Date",
//                   "type": "date"
//                }
//             ],
//             "TechnicalParameters": [
//                {
//                   "val": 2100,
//                   "unit": "gpm",
//                   "name": "FlowRate",
//                   "type": "number"
//                },
//                {
//                   "val": 10,
//                   "unit": "MW",
//                   "name": "Power",
//                   "type": "number"
//                }
//             ]
//          },
//          "edited": {
//             "properties": [
//                {
//                   "val": "KSB",
//                   "name": "Manufacturer",
//                   "type": "string"
//                },
//                {
//                   "val": "RSR",
//                   "name": "Model",
//                   "type": "string"
//                },
//             ],
//             "TechnicalParameters": [
//                {
//                   "val": 2800,
//                   "unit": "gpm",
//                   "name": "FlowRate",
//                   "type": "number"
//                },
//                {
//                   "val": 18,
//                   "unit": "MW",
//                   "name": "Power",
//                   "type": "number"
//                }
//             ]
//          },
//         "properties": [
//           {
//             "val": "KSB",
//             "name": "Manufacturer",
//             "type": "string"
//           },
//           {
//             "val": "RSR",
//             "name": "Model",
//             "type": "string"
//           },
//           {
//             "val": "Class 1",
//             "name": "Safety Class",
//             "type": "string"
//           },
//           {
//             "val": "Operational",
//             "name": "Operating Status",
//             "type": "string"
//           },
//           {
//             "val": "2024-10-25T00:00:00Z",
//             "name": "Operational Status Date",
//             "type": "date"
//           }
//         ],
//         "revision": "001A",
//         "TechnicalParameters": [
//           {
//             "val": 2800,
//             "unit": "gpm",
//             "name": "FlowRate",
//             "type": "number"
//           },
//           {
//             "val": 18,
//             "unit": "MW",
//             "name": "Power",
//             "type": "number"
//           }
//         ]
//       }
//     ]
//   }
// ]


const matchedRevision = siteEq?.map(item => {
  if (Array.isArray(item.revisions) && item.revisions.length > 0) {
    const match = item.revisions.find(r => r.revision === item.tipVersion);

    return {
      ...item,
      revisions: match ? [match] : [item.revisions[item.revisions.length - 1]], 
    };
  }
  return item;
});


console.log('EC8 matchedRevision', JSON.stringify(matchedRevision, null, 2));
console.log('EC8 matchedRevision normal', matchedRevision);

function normalizeEC(siteEq) {
  return (siteEq || []).map(eq => {
    const tip = eq.tipRevision ?? eq.tiprevision ?? eq.TipRevision ?? eq.tipVersion;
    const revisions = Array.isArray(eq.revisions) ? eq.revisions : [];
    const chosen = revisions.find(r => String(r.revision).trim() === String(tip).trim())
      || revisions[revisions.length - 1];

    return {
      ...eq,
      revisions: [
        {
          ...chosen,
          // always preserve top-level edited/original if present
          edited: chosen?.edited || eq?.edited || null,
          original: chosen?.original || eq?.original || null,
        },
      ],
    };
  });
}

const normalized = normalizeEC(matchedRevision);

console.log('After normalizeEC', JSON.stringify(normalized, null, 2));

const mergeSiteRefs = mergeReferenceRevisions(refs, normalized);
const mergedEdits = mergeEditsIntoEquipments(mergeSiteRefs);

console.log('After mergeEditsIntoEquipments', JSON.stringify(mergedEdits, null, 2));

return mergedEdits;
}

function mergeReferenceRevisions(refs, siteEq) {
  if (!Array.isArray(refs)) return siteEq;
  if (!Array.isArray(siteEq)) return [];

  function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') {
      return Object.entries(val).map(([name, obj]) => ({ name, ...obj }));
    }
    return [];
  }

  return siteEq.map(eq => {
    const matchRef = refs.find(r => r.equipmentId === eq['Equipment Id'] || r.equipmentId === eq.equipmentId);
    if (!matchRef) return eq;

    const eqRev = eq.revisions?.[0];
    if (!eqRev) return eq;

    const refTech = toArray(matchRef.TechnicalParameters);
    const refProps = toArray(matchRef.properties);

    const updatedTech = toArray(eqRev.TechnicalParameters).map(tp => {
      const refParam = refTech.find(rtp => rtp.name === tp.name);
      return refParam ? { ...tp, refVal: refParam.val } : tp;
    });

    const updatedProps = toArray(eqRev.properties).map(p => {
      const refProp = refProps.find(rp => rp.name === p.name);
      return refProp ? { ...p, refVal: refProp.val } : p;
    });

    return {
      ...eq,
      revisions: [
        {
          ...eqRev,
          TechnicalParameters: updatedTech,
          properties: updatedProps,
        },
      ],
    };
  });
}


export async function siteEquipmentForTreeService(facilityId, buildingId, equipmentIds) {
  const ctx = IafProj.getCurrent();

  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;


    // const siteEqurl = { url: `${baseOmapiUrl}/siteequip/search`, body: { facility: facilityId, unit: buildingId, equipmentId: 'SG-900-001', equipmentType: "Pump" }};

  //   const siteUrl = siteEqurl.url;

  const refUrl =   { url: `${baseOmapiUrl}/references/search`, body: { equipmentId: 'SG-900-001', equipmentType: "Pump" } }

  const results = [];
  const refResults = [];
   
  for (const eq of equipmentIds) {
    const equipmentId = eq['Equipment Id'] || eq['equipmentId'];
    if (!equipmentId) continue;

    const siteEqurl = {
      url: `${baseOmapiUrl}/siteequip/search`,
      body: {
        facility: facilityId,
        unit: buildingId,
        equipmentId,
        equipmentType: 'Pump',
      },
    };

    try {
      const response = await fetch(siteEqurl.url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(siteEqurl.body),
      });

      if (response.ok) {
        const result = await response.json();
        if (result._result?.status === 200) {
          const equipmentItem = result._result?.equipment?._list?.[0];
          if (equipmentItem) {
            results.push(equipmentItem);
          } else {
            results.push({
              equipmentId,
              message: `No equipment found for ID ${equipmentId}`,
            });
          }
        } else {
          results.push({
            equipmentId,
            message: `ERROR: OMAPI ${siteEqurl.url} returned status ${result._result?.status}`,
          });
        }
      } else {
        results.push({
          equipmentId,
          message: `ERROR: OMAPI ${siteEqurl.url} call failed with ${response.status}`,
        });
      }
    } catch (err) {
      results.push({
        equipmentId,
        message: `Exception: ${err.message}`,
      });
    }

    // 🔹 References POST (per equipmentId)
    const refUrl = {
      url: `${baseOmapiUrl}/references/search`,
      body: {
        equipmentId,
        equipmentType: 'Pump',
      },
    };

    try {
      const refResponse = await fetch(refUrl.url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(refUrl.body),
      });

      if (refResponse.ok) {
        const result = await refResponse.json();
        if (result._result?.status === 200) {
          refResults.push({
            equipmentId,
            result: result._result,
          });
        } else {
          refResults.push({
            equipmentId,
            message: `ERROR: OMAPI ${refUrl.url} returned status ${result._result?.status}`,
          });
        }
      } else {
        refResults.push({
          equipmentId,
          message: `ERROR: OMAPI ${refUrl.url} call failed with ${refResponse.status}`,
        });
      }
    } catch (err) {
      refResults.push({
        equipmentId,
        message: `Exception: ${err.message}`,
      });
    }
  }

  console.log('EC results for tree view', results);

const latestVersion = pickTipRevision(results);


// const latestVersion = [
//   {
//     unitType: "900 MW",
//     systemId: "RCS",
//     "Equipment Id": "RCP-900-011",
//     "Equipment Name": "Reactor Coolant Pump 900MW",
//     "Site Equipment Id": "RCP-A-011",
//     tipRevision: "001",
//     revisions: [
//       {
//         "revision status date": "2010-09-01T00:00:00Z",
//         "revision status": "ISSUED",
//         _id: "68d64f9656dd1014cc019250",
//         _metadata: {
//           _updatedById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//           _createdAt: 1758875542332,
//           _createdById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//           _updatedAt: 1758875542332,
//         },
//         equipmentId: "RCP-900-011",
//         properties: [
//           {
//             val: "Westinghouse",
//             name: "Manufacturer",
//             type: "string",
//           },
//           {
//             val: "RCP-900",
//             name: "Model",
//             type: "string",
//           },
//           {
//             val: "Class 1",
//             name: "Safety Class",
//             type: "string",
//           },
//           {
//             val: "Operational",
//             name: "Operating Status",
//             type: "string",
//           },
//           {
//             val: "2024-10-25T00:00:00Z",
//             name: "Operational Status Date",
//             type: "date",
//           },
//         ],
//         revision: "001",
//         TechnicalParameters: [
//           {
//             val: 2100,
//             unit: "gpm",
//             name: "FlowRate",
//             type: "number",
//           },
//           {
//             val: 10,
//             unit: "MW",
//             name: "Power",
//             type: "number",
//           },
//         ],
//       },
//     ],
//     _id: "68d64f9656dd1014cc019240",
//     _metadata: {
//       _updatedById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//       _createdAt: 1758875542079,
//       _createdById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//       _updatedAt: 1758875542079,
//     },
//     equipmentType: "Pump",
//   },
//   {
//     unitType: "900 MW",
//     systemId: "RCS",
//     "Equipment Id": "RCP-900-012",
//     "Equipment Name": "Reactor Coolant Pump 900MW",
//     "Site Equipment Id": "RCP-A-012",
//     tipRevision: "001A",
//     revisions: [
//       {
//         "revision status date": "2010-09-01T00:00:00Z",
//         "revision status": "PENDING",
//         edited: {
//                   "properties": [
//                      {
//                         "val": "KSB",
//                         "name": "Manufacturer",
//                         "type": "string"
//                      },
//                   ],
//                   "TechnicalParameters": [
//                      {
//                         "val": 2800,
//                         "unit": "gpm",
//                         "name": "FlowRate",
//                         "type": "number"
//                      },
//                   ]
//                },

//                original: {
//                     "properties": [
//                         {
//                             "val": "Westinghouse",
//                             "name": "Manufacturer",
//                             "type": "string"
//                         },
//                         {
//                             "val": "RCP-900",
//                             "name": "Model",
//                             "type": "string"
//                         },
//                         {
//                             "val": "Class 1",
//                             "name": "Safety Class",
//                             "type": "string"
//                         },
//                         {
//                             "val": "Operational",
//                             "name": "Operating Status",
//                             "type": "string"
//                         },
//                         {
//                             "val": "2025-01-22T00:00:00Z",
//                             "name": "Operational Status Date",
//                             "type": "date"
//                         }
//                     ],
//                     "TechnicalParameters": [
//                         {
//                             "val": 2100,
//                             "unit": "gpm",
//                             "name": "FlowRate",
//                             "type": "number"
//                         },
//                         {
//                             "val": 10,
//                             "unit": "MW",
//                             "name": "Power",
//                             "type": "number"
//                         }
//                     ]
//                 },
//         _id: "68d64f9656dd1014cc019251",
//         _metadata: {
//           _updatedById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//           _createdAt: 1758875542332,
//           _createdById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//           _updatedAt: 1758875542332,
//         },
//         equipmentId: "RCP-900-012",
//         properties: [
//           {
//             val: "Westinghouse",
//             name: "Manufacturer",
//             type: "string",
//           },
//           {
//             val: "RCP-900",
//             name: "Model",
//             type: "string",
//           },
//           {
//             val: "Class 1",
//             name: "Safety Class",
//             type: "string",
//           },
//           {
//             val: "Operational",
//             name: "Operating Status",
//             type: "string",
//           },
//           {
//             val: "2024-10-25T00:00:00Z",
//             name: "Operational Status Date",
//             type: "date",
//           },
//         ],
//         revision: "001A",
//         TechnicalParameters: [
//           {
//             val: 2100,
//             unit: "gpm",
//             name: "FlowRate",
//             type: "number",
//           },
//           {
//             val: 10,
//             unit: "MW",
//             name: "Power",
//             type: "number",
//           },
//         ],
//       },
//     ],
//     _id: "68d64f9656dd1014cc019241",
//     _metadata: {
//       _updatedById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//       _createdAt: 1758875542079,
//       _createdById: "6ae13743-a90f-4b74-8252-a16ca47cd14e",
//       _updatedAt: 1758875542079,
//     },
//     equipmentType: "Pump",
//   },
// ];

  const referenceRevisions = extractTipRevisionRevisions(refResults);

const mergedRefVals = mergeRefVals(latestVersion, referenceRevisions);
const mergedWithEdits = mergeEditsIntoEquipments(mergedRefVals);
console.log('After mergeEditsIntoEquipments two', JSON.stringify(mergedWithEdits, null, 2));
return mergedWithEdits;

}

function pickTipRevision(equipmentArray) {
  if (!Array.isArray(equipmentArray)) return [];

  return equipmentArray.map(item => {
    const revisions = item.revisions?._list || [];

    // Normalize both to string for comparison
    const tip = String(item.tipRevision).trim();
    const match = revisions.find(r => String(r.revision).trim() === tip);

    return {
      ...item,
      revisions: match ? [match] : [], // only keep the matched one
    };
  });
}

function extractTipRevisionRevisions(refResults) {
  const processed = [];

  for (const ref of refResults) {
    const eq = ref?.result?.equipment?._list?.[0];
    if (!eq) continue;

    const tipRev = eq.tipRevision || eq.tiprevision || eq.TipRevision;
    const revisions = eq.revisions || [];

    if (!tipRev || !Array.isArray(revisions)) {
      processed.push({
        equipmentId: eq['Equipment Id'] || eq.equipmentId,
        message: 'No tipRevision or revisions found',
      });
      continue;
    }

    // find the revision with revision === tipRevision
    const matched = revisions.find(r => r.revision === tipRev);

    if (matched) {
      processed.push({
        equipmentId: eq['Equipment Id'] || eq.equipmentId,
        equipmentName: eq['Equipment Name'] || eq.equipmentName,
        equipmentType: eq.equipmentType,
        systemId: eq.systemId,
        tipRevision: tipRev,
        revision: matched,   
      });
    } else {
      processed.push({
        equipmentId: eq['Equipment Id'] || eq.equipmentId,
        tipRevision: tipRev,
        available: revisions.map(r => r.revision),
        message: `No revision found matching tipRevision=${tipRev}`,
      });
    }
  }

  return processed;
}

function mergeRefVals(latestVersion, referenceRevisions) {
  return latestVersion.map(lv => {
    const eqId = lv['Equipment Id'] || lv.equipmentId;
    const lvRev = lv.revisions?.[0];

    if (!eqId || !lvRev) return lv;

    // find matching reference item
    const ref = referenceRevisions.find(r =>
      (r.equipmentId === eqId) &&
      (r.revision?.revision === r.tipRevision) // sanity check
    );

    if (!ref || !ref.revision) return lv;

    const refRev = ref.revision;

    function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  // convert object { FlowRate: {...}, Power: {...} } → [{ name: "FlowRate", ...}, { name: "Power", ...}]
  return Object.entries(val).map(([name, obj]) => ({ name, ...obj }));
}

    // enrich TechnicalParameters
    const enrichedTech = toArray(lvRev.TechnicalParameters).map(tp => {
      const refTp = (refRev.TechnicalParameters || []).find(rtp => rtp.name === tp.name);
      return refTp ? { ...tp, refVal: refTp.val } : tp;
    });

    // enrich properties
    const enrichedProps = toArray(lvRev.properties).map(prop => {
      const refProp = (refRev.properties || []).find(rp => rp.name === prop.name);
      return refProp ? { ...prop, refVal: refProp.val } : prop;
    });

    return {
      ...lv,
      revisions: [
        {
          ...lvRev,
          TechnicalParameters: enrichedTech,
          properties: enrichedProps,
        }
      ]
    };
  });
}

function toArray(objOrArr) {
  if (Array.isArray(objOrArr)) return objOrArr;
  if (objOrArr && typeof objOrArr === 'object') {
    return Object.entries(objOrArr).map(([name, { val, type, refVal, unit }]) => ({
      name,
      val,
      type,
      refVal,
      unit
    }));
  }
  return [];
}

function mergeEditsIntoEquipments(equipmentList) {
  if (!Array.isArray(equipmentList)) return [];

  return equipmentList.map(eq => {
    if (!Array.isArray(eq.revisions)) return eq;

    return {
      ...eq,
      revisions: eq.revisions.map(rev => {
        const edited = rev.edited || eq.edited || {};
        const original = rev.original || eq.original || {};

        const editedProps = toArray(edited.properties);
        const editedTechs = toArray(edited.TechnicalParameters);

        const originalProps = toArray(original.properties);
        const originalTechs = toArray(original.TechnicalParameters);

        const props = toArray(rev.properties);
        const techs = toArray(rev.TechnicalParameters);

        const mergedProps = props.map(prop => {
          const match = editedProps.find(e => e.name === prop.name);
          if (match) {
            const originalMatch = originalProps.find(o => o.name === prop.name);
            return {
              ...prop,
              originalVal: originalMatch ? originalMatch.val : undefined,
              isEdited: true
            };
          }
          return prop;
        });

        const mergedTechs = techs.map(param => {
          const match = editedTechs.find(e => e.name === param.name);
          if (match) {
            const originalMatch = originalTechs.find(o => o.name === param.name);
            return {
              ...param,
              originalVal: originalMatch ? originalMatch.val : undefined,
              isEdited: true
            };
          }
          return param;
        });

        return {
          ...rev,
          properties: mergedProps,
          TechnicalParameters: mergedTechs
        };
      })
    };
  });
}
export async function rejectPendingRevision(facilityId, buildingId, equipmentId, revisionId) {
  const ctx = IafProj.getCurrent();  // don’t forget ctx
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const url = `${baseOmapiUrl}/siteequip/facilities/${facilityId}/units/${buildingId}/siteequipment/${equipmentId}/revisions/${revisionId}/pendingrevision`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      mode: "cors",
      headers: {
        Authorization: "Bearer " + IafSession.getAuthToken(ctx),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Delete failed with status ${response.status}`);
    }

    const result = await response.json();

    if (result?._result?.status === 200) {
      return {
        success: true,
        message: "Pending revision successfully rejected",
        result: result._result
      };
    }

    return {
      success: false,
      message: result?._result?.message || "Unknown error",
      result: result._result
    };

  } catch (err) {
    return {
      success: false,
      message: err.message
    };
  }
}

export async function approvePendingRevision(revision, facilityId, buildingId, equipmentId, username) {
  const ctx = IafProj.getCurrent();  // don’t forget ctx
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

    const siteEqUrl = {
      url: `${baseOmapiUrl}/siteequip/approvedrevision`,
      body: {
        revision: revision,
        facility: facilityId,
        unit: buildingId,
        siteEquipmentId: equipmentId,
        username: username
      },
    };

    try {
    const response = await fetch(siteEqUrl.url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        Authorization: "Bearer " + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(siteEqUrl.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Approve failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    return { success: true, result };
  } catch (err) {
    console.error('approvePendingRevision error:', err);
    return { success: false, message: err.message };
  }
}
