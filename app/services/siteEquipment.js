import React from "react";
import { IafProj, IafSession, IafItemSvc } from "@dtplatform/platform-api";
import { convertFieldResponseIntoMuiTextFieldProps } from "@mui/x-date-pickers/internals";

// used to access viewer commands, not used in this example
export async function siteEquipmentService(changes, facilityId, buildingId, equipmentId) {
  const ctx = IafProj.getCurrent();

  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  console.log('EC8 ec', changes);
  const type = changes?.EC?.['EC TYPE'];
  console.log('EC8 buildingId', buildingId);
  console.log('E8 type', type);
  let getUrls = [
    `${baseOmapiUrl}/engineeringchanges`,
    `${baseOmapiUrl}/engineeringchanges/001/logs?pageSize=20`,
  ];

   let postUrl = { url: `${baseOmapiUrl}/siteequip/search`, body: { facility: facilityId, unit: buildingId, equipmentId: equipmentId, equipmentType: type } };
      
  let results = [];


    // for (const testUrl of getUrls) {
    //   let response = await fetch(testUrl, {
    //     method: "GET",
    //     mode: "cors",
    //     headers: {
    //       Authorization: "Bearer " + IafSession.getAuthToken(ctx),
    //       "Content-Type": "application/json",
    //     },
    //   });

    //   if (response.ok) {
    //     let result = await response.json();
    //     if (result._result.status === 200) {
    //       testResults.push({ testUrl, result });
    //     } else {
    //       testResults.push({
    //         testUrl,
    //         message: `ERROR: OMAPI ${testUrl} call returned status other than 200`,
    //       });
    //     }
    //   } else {
    //     testResults.push({
    //       testUrl,
    //       message: `ERROR: OMAPI ${testUrl} call failed`,
    //     });
    //   }
    // }

    // for (const testUrl of postUrls) {

    const passUrl = postUrl.url;
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

  console.log('EC9 results', results);
  const res = results?.[0]?.result?._result?.equipment?._list?.[0];

//  const ecs = testResults?.[0]?.result?._result?.ecs;

//  const formattedECs = transformECs(ecs, buildingId, facilityId);
  return res;
}

