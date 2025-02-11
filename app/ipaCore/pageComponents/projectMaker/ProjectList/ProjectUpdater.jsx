import React, { useState, useEffect,useContext } from 'react'

import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

import { ConfigContext } from '../projectMakerView'

import './ProjectUpdater.scss'

const ProjectUpdater = ({project}) => {

   const config = useContext(ConfigContext)

   return <div className='project-updater'>Update</div>

}

export default ProjectUpdater