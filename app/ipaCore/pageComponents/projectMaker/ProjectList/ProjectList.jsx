import React, { useState, useEffect } from 'react'

import * as semver from 'semver'

// a component tha handles updating projects
import ProjectUpdater from './ProjectUpdater'

import './ProjectList.scss'

const ProjectList = ({
      user,       // the current user, currently only projects created by he current user can be migrated
                  // TO DO: Instead check that the user has access to all usergroups in each target project
      currentVer, // the current Project Maker version assigned to new projects when created
      migrateVersions, // the supported versions to migrate to currentVer
      projects,   // the list projects to which the user has access
      onUpdate    // a callback for when a project update completes
   }) => {

   // the project currently being updated
   const [ updatingProject, setUpdatingProject ] = useState()

   // an array of updates returned from the update script
   // via the ProjectUpdater component
   const [ updateLog, setUpdateLog ] = useState([])

   // whether to show the close icon on an update log
   const [ showClose, setShowClose ] = useState(false)

   // the current version of a project
   const getProjectVer = (p) => {
      return p._userAttributes?.quickModelView?.currentVersion || 
         p._userAttributes?.projectMaker?.currentVersion // backwards compatible for previous release projects
   }

   // the orginal version that created the project
   const getProjectOriginalVer = (p) => {
      return p._userAttributes?.quickModelView?.originalVersion || 
         p._userAttributes?.projectMaker?.originalVersion // backwards compatible for previous release projects
   }

   // whether a project is out of date with the current Project Maker version
   // USES SEMANTIC VERSIONING
   const isOutOfDate = (project) => {

      let projVersion = getProjectVer(project)
      
      try {
         return semver.lt(projVersion, currentVer)
      } catch (error) {
         console.error(error)
         return false
      }
   }

   // add notices from the update script to the update log
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
            {projects.map(p => <React.Fragment key={p._id}>
               <tr>
                  <td className='first-col center'>
                     <ProjectUpdater 
                        project={p}
                        version={getProjectVer(p)}
                        migratable={migrateVersions.includes(getProjectVer(p)) && p._metadata._createdById === user._id}
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
                  <td >{showClose && <i className="fas fa-times-circle" onClick={handleListClose}></i>}</td>
                  <td colSpan='4'><ul className='update-log'>
                     {updateLog.map((u,i) => <li key={i}>{u}</li>)}
                  </ul></td>
               </tr>}
            </React.Fragment>)}
         </tbody>
      </table>
   </div>
}

export default ProjectList