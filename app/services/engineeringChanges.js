import React from "react";
import { IafProj, IafSession, IafItemSvc } from "@dtplatform/platform-api";
import { convertFieldResponseIntoMuiTextFieldProps } from "@mui/x-date-pickers/internals";

// used to access viewer commands, not used in this example
export async function engineeringChangesAPIs({ buildingId, facilityId }) {
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

      // Transform dateReviewed
      if (lastLog.dateReviewed) {
        const rawDate = lastLog.dateReviewed.replace(':T', 'T'); // fix API typo
        const dateObj = new Date(rawDate);
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
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

    updated.logs = logs;

    delete updated.ecid;
    delete updated.dateReviewed;

    return updated;
  });
}
