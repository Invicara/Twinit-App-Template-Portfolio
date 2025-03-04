import React, { useState, useContext } from 'react'

import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

import { ConfigContext } from '../projectMakerView'

import './ProjectCreate.scss'

const ProjectCreate = ({
      onCreate // a call back for when a nw project is finished being created
   }) => {

   // the script used to create new projects from the handler.config
   // provided by the ConfigContext
   const { projectCreateScript } = useContext(ConfigContext)

   // if currently creating a new project
   const [ creating, setCreating ] = useState(false)

   // array of progress messages returned from projectCreateScript
   // during project creation
   const [ createProgress, setCreateProgress ] = useState([])

   // an error strng returned from projectCreateScript
   // if an error was encountered while creating a new project
   const [ progressError, setProgressError ] = useState()

   // currently input new project name in user interface
   const [ newProjectName, setNewProjectName ] = useState('')

   // update newProjectName as the user types in the input field
   const handleChange = (type, value) => {
      if (type === 'name') {
         setNewProjectName(value)
      }
   }

   // create a new project
   const createProject = async () => {

      setCreating(true)
      setCreateProgress([])
      setProgressError(null)

      try {

         // run the script to create a new project passing the new project name for
         // both the new project's name and description
         let result = await ScriptHelper.executeScript(projectCreateScript, {
            projName: newProjectName,
            projDesc: newProjectName
         }, null, null, handleProgress)

         // once the script completes add the script's final result to the progress log
         handleProgress(result)
         setNewProjectName('')

      } catch (error) {

         handleProgress('ERROR')
         setProgressError(error)

      }

      setCreating(false)

      // notify the parent page that a new project has been created
      if (onCreate) onCreate()

   }

   // as the projectCreateScript runs add any progess it returns
   // to the progress log to display in the UI
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