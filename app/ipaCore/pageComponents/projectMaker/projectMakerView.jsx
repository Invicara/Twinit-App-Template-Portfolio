import React, { useState, useEffect } from 'react'

import { IafProj, IafApplication } from '@dtplatform/platform-api'
import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

import './projectMakerView.scss'

const ProjectMakerView = (props) => {

   const [ checkingAdmin, setCheckingAdmin ] = useState(true)
   const [ isAdmin, setIsAdmin ] = useState(false)

   const [ newProjectName, setNewProjectName ] = useState('')

   const [ creating, setCreating ] = useState(false)
   const [ createProgress, setCreateProgress ] = useState([])
   const [ progressError, setProgressError ] = useState()

   useEffect(() => {
      checkAppAdmin()
   }, [])

   const checkAppAdmin = async () => {

      let project = await IafProj.getCurrent()
      console.log('project', project)

      // just make sure this doesnt fly by in the UI confusing users
      setTimeout(() => {
         IafApplication.getAppAdminsUserGroup(project).then((ug) => {
            
            setCheckingAdmin(false)
            if (ug) {
               setIsAdmin(true)
            }
            
         })
      }, 2000)

   }

   const handleChange = (type, value) => {
      if (type === 'name') {
         setNewProjectName(value)
      }
   }

   const createProject = async () => {

      setCreating(true)
      setCreateProgress([])
      setProgressError(null)

      try {

         let result = await ScriptHelper.executeScript(props.handler.config.projectCreateScript, {
            projName: newProjectName
         }, null, null, handleProgress)

         handleProgress(result)
         setNewProjectName('')

      } catch (error) {

         handleProgress('ERROR')
         setProgressError(error)

      }

      setCreating(false)

   }

   const handleProgress = (update) => {

      setCreateProgress(prevProg => [...prevProg, update])

   }

   return <div className='projectmake-page'>
      {checkingAdmin && <div className='checking-admin-notice'>
         <i className="fas fa-spinner fa-spin"></i> Checking Admin User Status
      </div>}
      {!checkingAdmin && !isAdmin && <div className='checking-admin-notice checking-admin-fail'>
         <i className="fas fa-exclamation-triangle"></i> You are not an Admin!
      </div>}
      {!checkingAdmin && isAdmin && <div className='projectmake-admin'>
         <input type='text' value={newProjectName} onChange={(e) => handleChange('name', e.target.value)} placeholder='New Project Name'></input>
         {!creating && <div className='create-btn' onClick={createProject}>Create Project</div>}
         {creating && <div className='create-btn-disabled'><i className="fas fa-spinner fa-spin"></i></div>}
      </div>}
      {progressError && <div className='create-error'>
         <i className="fas fa-exclamation-triangle"></i> {progressError}
      </div>}
      {!!createProgress.length && <ul>
         {createProgress.map((txt, i) => <li key={i}>{txt}</li>)}
      </ul>}
   </div>
}

export default ProjectMakerView