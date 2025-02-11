import React, { useState, useEffect, createContext } from 'react'

import { IafProj, IafApplication } from '@dtplatform/platform-api'
import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

import ProjectCreate from './ProjectCreate/ProjectCreate.jsx'
import ProjectList from './ProjectList/ProjectList.jsx'

import './projectMakerView.scss'

export const ConfigContext = createContext()

const ProjectMakerView = (props) => {

   const [ checkingAdmin, setCheckingAdmin ] = useState(true)
   const [ isAdmin, setIsAdmin ] = useState(false)

   const [ currentMakerVersion, setCurrentMakerVersion ] = useState()
   const [ myProjects, setMyProjects ] = useState([])

   useEffect(() => {
      checkAppAdmin()
      getMakerVersion()
      getMyProjects()
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

   const getMakerVersion = async () => {

      let ver = await ScriptHelper.executeScript(props.handler.config.currentVersionScript)
      setCurrentMakerVersion(ver)

   }

   const getMyProjects = async () => {

      let _pageSize = 20
      let _offset = 0
      let total = 0
      let allProjects = []

      do {
         let projPage = await IafProj.getProjectsWithPagination(null, null, {_pageSize, _offset})
         console.log(projPage)

         total = projPage._total
         _offset += _pageSize

         allProjects.push(...projPage._list)

      } while (allProjects.length < total)

      allProjects.sort((a,b) => a._name.localeCompare(b._name))
      allProjects = allProjects.filter(p => !p._name.includes('QMV Project Maker'))
      setMyProjects(allProjects)

   }

   return <div className='projectmake-page'>
      <ConfigContext.Provider value={props.handler.config}>
         <div className='projectmake-left'>
            {checkingAdmin && <div className='checking-admin-notice'>
               <i className="fas fa-spinner fa-spin"></i> Checking Admin User Status
            </div>}
            {!checkingAdmin && !isAdmin && <div className='checking-admin-notice checking-admin-fail'>
               <i className="fas fa-exclamation-triangle"></i> You are not an Admin!
            </div>}
            {!checkingAdmin && isAdmin && <ProjectCreate onCreate={getMyProjects} />}
         </div>
         <div className='projectmake-right'>
            {!checkingAdmin && isAdmin && <ProjectList projects={myProjects} currentVer={currentMakerVersion} />}
         </div>
      </ConfigContext.Provider>
   </div>
}

export default ProjectMakerView