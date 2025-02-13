import React, { useState, useContext } from 'react'

import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

import { ConfigContext } from '../projectMakerView'

import './ProjectCreate.scss'

const ProjectCreate = ({onCreate}) => {

   const { projectCreateScript } = useContext(ConfigContext)

   const [ creating, setCreating ] = useState(false)
   const [ createProgress, setCreateProgress ] = useState([])
   const [ progressError, setProgressError ] = useState()

   const [ newProjectName, setNewProjectName ] = useState('')

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

         let result = await ScriptHelper.executeScript(projectCreateScript, {
            projName: newProjectName
         }, null, null, handleProgress)

         handleProgress(result)
         setNewProjectName('')

      } catch (error) {

         handleProgress('ERROR')
         setProgressError(error)

      }

      setCreating(false)
      if (onCreate) onCreate()

   }

   const handleProgress = (update) => {

      setCreateProgress(prevProg => [...prevProg, update])

   }

   return <div className='projectmake-admin'>
      <div className='projectmake-input'>
         <input type='text' 
            value={newProjectName}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder='New Project Name' 
            disabled={!projectCreateScript || creating}>
         </input>
         {projectCreateScript && !creating && <div className='create-btn' onClick={createProject}>Create Project</div>}
         {creating && <div className='create-btn-disabled'><i className="fas fa-spinner fa-spin"></i></div>}
         {!projectCreateScript && <div className='config-script-missing-warning'>Project Creation Script configuration is missing.</div>}
      </div>
      {progressError && <div className='create-error'>
         <i className="fas fa-exclamation-triangle"></i> {progressError}
      </div>}
      {!!createProgress.length && <ul>
         {createProgress.map((txt, i) => <li key={i}>{txt}</li>)}
      </ul>}
   </div>

}

export default ProjectCreate