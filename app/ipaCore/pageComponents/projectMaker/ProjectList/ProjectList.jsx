import React, { useState, useEffect } from 'react'

import * as semver from 'semver'

import ProjectUpdater from './ProjectUpdater'

import './ProjectList.scss'

const DEFAULT_VERSION = '1.2.0'

const ProjectList = ({currentVer, projects, onUpdate}) => {

   const [ updatingProject, setUpdatingProject ] = useState()
   const [ updateLog, setUpdateLog ] = useState([])
   const [ showClose, setShowClose ] = useState(false)

   const getProjectVer = (p) => {
      return p._userAttributes?.projectMaker?.currentVersion ? p._userAttributes.projectMaker.currentVersion : DEFAULT_VERSION
   }

   const getProjectOriginalVer = (p) => {
      return p._userAttributes?.projectMaker?.originalVersion ? p._userAttributes.projectMaker.originalVersion : DEFAULT_VERSION
   }

   const isOutOfDate = (project) => {
      let projVersion = getProjectVer(project)
      // TO DO: REMOVE THIS BAD CHECK FOR TESTING
      return semver.lt(projVersion, currentVer)
   }

   const updateTheLog = (update) => {
      setUpdateLog(prevLogs => [...prevLogs, update])
   }

   const handleUpdateComplete = () => {
      setShowClose(true)
      if(onUpdate) onUpdate()
   }

   const handleListClose = () => {
      setUpdatingProject(null)
      setShowClose(false)
      setUpdateLog([])
   }

   return <div className='project-list'>
      <div className='current-version'>Current Project Maker Version: {currentVer}</div>
      <table>
         <thead>
            <tr>
               <th className='first-col center'></th>
               <th className='center'>Status</th>
               <th>Project</th>
               <th className='center'>Current Version</th>
               <th className='center'>Original Version</th>
            </tr>
         </thead>
         <tbody>
            {projects.map(p => <>
               <tr key={p._id}>
                  <td className='first-col center'>
                     <ProjectUpdater 
                        project={p}
                        version={getProjectVer(p)}
                        isOutOfDate={isOutOfDate(p)}
                        disabled={!!updatingProject && updatingProject._id !== p._id} 
                        onUpdateStart={setUpdatingProject}
                        onUpdateProgress={updateTheLog}
                        onUpdateComplete={handleUpdateComplete}
                     />
                  </td>
                  <td className='center'>
                     {isOutOfDate(p) ? 'Out of Date' : 'Up to Date'}
                  </td>
                  <td>{p._name}</td>
                  <td className='center'>{getProjectVer(p)}</td>
                  <td className='center'>{getProjectOriginalVer(p)}</td>
               </tr>
               {updatingProject?._id === p._id && <tr className='project-update-row'>
                  <td >{showClose && <i class="fas fa-times-circle" onClick={handleListClose}></i>}</td>
                  <td colspan='4'><ul className='update-log'>
                     {updateLog.map(u => <li>{u}</li>)}
                  </ul></td>
               </tr>}
            </>)}
         </tbody>
      </table>
   </div>
}

export default ProjectList