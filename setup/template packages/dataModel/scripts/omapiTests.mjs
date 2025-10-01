let scriptModule = {
   getRunnableScripts() {

      return [
         // {name: 'Run Status API Tests', script: 'testStatusAPIs'}, // Endpoint doesn't yet return anything
         {name: 'Run Site API Tests', script: 'testSiteAPIs'},
         {name: 'Run Building API Tests', script: 'testBuildingAPIs'},
         {name: 'Run Reference Equipment API Tests', script: 'testReferenceEquipmentAPIs'},
         {name: 'Run Site Equipment API Tests', script: 'testSiteEquipmentAPIs'},
         {name: 'Run Edit Site Equipment Validation API Tests', script: 'testEditSiteEquipmentAPIs'},
         {name: 'Run Engineering Changes API Tests', script: 'testEngineeringChangesAPIs'}
      ]

   },
	async testStatusAPIs(input, libraries, ctx, callback) {
      // test omapi endpoints

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let getUrls = [
         `${baseOmapiUrl}/status`
      ]

      let postUrls = []

      let testResults = []

      try {
         
         for ( const testUrl of getUrls) {

            let response = await fetch(testUrl, {
               method: 'GET',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
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
                  testResults.push({testUrl, message: `SUCCESS: OMAPI ${testUrl} call returned status other than 200`}, result)
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
                  Authorization: 'Bearer ' + ctx.authToken,
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

      return testResults

	},
	async testSiteAPIs(input, libraries, ctx, callback) {
      // test omapi endpoints

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let getUrls = [
         `${baseOmapiUrl}/site/all`
      ]

      let postUrls = []

      let testResults = []

      try {
         
         for ( const testUrl of getUrls) {

            let response = await fetch(testUrl, {
               method: 'GET',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
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
                  testResults.push({testUrl, message: `SUCCESS: OMAPI ${testUrl} call returned status other than 200`}, result)
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
                  Authorization: 'Bearer ' + ctx.authToken,
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

      return testResults

	},
	async testBuildingAPIs(input, libraries, ctx, callback) {
      // test omapi endpoints

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let getUrls = [
         `${baseOmapiUrl}/building/all`
      ]

      let postUrls = []

      let testResults = []

      try {
         
         for ( const testUrl of getUrls) {

            let response = await fetch(testUrl, {
               method: 'GET',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
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
                  testResults.push({testUrl, message: `SUCCESS: OMAPI ${testUrl} call returned status other than 200`}, result)
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
                  Authorization: 'Bearer ' + ctx.authToken,
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

      return testResults

	},
	async testReferenceEquipmentAPIs(input, libraries, ctx, callback) {
      // test omapi endpoints

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let getUrls = [
         `${baseOmapiUrl}/references`,
         `${baseOmapiUrl}/references/unittypes`,
         `${baseOmapiUrl}/references/unittypes/900 MW/systems`,
         `${baseOmapiUrl}/references/unittypes/900 MW/systems/RCS/equipmenttypes`,
         `${baseOmapiUrl}/references/unittypes/${encodeURIComponent("900 MW")}/systems/RCS/equipmenttypes/Pump/equipment`
      ]

      let postUrls = [
         { url: `${baseOmapiUrl}/references/search`, body: { unitType: '900 MW' } },
         { url: `${baseOmapiUrl}/references/search`, body: { systemId: 'TS' } },
         { url: `${baseOmapiUrl}/references/search`, body: { equipmentId: 'SG-900-001', equipmentType: "Heat Exchanger" } }
      ]

      let testResults = []

      try {
         
         for ( const testUrl of getUrls) {

            let response = await fetch(testUrl, {
               method: 'GET',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
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
                  Authorization: 'Bearer ' + ctx.authToken,
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

      return testResults

	},
   async testSiteEquipmentAPIs(input, libraries, ctx, callback) {

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let getUrls = [
         `${baseOmapiUrl}/siteequip/facilities`,
         `${baseOmapiUrl}/siteequip/facilities/A/units`,
         `${baseOmapiUrl}/siteequip/facilities/B/units/02/systems`,
         `${baseOmapiUrl}/siteequip/facilities/B/units/02/systems/RCS/equipmenttypes`,
         `${baseOmapiUrl}/siteequip/facilities/B/units/02/systems/RCS/equipmenttypes/Pump/equipment`
      ]

      let postUrls = [
         { url: `${baseOmapiUrl}/siteequip/search?_pageSize=5&_offset=2`, body: { facility: 'B', unit: '01' } },
         { url: `${baseOmapiUrl}/siteequip/search`, body: { facility: 'B', unit: '01', systemId: 'TS' } },
         { url: `${baseOmapiUrl}/siteequip/search`, body: { facility: 'B', unit: '01', equipmentId: 'SG-900-001', equipmentType: "Heat Exchanger" } },
      ]

      let testResults = []

      try {

         for ( const testUrl of getUrls) {

            let response = await fetch(testUrl, {
               method: 'GET',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
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
                  Authorization: 'Bearer ' + ctx.authToken,
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
      
      return testResults

   },

   async testEditSiteEquipmentAPIs(input, libraries, ctx, callback) {

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let postUrls = [
         { description: 'Checks if site equipment exists in ECs', expectedStatus: 400, expectedMessage: 'Engineering Change for NON_EXISTENT_SE not found', url: `${baseOmapiUrl}/siteequip/pendingrevision`, body: { facility: 'A', unit: '01', equipmentId: 'RCP-900-013', siteEquipmentId: 'NON_EXISTENT_SE', properties: {}, TechnicalParameters: {}, username: 'Bob' } },
         { description: 'Site equipment RCP-A-021 cannot be incremented any further revision based on current ECs', expectedStatus: 400, expectedMessage: 'No current Engineering Change instructs RCP-A-021 revision to increment any further', url: `${baseOmapiUrl}/siteequip/pendingrevision`, body: { facility: 'A', unit: '02', equipmentId: 'RCP-900-011', siteEquipmentId: 'RCP-A-021', properties: {}, TechnicalParameters: {}, username: 'Bob' } },
      ]

      let deleteUrls = [
         { description: 'Only intermediate revisions e.g XXXA can be deleted', expectedStatus: 400, expectedMessage: 'Not an intermediate revision number',  url: `${baseOmapiUrl}/siteequip/facilities/A/units/02/siteequipment/RCP-B-022/revisions/010/pendingrevision` },
      ]

      let testResults = []

      try {
         for ( const testUrl of postUrls) {

            let response = await fetch(testUrl.url, {
               method: 'POST',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(testUrl.body)
            })

            if (response.ok) {
               let result = await response.json()
               if (result._result.status == testUrl.expectedStatus && result._result.message == testUrl.expectedMessage) {
                  testResults.push({testUrl, message: `SUCCESS: OMAPI ${testUrl.url} call returned expected status code: ${testUrl.expectedStatus}`, result})
                  console.log(result)
               } else if (result._result.status === 200) {
                  console.log(testUrl)
                  console.log(result)
                  testResults.push({testUrl, result})
               } else {
                  testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl.url} call returned status other than 200`, result})
                   console.log(result)
               }
            } else {
               testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl.url} call failed`})
               console.log(response)
            }

         }

         for ( const testUrl of deleteUrls) {

            let response = await fetch(testUrl.url, {
               method: 'DELETE',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(testUrl.body)
            })

            if (response.ok) {
               let result = await response.json()
               if (result._result.status == testUrl.expectedStatus && result._result.message == testUrl.expectedMessage) {
                  testResults.push({testUrl, message: `SUCCESS: OMAPI ${testUrl.url} call returned expected status code: ${testUrl.expectedStatus}`, result})
                  console.log(result)
               } else if (result._result.status === 200) {
                  console.log(testUrl)
                  console.log(result)
                  testResults.push({testUrl, result})
               } else {
                  testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl.url} call returned status other than 200`, result})
                   console.log(result)
               }
            } else {
               testResults.push({testUrl, message: `ERROR: OMAPI ${testUrl.url} call failed`})
               console.log(response)
            }

         }

      } catch (error) {
         testResults.push({message: `ERROR: OMAPI failed`})
         console.log('omapi error', error, ctx)
      }
      
      return testResults

   },

   async testEngineeringChangesAPIs(input, libraries, ctx, callback) {

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let getUrls = [
         `${baseOmapiUrl}/engineeringchanges`,
         `${baseOmapiUrl}/engineeringchanges/001`,
         `${baseOmapiUrl}/engineeringchanges/001/logs?pageSize=5`,
         // fetches all site equipment and revisions and reference equipment revisions and referenece equipment for an EC
         `${baseOmapiUrl}/engineeringchanges/001/equipment`,
         // same as above but filtered to a facility
         `${baseOmapiUrl}/engineeringchanges/001/equipment?facility=A`,
         // same as above but filtered to a specific unit at a facility
         `${baseOmapiUrl}/engineeringchanges/001/equipment?facility=A&unit=02`,
         // same as above but producing a comparison between the tip site equipment and the cs reference revision
         `${baseOmapiUrl}/engineeringchanges/001/equipment?facility=B&compare=true`,
         `${baseOmapiUrl}/engineeringchanges/001/equipment?facility=A&unit=02&compare=true`
      ]

      let postUrls = []

      let testResults = []

      try {

         for ( const testUrl of getUrls) {

            let response = await fetch(testUrl, {
               method: 'GET',
               mode: 'cors',
               headers: {
                  Authorization: 'Bearer ' + ctx.authToken,
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
                  Authorization: 'Bearer ' + ctx.authToken,
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
      
      return testResults

   }
}

export default scriptModule
