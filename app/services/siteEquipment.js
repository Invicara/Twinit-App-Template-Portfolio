import React from "react";
import { IafProj, IafSession, IafItemSvc } from "@dtplatform/platform-api";
import { convertFieldResponseIntoMuiTextFieldProps } from "@mui/x-date-pickers/internals";

export async function siteEquipmentService(
  changes,
  facilityId,
  buildingId,
  equipmentId,
) {
  const ctx = IafProj.getCurrent();

  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const type = changes?.["EC TYPE"];
  const ecid = changes?.["EC ID"];

  let getUrls = [
    `${baseOmapiUrl}/engineeringchanges/${ecid}/equipment?facility=${facilityId}&unit=${buildingId}`,
  ];

  let postUrl = {
    url: `${baseOmapiUrl}/siteequip/search`,
    body: {
      facility: facilityId,
      unit: buildingId,
      equipmentId: equipmentId,
      equipmentType: type,
    },
  };
  let referenceUrl = {
    url: `${baseOmapiUrl}/references/search`,
    body: { equipmentId: equipmentId, equipmentType: type },
  };

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

  const matchedRevision = siteEq?.map((item) => {
    if (Array.isArray(item.revisions) && item.revisions.length > 0) {
      const match = item.revisions.find((r) => r.revision === item.tipVersion);

      return {
        ...item,
        revisions: match
          ? [match]
          : [item.revisions[item.revisions.length - 1]],
      };
    }
    return item;
  });

  console.log("EC8 matchedRevision", JSON.stringify(matchedRevision, null, 2));
  console.log("EC8 matchedRevision normal", matchedRevision);

  function normalizeEC(siteEq) {
    return (siteEq || []).map((eq) => {
      const tip =
        eq.tipRevision ?? eq.tiprevision ?? eq.TipRevision ?? eq.tipVersion;
      const revisions = Array.isArray(eq.revisions) ? eq.revisions : [];
      const chosen =
        revisions.find(
          (r) => String(r.revision).trim() === String(tip).trim(),
        ) || revisions[revisions.length - 1];

      return {
        ...eq,
        revisions: [
          {
            ...chosen,
            edited: chosen?.edited || eq?.edited || null,
            original: chosen?.original || eq?.original || null,
          },
        ],
      };
    });
  }

  const normalized = normalizeEC(matchedRevision);

  console.log("After normalizeEC", JSON.stringify(normalized, null, 2));

  const mergeSiteRefs = mergeReferenceRevisions(refs, normalized);
  const mergedEdits = mergeEditsIntoEquipments(mergeSiteRefs);

  console.log(
    "After mergeEditsIntoEquipments",
    JSON.stringify(mergedEdits, null, 2),
  );

  return mergedEdits;
}

