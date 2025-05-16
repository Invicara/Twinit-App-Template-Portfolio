// UTILITIES FOR USE WITH MAPBOX INTEGRATION

import { IafDataSource } from '@dtplatform/platform-api'

const SESSION_TOKEN_KEY = 'mapboxToken'

export async function getTemporaryMapBoxToken() {

   let tokenInfo = _getTokenFromSession()

   if (tokenInfo && _checkTokenIsValid(tokenInfo)) {
      return tokenInfo.token
   } else {
      _removeSessionToken()
      return _fetchTemporaryMapBoxToken()
   }

}

// fetches a new temporary access token for the IafViewer
async function _fetchTemporaryMapBoxToken() {

   let token = null

   // get the orchstrator for creating temporary mapbox tokens
   let res = await IafDataSource.getOrchestrators({_userType: 'mapbox_temp_token'})
   let tokenOrch = res._list.find(orch => orch._userType === 'mapbox_temp_token')

   if (tokenOrch) {

         let orchResult = await IafDataSource.runOrchestrator(tokenOrch.id, {
            orchestratorId: tokenOrch.id
         })
         
         if (orchResult._result.success) {
            token =  orchResult._result.token

            _saveTokenToSession(orchResult._result)
         } else {
            console.error("ERROR: running mapbox orchestrator")
            console.error(error)
         }
      
   }

   return token
}

export function clearMapboxTokenFromSession() {

   _removeSessionToken()
}

function _saveTokenToSession(tokenInfo) {

   const { token, expires, ...rest} = tokenInfo

   sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify({token, expires}))

}

function _getTokenFromSession() {

   if (sessionStorage.getItem(SESSION_TOKEN_KEY)) {
      return JSON.parse(sessionStorage.getItem(SESSION_TOKEN_KEY))
   } else {
      return null
   }

}

function _removeSessionToken() {

   sessionStorage.removeItem(SESSION_TOKEN_KEY)

}

function _checkTokenIsValid(tokenInfo) {

   const now = new Date()
   const expiresAt = new Date(tokenInfo.expires)

   console.log(tokenInfo, now.getTime() < expiresAt.getTime(), now.toISOString(), expiresAt.toISOString())
   return now.getTime() < expiresAt.getTime()

}