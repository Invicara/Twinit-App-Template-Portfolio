let scriptModule = {
   getRunnableScripts() {

      return [
         // {name: 'Run Status API Tests', script: 'testStatusAPIs'}, // Endpoint doesn't yet return anything
         {name: 'Run Site API Tests', script: 'testSiteAPIs'},
         {name: 'Run Building API Tests', script: 'testBuildingAPIs'},
         {name: 'Run Reference Equipment API Tests', script: 'testReferenceEquipmentAPIs'},
         {name: 'Run Site Equipment API Tests', script: 'testSiteEquipmentAPIs'},
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

   async testEngineeringChangesAPIs(input, libraries, ctx, callback) {

      const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

      let getUrls = [
         `${baseOmapiUrl}/engineeringchanges`,
         `${baseOmapiUrl}/engineeringchanges/001`,
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
