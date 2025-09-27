

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
         `${baseOmapiUrl}/engineeringchanges/001/logs?pageSize=20`
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

      console.log('EC5 testresults', testResults);
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