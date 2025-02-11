import React, { useState, useEffect, useContext } from 'react'
import { Tooltip } from "@material-ui/core"

import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

import { ConfigContext } from '../projectMakerView'

import './ProjectUpdater.scss'

const ProjectUpdater = ({isOutOfDate, project, version, onUpdateStart, onUpdateProgress, onUpdateComplete, disabled}) => {

   const { projectUpdateScript } = useContext(ConfigContext)

   const [ isUpdating, setIsUpdating ] = useState(false)

   const doUpdate = async () => {

      setIsUpdating(true)
      if (onUpdateStart) onUpdateStart(project)
      if (onUpdateProgress) onUpdateProgress('Starting Project Update')
      
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