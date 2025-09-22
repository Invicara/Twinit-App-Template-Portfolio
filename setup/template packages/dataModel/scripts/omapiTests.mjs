let scriptModule = {
	async testReferenceEquipmentAPIs(input, libraries, ctx, callback) {
   // test omapi endpoints

   const baseOmapiUrl = `https://sandbox-api.invicara.com/omapi/${ctx.project._namespaces[0]}`

   callback(`=====================================`)
   callback(`OMAPI TEST RESULTS`)

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
            callback(`INFO: OMAPI ${url} call succeeded`)
            callback(JSON.stringify(result._result, null, 3))
         } else {
            callback(`ERROR: OMAPI ${url} call returned status other than 200`)
         }
      } else {
         callback(`ERROR: OMAPI ${url} call failed`)
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
            callback(`INFO: OMAPI ${url} call succeeded`)
            callback(JSON.stringify(result._result, null, 3))
         } else {
            callback(`ERROR: OMAPI ${url} call returned status other than 200`)
         }
      } else {
         callback(`ERROR: OMAPI ${url} call failed`)
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
            console.log(result)
            callback(`INFO: OMAPI ${url} MW/systems call succeeded`)
            callback(JSON.stringify(result._result, null, 3))
         } else {
            callback(`ERROR: OMAPI ${url} call returned status other than 200`)
         }
      } else {
         callback(`ERROR: OMAPI ${url} call failed`)
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
            callback(`INFO: OMAPI ${url} call succeeded`)
            callback(JSON.stringify(result._result, null, 3))
         } else {
            console.log(response, result._result)
            callback(`ERROR: OMAPI ${url} call returned status other than 200`)
         }
      } else {
         callback(`ERROR: OMAPI ${url} call failed`)
         console.log(response)
      }

      // get reference unit types systems equipment types equipment
      url = `${baseOmapiUrl}/references/unittypes/${encodeURIComponent("900 MW")}/systems/RCS/equipmenttypes/PUMP/equipment`
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
            console.log(`${url}`, result)
            callback(`INFO: OMAPI ${url} call succeeded`)
            callback(JSON.stringify(result._result, null, 3))
         } else {
            callback(`ERROR: OMAPI ${url} call returned status other than 200`)
         }
      } else {
         callback(`ERROR: OMAPI ${url} call failed`)
         console.log(response, response.headers)
      }
   
   } catch (error) {

      callback(`ERROR: Testing OMAPI`)
      console.log('omapi error', error, ctx)

   }



	},
}

export default scriptModule