function mergeReferenceRevisions(refs, siteEq) {
  if (!Array.isArray(refs)) return siteEq;
  if (!Array.isArray(siteEq)) return [];

  function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "object") {
      return Object.entries(val).map(([name, obj]) => ({ name, ...obj }));
    }
    return [];
  }

  return siteEq.map((eq) => {
    const matchRef = refs.find(
      (r) =>
        r.equipmentId === eq["Equipment Id"] ||
        r.equipmentId === eq.equipmentId,
    );
    if (!matchRef) return eq;

    const eqRev = eq.revisions?.[0];
    if (!eqRev) return eq;

    const refTech = toArray(matchRef.TechnicalParameters);
    const refProps = toArray(matchRef.properties);

    const updatedTech = toArray(eqRev.TechnicalParameters).map((tp) => {
      const refParam = refTech.find((rtp) => rtp.name === tp.name);
      return refParam ? { ...tp, refVal: refParam.val } : tp;
    });

    const updatedProps = toArray(eqRev.properties).map((p) => {
      const refProp = refProps.find((rp) => rp.name === p.name);
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

export async function siteEquipmentForTreeService(
  facilityId,
  buildingId,
  equipmentIds,
) {
  const ctx = IafProj.getCurrent();

  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const results = [];
  const refResults = [];

  for (const eq of equipmentIds) {
    const equipmentId = eq["Equipment Id"] || eq["equipmentId"];
    if (!equipmentId) continue;

    const siteEqurl = {
      url: `${baseOmapiUrl}/siteequip/search`,
      body: {
        facility: facilityId,
        unit: buildingId,
        equipmentId,
        // equipmentType: "Pump",
      },
    };

    try {
      const response = await fetch(siteEqurl.url, {
        method: "POST",
        mode: "cors",
        headers: {
          Authorization: "Bearer " + IafSession.getAuthToken(ctx),
          "Content-Type": "application/json",
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

    const refUrl = {
      url: `${baseOmapiUrl}/references/search`,
      body: {
        equipmentId,
        equipmentType: "Pump",
      },
    };

    try {
      const refResponse = await fetch(refUrl.url, {
        method: "POST",
        mode: "cors",
        headers: {
          Authorization: "Bearer " + IafSession.getAuthToken(ctx),
          "Content-Type": "application/json",
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

  console.log("EC results for tree view", results);

  const latestVersion = pickTipRevision(results);
  const referenceRevisions = extractTipRevisionRevisions(refResults);

  const mergedRefVals = mergeRefVals(latestVersion, referenceRevisions);
  const mergedWithEdits = mergeEditsIntoEquipments(mergedRefVals);
  console.log(
    "After mergeEditsIntoEquipments two",
    JSON.stringify(mergedWithEdits, null, 2),
  );
  return mergedWithEdits;
}

function pickTipRevision(equipmentArray) {
  if (!Array.isArray(equipmentArray)) return [];

  return equipmentArray.map((item) => {
    const revisions = item.revisions?._list || [];

    const tip = String(item.tipRevision).trim();
    const match = revisions.find((r) => String(r.revision).trim() === tip);

    return {
      ...item,
      revisions: match ? [match] : [],
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
        equipmentId: eq["Equipment Id"] || eq.equipmentId,
        message: "No tipRevision or revisions found",
      });
      continue;
    }

    const matched = revisions.find((r) => r.revision === tipRev);

    if (matched) {
      processed.push({
        equipmentId: eq["Equipment Id"] || eq.equipmentId,
        equipmentName: eq["Equipment Name"] || eq.equipmentName,
        equipmentType: eq.equipmentType,
        systemId: eq.systemId,
        tipRevision: tipRev,
        revision: matched,
      });
    } else {
      processed.push({
        equipmentId: eq["Equipment Id"] || eq.equipmentId,
        tipRevision: tipRev,
        available: revisions.map((r) => r.revision),
        message: `No revision found matching tipRevision=${tipRev}`,
      });
    }
  }

  return processed;
}

function mergeRefVals(latestVersion, referenceRevisions) {
  return latestVersion.map((lv) => {
    const eqId = lv["Equipment Id"] || lv.equipmentId;
    const lvRev = lv.revisions?.[0];

    if (!eqId || !lvRev) return lv;

    const ref = referenceRevisions.find(
      (r) => r.equipmentId === eqId && r.revision?.revision === r.tipRevision, // sanity check
    );

    if (!ref || !ref.revision) return lv;

    const refRev = ref.revision;

    function toArray(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val;

      return Object.entries(val).map(([name, obj]) => ({ name, ...obj }));
    }

    const enrichedTech = toArray(lvRev.TechnicalParameters).map((tp) => {
      const refTp = (refRev.TechnicalParameters || []).find(
        (rtp) => rtp.name === tp.name,
      );
      return refTp ? { ...tp, refVal: refTp.val } : tp;
    });

    const enrichedProps = toArray(lvRev.properties).map((prop) => {
      const refProp = (refRev.properties || []).find(
        (rp) => rp.name === prop.name,
      );
      return refProp ? { ...prop, refVal: refProp.val } : prop;
    });

    return {
      ...lv,
      revisions: [
        {
          ...lvRev,
          TechnicalParameters: enrichedTech,
          properties: enrichedProps,
        },
      ],
    };
  });
}

function toArray(objOrArr) {
  if (Array.isArray(objOrArr)) return objOrArr;
  if (objOrArr && typeof objOrArr === "object") {
    return Object.entries(objOrArr).map(
      ([name, { val, type, refVal, unit }]) => ({
        name,
        val,
        type,
        refVal,
        unit,
      }),
    );
  }
  return [];
}

function mergeEditsIntoEquipments(equipmentList) {
  if (!Array.isArray(equipmentList)) return [];

  return equipmentList.map((eq) => {
    if (!Array.isArray(eq.revisions)) return eq;

    return {
      ...eq,
      revisions: eq.revisions.map((rev) => {
        const edited = rev.edited || eq.edited || {};
        const original = rev.original || eq.original || {};

        const editedProps = toArray(edited.properties);
        const editedTechs = toArray(edited.TechnicalParameters);

        const originalProps = toArray(original.properties);
        const originalTechs = toArray(original.TechnicalParameters);

        const props = toArray(rev.properties);
        const techs = toArray(rev.TechnicalParameters);

        const mergedProps = props.map((prop) => {
          const match = editedProps.find((e) => e.name === prop.name);
          if (match) {
            const originalMatch = originalProps.find(
              (o) => o.name === prop.name,
            );
            return {
              ...prop,
              originalVal: originalMatch ? originalMatch.val : undefined,
              isEdited: true,
            };
          }
          return prop;
        });

        const mergedTechs = techs.map((param) => {
          const match = editedTechs.find((e) => e.name === param.name);
          if (match) {
            const originalMatch = originalTechs.find(
              (o) => o.name === param.name,
            );
            return {
              ...param,
              originalVal: originalMatch ? originalMatch.val : undefined,
              isEdited: true,
            };
          }
          return param;
        });

        return {
          ...rev,
          properties: mergedProps,
          TechnicalParameters: mergedTechs,
        };
      }),
    };
  });
}

export async function engineeringChangePendingRevision(ECObj) {
  const ctx = IafProj.getCurrent();
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const cleaned = cleanForApi(ECObj);

    const siteEqurl = {
    url: `${baseOmapiUrl}/siteequip/pendingrevision`,
    body: cleaned,
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

    if (!response.ok) {
      return {
        success: false,
        message: `Request failed with status ${response.status} ${response.statusText}`,
      };
    }

    const result = await response.json();

    if (result?._result?.status === 200) {
      return {
        success: true,
        message: 'Engineering change pending revision created successfully',
        data: result._result,
      };
    } else {
      return {
        success: false,
        message: result?._result?.message || 'Unexpected response from API',
        data: result,
      };
    }
  } catch (err) {
    return {
      success: false,
      message: err.message,
    };
  }
}

export async function rejectPendingRevision(
  facilityId,
  buildingId,
  equipmentId,
  revisionId,
) {
  const ctx = IafProj.getCurrent(); // don’t forget ctx
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
        result: result._result,
      };
    }

    return {
      success: false,
      message: result?._result?.message || "Unknown error",
      result: result._result,
    };
  } catch (err) {
    return {
      success: false,
      message: err.message,
    };
  }
}

export async function approvePendingRevision(
  revision,
  facilityId,
  buildingId,
  equipmentId,
  username,
) {
  const ctx = IafProj.getCurrent(); // don’t forget ctx
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`;

  const siteEqUrl = {
    url: `${baseOmapiUrl}/siteequip/approvedrevision`,
    body: {
      revision: revision,
      facility: facilityId,
      unit: buildingId,
      siteEquipmentId: equipmentId,
      username: username,
    },
  };

  try {
    const response = await fetch(siteEqUrl.url, {
      method: "POST",
      mode: "cors",
      headers: {
        Authorization: "Bearer " + IafSession.getAuthToken(ctx),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(siteEqUrl.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Approve failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    return { success: true, result };
  } catch (err) {
    console.error("approvePendingRevision error:", err);
    return { success: false, message: err.message };
  }
}

export async function ecLogsForSiteEquipment( facilityId, buildingId, siteEquipmentIds) {
  const ctx = IafProj.getCurrent();
  const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx._namespaces[0]}`

  const url = `${baseOmapiUrl}/siteequip/facilities/${facilityId}/units/${buildingId}/equipments/ecs?ids=${siteEquipmentIds}&openEcs=true`;

  let getResults = []

   try {
    let response = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: {
        Authorization: "Bearer " + IafSession.getAuthToken(ctx),
        "Content-Type": "application/json",
      }
    });

    if (response.ok) {
      let result = await response.json();
      if (result._result.status === 200) {
        getResults.push(result._result.siteEquipsWithEcs)
      } else {
        getResults.push({
          url,
          message: `ERROR: OMAPI ${url} call returned status other than 200`,
        });
      }
    } else {
      getResults.push({
        url,
        message: `ERROR: OMAPI ${url} call failed`,
      });
    }
  } catch(err) {
    console.log(err)
  }

let finalDataResult = {
  successLogs: [],
  rejectedSEIds: []
}
 getResults[0]?.map((res, idx) => {
  if(_.isEmpty(res.ecsWithLogs)) {
    finalDataResult.rejectedSEIds.push(res['Site Equipment Id'])
  } else {
    finalDataResult.successLogs.push(res.ecsWithLogs.at(-1).logs._list.at(-1))
  }
 })
 console.log('ecLogsForSiteEquipment - finalDataResult ->', finalDataResult)
  return finalDataResult
}