import React, { useState, useEffect, useContext } from 'react'
import { Tooltip } from "@material-ui/core"

import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

import { ConfigContext } from '../projectMakerView'

import './ProjectUpdater.scss'

/*
 * The ProjectUpdater component handles displaying the current state of the project, as well as updating
 * the project to the latest Project Maker version. Updates are done by running a script configured in the
 * pageComponents handler.config.projectUpdateScript property.
 * 
 * The component renders tslf in one of 5 different modes:
 * - Project is out of date => a 'play' icon
 * - Project Update Script is missing => a circle with an X
 * - Project is up to date => a green circle
 * - Project is updating => a spinner
 * - Update is disabled => a gray 'play' icon
*/
const ProjectUpdater = ({
      isOutOfDate,         // whether the project is out of date
      project,             // the project for which the component is responsible
      version,             // the current version of the project
      onUpdateStart,       // a callback to the parent for when an update is started
      onUpdateProgress,    // a callback to the parent for when update progress has been received
      onUpdateComplete,    // a callback to the parent for when an update is complete
      disabled             // if the this component should display as disabled
   }) => {

   // the script used to update existing projects from the handler.config
   // provided by the ConfigContext 
   const { projectUpdateScript } = useContext(ConfigContext)

   // whether or not the component is currently updating the project
   const [ isUpdating, setIsUpdating ] = useState(false)

   // update a project
   const doUpdate = async () => {

      setIsUpdating(true)
      if (onUpdateStart) onUpdateStart(project)
      if (onUpdateProgress) onUpdateProgress('Starting Project Update')
      
      // run the configured script to update the project
      // pass any progress updates to the onUpdateProgress callback
      try {
         let result = await ScriptHelper.executeScript(projectUpdateScript, {
            project,
            version
         }, null, null, onUpdateProgress)
         if (onUpdateProgress) onUpdateProgress(result)
      } catch (error) {
         console.log(error)
         if (onUpdateProgress) onUpdateProgress('ERROR during update!')
      }

      
      if (onUpdateComplete) onUpdateComplete(project)
      setIsUpdating(false)

   }


   return <div className='project-updater'>

      {isOutOfDate && !isUpdating && !disabled && projectUpdateScript && projectUpdateScript.length && <Tooltip title='Update Project Now'>
         <i className="far fa-play-circle fa-2x" onClick={doUpdate}></i>
      </Tooltip>}

      {isOutOfDate && !isUpdating && !disabled && (!projectUpdateScript || !projectUpdateScript.length) && <Tooltip title='Project Update Script Missing'>
         <i className="far fa-times-circle fa-2x"></i>
      </Tooltip>}

      {!isOutOfDate && !isUpdating && !disabled && <Tooltip title='Project Up to Date'>
         <i className="fas fa-circle fa-2x"></i>
      </Tooltip>}

      {disabled && <Tooltip title='Disabled during Update'>
         <i className="far fa-play-circle fa-2x disabled"></i>
      </Tooltip>}

      {isUpdating && <Tooltip title='Updating...'>
         <i className="fas fa-spinner fa-spin fa-2x"></i>
      </Tooltip>}

   </div>
}

export default ProjectUpdater