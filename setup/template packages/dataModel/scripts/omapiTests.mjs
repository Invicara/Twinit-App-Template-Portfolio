let scriptModule = {
   getRunnableScripts() {

      return [
         {name: 'Run Reference Equipment API Tests', script: 'testReferenceEquipmentAPIs'}
      ]

   },
	async testReferenceEquipmentAPIs(input, libraries, ctx, callback) {
   // test omapi endpoints

   const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

   let testResults = []

   try {
      // test status endpoint
      let url = `${baseOmapiUrl}/references`
      console.log(url)

      let response = await fetch(url, {
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
            console.log(result)
            testResults.push({url, result})
         } else {
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response)
      }

      // get reference unit types
      url = `${baseOmapiUrl}/references/unittypes`
      console.log(url)

      response = await fetch(url, {
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
            console.log(result)
            testResults.push({url, result})
         } else {
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response)
      }

      // get reference unit types systems
      url = `${baseOmapiUrl}/references/unittypes/900 MW/systems`
      console.log(url)

      response = await fetch(url, {
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
            testResults.push({url, result})
         } else {
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response)
      }

      // get reference unit types systems equipment types
      url = `${baseOmapiUrl}/references/unittypes/900 MW/systems/RCS/equipmenttypes`
      console.log(url)

      response = await fetch(url, {
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
            console.log(result)
            testResults.push({url, result})
         } else {
            console.log(response, result._result)
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response)
      }

      // get reference unit types systems equipment types equipment
      url = `${baseOmapiUrl}/references/unittypes/${encodeURIComponent("900 MW")}/systems/RCS/equipmenttypes/Pump/equipment`

      response = await fetch(url, {
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
            console.log(`${url}`, result)
            testResults.push({url, result})
         } else {
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response, response.headers)
      }

      // search 900 MW unit references
      url = `${baseOmapiUrl}/references/search`

      response = await fetch(url, {
         method: 'POST',
         mode: 'cors',
         headers: {
            Authorization: 'Bearer ' + ctx.authToken,
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            unitType: '900 MW'
         })
      })

      if (response.ok) {
         let result = await response.json()
         if (result._result.status === 200) {
            console.log(`${url}`, result)
            testResults.push({url, result})
         } else {
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response, response.headers)
      }

      // search TS systemID unit references
      url = `${baseOmapiUrl}/references/search`

      response = await fetch(url, {
         method: 'POST',
         mode: 'cors',
         headers: {
            Authorization: 'Bearer ' + ctx.authToken,
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            systemId: 'TS'
         })
      })

      if (response.ok) {
         let result = await response.json()
         if (result._result.status === 200) {
            console.log(`${url}`, result)
            testResults.push({url, result})
         } else {
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response, response.headers)
      }

      // search equipmentid and type unit references
      url = `${baseOmapiUrl}/references/search`

      response = await fetch(url, {
         method: 'POST',
         mode: 'cors',
         headers: {
            Authorization: 'Bearer ' + ctx.authToken,
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            equipmentId: 'SG-900-001',
            equipmentType: "Heat Exchanger"
         })
      })

      if (response.ok) {
         let result = await response.json()
         if (result._result.status === 200) {
            console.log(`${url}`, result)
            testResults.push({url, result})
         } else {
            testResults.push({url, message: `ERROR: OMAPI ${url} call returned status other than 200`})
         }
      } else {
         testResults.push({url, message: `ERROR: OMAPI ${url} call failed`})
         console.log(response, response.headers)
      }
   
   } catch (error) {

      testResults.push({message: `ERROR: OMAPI failed`})
      console.log('omapi error', error, ctx)

   }

   

   return testResults

	}
}

export default scriptModule
