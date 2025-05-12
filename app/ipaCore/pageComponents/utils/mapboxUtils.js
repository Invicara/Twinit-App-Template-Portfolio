// UTILITIES FOR USE WITH MAPBOX INTEGRATION

import { IafDataSource } from '@dtplatform/platform-api'

// fetches a new temporary access token for the IafViewer
export async function getTemporaryMapBoxToken() {

   let token = null

   // get the orchstrator for creating temporary mapbox tokens
   IafDataSource.getOrchestrators({_userType: 'mapbox_temp_token'}).then((res) => {
      let tokenOrch = res._list.find(orch => orch._userType === 'mapbox_temp_token')

      if (tokenOrch) {

         IafDataSource.runOrchestrator(tokenOrch.id, {
            orchestratorId: tokenOrch.id
         }).then((result) => {
            console.log('mapbox----->', result)
         }).catch((error) => {
            console.error("ERROR: runnign mapbox orchestrator")
            console.error(error)
         })
         
      } else {

         return token

      }
   })

}