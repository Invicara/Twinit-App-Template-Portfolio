import React from "react";
import { IafProj, IafSession, IafItemSvc } from "@dtplatform/platform-api";
import { convertFieldResponseIntoMuiTextFieldProps } from "@mui/x-date-pickers/internals";

// used to access viewer commands, not used in this example
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
  

//   const latestRevision = siteEq.map(item => {
//   if (Array.isArray(item.revisions) && item.revisions.length > 0) {
//     return {
//       ...item,
//       revisions: [item.revisions[item.revisions.length - 1]], // keep only last
//     }
//   }
//   return item
// })

const matchedRevision = siteEq.map(item => {
  if (Array.isArray(item.revisions) && item.revisions.length > 0) {
    // find the revision whose "revision" equals the item's "tipVersion"
    const match = item.revisions.find(r => r.revision === item.tipVersion);

    return {
      ...item,
      revisions: match ? [match] : [item.revisions[item.revisions.length - 1]], // fallback to last if no match
    };
  }
  return item;
});

  const mergeSiteRefs = mergeReferenceRevisions(refs, matchedRevision);
  return mergeSiteRefs;
}

function mergeReferenceRevisions(refs, siteEq) {
  refs.forEach(ref => {
    const matchEq = siteEq.find(se => se['Equipment Id'] === ref.equipmentId);
    if (!matchEq) return;

    const matchRev = matchEq.revisions.find(r => r.revision === ref.revision);
    if (!matchRev) return;

    // --- Technical Parameters ---
    matchRev.TechnicalParameters = matchRev.TechnicalParameters.map(tp => {
      const refParam = ref.TechnicalParameters.find(rtp => rtp.name === tp.name);
      if (refParam) {
        return { ...tp, refVal: refParam.val }; // add refVal for FlowRate, Power etc.
      }
      return tp;
    });

    console.log('EC8 Matchrev', matchRev)
    // --- Properties (Manufacturer, Model, etc) ---
    matchRev.properties = matchRev.properties.map(p => {
      if (p.name === 'Manufacturer' || p.name === 'Model') {
        const refProp = ref.properties?.find(rp => rp.name === p.name);
        if (refProp) {
          return { ...p, refVal: refProp.val }; // add refVal for Manufacturer & Model
        }
      }
      return p;
    });
  });

  return siteEq;
}



