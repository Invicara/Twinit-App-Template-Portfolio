import React, { useEffect, useState } from 'react'

import { IafItemSvc, IafDataSource } from '@dtplatform/platform-api'

import PasswordInput from '../../components/passwordInput/PasswordInput'
import { GenericMatButton } from '@invicara/ipa-core/modules/IpaControls'

import './MapboxSettingsView.scss'

// MapBoxSettingsView provides status of the necessary configurations to enable Mapbox features
// in the IafViewer, and allows for inputing a Mapbox secret key to be used to create temporary
// Mpabox access tokens when a user intercts with the IafViewer
const MapBoxSettingsView = () => {

   // the secrets collection storing the encrypted Mapbox secret key
   const [ secretsColl, setSecretsColl ] = useState()
   // whether or not an existing secre key exists - does not store the actual key
   const [ authKey, setAuthKey ] = useState()

   // whether or not the auth script needed to generate Mapbox keys exists
   const [ authScript, setAuthScript ] = useState()
   // whether or not the Auth Orchestrator that generates temporary Mapbox tokens exists
   const [ authOrch, setAuthOrch ] = useState()
   
   // the Mapbox user name to use with a new secret key
   const [ username, setUsername ] = useState('')
   // the new Mapbox secret key
   const [ secret, setSecret ] = useState('')

   useEffect(() => {
      checkReadiness()
   }, [])

   // checks the readiss of the project for supporting Mapbox
   const checkReadiness = () => {

      setUsername('')
      setSecret('')
      
      IafItemSvc.getNamedUserItems({ query: { _userType: 'mapbox', _kind: 'script'}}).then((res) => {
         if (res._total > 0) {
            setAuthScript(true)
         }
      }).catch((error) => {
         setAuthScript(false)
         console.error('ERROR: Fetching Mapbox Authenticaton Script')
         console.error(error)
      })

      IafItemSvc.getNamedUserItems({ query: { _userType: 'secrets', _kind: 'collection'}}).then((res) => {
         if (res._total > 0) {

            let secretColl = res._list[0]

            setSecretsColl(secretColl)

            IafItemSvc.getRelatedItems(secretColl._userItemId, { type: 'mapbox-secret' }, null, {page: { _pageSize: 0 }}).then((res) => {
               
               console.log(res)
               if (res._total > 0) {
                  setAuthKey(true)
               }
            }).catch((error) => {
               setAuthKey(false)
               console.error('ERROR: Fetching Mapbox Secret Key')
               console.error(error)
            })
            
         }
      }).catch((error) => {
         setSecretsColl(false)
         console.error('ERROR: Fetching Secrets Collections')
         console.error(error)
      })

      IafDataSource.getOrchestrators({_userType: 'mapbox_temp_token'}).then((res) => {
         if (res._list.find(orch => orch._userType === 'mapbox_temp_token')) {
            setAuthOrch(true)
         }
      }).catch((error) => {
         setAuthOrch(false)
         console.error('ERROR: Fetching Mapbox Auth Orchestrator')
         console.error(error)
      })

   }

   // the user can use Mapbox and create if this is true
   const isReady = () => {
      return authScript && authOrch && secretsColl
   }

   // manages the item with the Mapbox secret key in the encrypted secrets collection
   // if no secret item exists it will create a new one
   // if there is an existing item it will update the existing item with a new user name and secret key
   // the created item is:
   // {
   //    type: "mapbox-secret",
   //    username: <the Mapbox user name input the user>
   //    .secret: <the Mapbox secret key stored in an encrypted field>
   // }
   const handleKey = () => {

      if (authKey) {
         // get the existing key
         IafItemSvc.getRelatedItems(secretsColl._userItemId, { type: 'mapbox-secret'}, null).then((res) => {
            if (res._total > 0) {
               
               // update username and secret
               let existingSecret = res._list[0]
               existingSecret.username = username
               existingSecret['.secret'] = secret // the dot in the key name means the value will be encrypted

               // update in secrets collection
               IafItemSvc.updateRelatedItem(secretsColl._userItemId, existingSecret._id, existingSecret).catch((error) => {
                  console.error('ERROR: Updating Existing Mapbox Secret Item')
                  console.error(error)
               }).finally(() => {
                  checkReadiness()
               })

            }
         }).catch((error) => {
            console.error('ERROR: Fetching Exsting Mapbox Secret Item')
            console.error(error)
         })
      } else {

         let newSecret = {
            type: 'mapbox-secret',
            ".secret": secret,
            username
         }

         // create new secrets item
         IafItemSvc.createRelatedItems(secretsColl._userItemId, [newSecret]).catch((error) => {
            console.error('ERROR: Creating New Mapbox Secret Item')
            console.error(error)
         }).finally(() => {
            checkReadiness()
         })
      }

      

   }

   return <div className='mapbox-settings-page'>
      <div className='mapbox-checklist'>

         <div className='check-list'>
            <div className='check-list-label'>Mapbox Readiness Checklist</div>
            <table>
               <tr>
                  <td>
                     {!authScript && <i className='far fa-circle'></i>}
                     {authScript && <i className='fas fa-check-circle'></i>}
                  </td>
                  <td>Mapbox Authentication Script</td>
               </tr>
               <tr>
                  <td>
                     {!authOrch && <i className='far fa-circle'></i>}
                     {authOrch && <i className='fas fa-check-circle'></i>}
                  </td>
                  <td>Mapbox Authentication Orchestrator</td>
               </tr>
               <tr>
                  <td>
                     {!secretsColl && <i className='far fa-circle'></i>}
                     {secretsColl && <i className='fas fa-check-circle'></i>}
                  </td>
                  <td>Mapbox Secrets Store</td>
               </tr>
               <tr>
                  <td>
                     {!authKey && <i className='far fa-circle'></i>}
                     {authKey && <i className='fas fa-check-circle'></i>}
                  </td>
                  <td>Mapbox Secret Token</td>
               </tr>
            </table>
         </div>
  
      </div>
      <div className='mapbox-form'>
         <div className='form-container'>

            {!isReady() && <div className='not-ready-warning'>
               <span><span className='highlight'>Warning</span>: One or more required configurations for Mapbox is missing. Please make sure your project has been migrated to the latest release.</span>
            </div>}
            {secretsColl && <div className='form-ctrls'>
               <div className='form-header'>Enter your Mapbox User Name and Secret Token to Create a New Mapbox Secret Token or Replace an Existing Mapbox Secret Token</div>
               <hr/>
               <div className='input-label'>Enter User Name</div>
               <input type='text' value={username} onChange={(e) => setUsername(e.target.value)}></input>
               <div className='input-label'>Enter Secret Key</div>
               <PasswordInput value={secret} onChange={setSecret} />
               <GenericMatButton
                  className='token-button'
                  styles={{ alignSelf: 'right', marginTop: '20px', marginRight: '15px', width: '200px' }}
                  disabled={!secretsColl || !username?.length || !secret?.length}
                  onClick={handleKey}
               >
                  {authKey ? 'Replace Token' : 'Create Token'}
                </GenericMatButton>
            </div>}
            
         </div>
      </div>
   </div>

}

export default MapBoxSettingsView