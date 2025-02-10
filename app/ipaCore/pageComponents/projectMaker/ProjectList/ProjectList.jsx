import React, { useState, useEffect } from 'react'

import * as semver from 'semver'

import './ProjectList.scss'

const ProjectList = ({currentVer, projects}) => {

   const getProjectVer = (p) => {
      return p._userAttributes?.projectMaker?.currentVersion ? p._userAttributes.projectMaker.currentVersion : '1.2.0'
   }

   const getProjectOriginalVer = (p) => {
      return p._userAttributes?.projectMaker?.originalVersion ? p._userAttributes.projectMaker.originalVersion : '1.2.0'
   }

   const isUpToDate = (project) => {
      let projVersion = getProjectVer(project)
      return semver.lt(projVersion, currentVer)
   }


   return <div className='project-list'>
      <div className='current-version'>Current Project Maker Version: {currentVer}</div>
      <table>
         <thead>
            <tr>
               <th className='center'>Status</th>
               <th>Project</th>
               <th className='center'>Current Version</th>
               <th className='center'>Original Version</th>
            </tr>
         </thead>
         <tbody>
            {projects.map(p => <tr key={p._id}>
               <td className='center'>
                  {isUpToDate(p) ? 'Up to Date' : <div>Update</div>}
               </td>
               <td>{p._name}</td>
               <td className='center'>{getProjectVer(p)}</td>
               <td className='center'>{getProjectOriginalVer(p)}</td>
            </tr>)}
         </tbody>
      </table>
   </div>
}

export default ProjectList