import React, { useState, useEffect, createContext } from 'react'

import { IafProj, IafApplication } from '@dtplatform/platform-api'
import { ScriptHelper } from '@invicara/ipa-core/modules/IpaUtils'

// the component on the page used to create new projects
import ProjectCreate from './ProjectCreate/ProjectCreate.jsx'

// the component on the page used to display and update existing projects
import ProjectList from './ProjectList/ProjectList.jsx'

import './projectMakerView.scss'

// a React Context providing the page handler.config to child components
export const ConfigContext = createContext()

/*
 * The ProjecMakerVew pageComponent allows for the creation of new
 * Quick Model View projects and updates of existing Quick Model View
 * projects.
 * 
 * In order for a user to be able to use this pageComponent, they must
 * first be added to the application's App Developer User Group and
 * must be added to a project and user group with the ProjectMakerView
 * configured in a user config.
*/
const ProjectMakerView = (props) => {

   // whether the page is currently checking if the user is 
   // in the App Developer user group
   const [ checkingAdmin, setCheckingAdmin ] = useState(true)
   // if th user is in the App Developer user group or not
   const [ isAdmin, setIsAdmin ] = useState(false)

   // the current version assigned to projects when they are created
   // this is retrieved from the ProjectMaker script
   const [ currentMakerVersion, setCurrentMakerVersion ] = useState()

   // the versions supported for migration to currentMakerVersion
   const [ migratFromVersions, setMigrateFromVersions ] = useState()

   // the list of projects to which my user has access
   const [ myProjects, setMyProjects ] = useState([])

   // when the page mounts:
   // 1. check if the user is an admin
   // 2. geth the current project maker version for new projects
   // 3. load the projects to which the user has access
   useEffect(() => {
      checkAppAdmin()
      getMakerVersion()
      getMyProjects()
   }, [])

   const checkAppAdmin = async () => {

      let project = await IafProj.getCurrent()

      // just make sure this doesnt fly by in the UI confusing users
      // so we just put it behind a quick timeout
      setTimeout(() => {

         try {
            IafApplication.getAppDeveloperUserGroup(project).then((ug) => {
               
               setCheckingAdmin(false)
               if (ug) {
                  setIsAdmin(true)
               }
               
            })
         } catch(err) {
            console.error("ERROR: Checking Admin Permissions")
            console.error(err)
         }
      }, 2000)

   }

   const getMakerVersion = async () => {

      // the handler for this pageComponent has a script configured to return the
      // current Page Maker version, run the script
      // if not set the current version to ERROR
      if (props.handler.config.currentVersionScript) {
         try {
            let ver = await ScriptHelper.executeScript(props.handler.config.currentVersionScript)
            setCurrentMakerVersion(ver.CURRENT_MAKER_VERSION)
            setMigrateFromVersions(ver.MIGRATE_PROJECT_VERSIONS)
         } catch (error) {
            setCurrentMakerVersion('ERROR')
         }
      } else {
         setCurrentMakerVersion('ERROR')
      }

   }

   const getMyProjects = async () => {

      //retrieve all projects to which the user has access
      // a page of 20 at a time
      let _pageSize = 20
      let _offset = 0
      let total = 0
      let allProjects = []

      try {

         do {
            let projPage = await IafProj.getProjectsWithPagination(null, null, {_pageSize, _offset})
            console.log(projPage)

            total = projPage._total
            _offset += _pageSize

            allProjects.push(...projPage._list)

         } while (allProjects.length < total)

         // sort all projects by their name
         allProjects.sort((a,b) => a._name.localeCompare(b._name))

         // filter out Page Maker projects as they are not managed by this interface
         // Page Maker projects must not have _userAttributes.projectMaker settings (older projects)
         // or _userAttributes.quickModelView (newest projects)
         allProjects = allProjects.filter(p => p._userAttributes.projectMaker || p._userAttributes.quickModelView)

         setMyProjects(allProjects)
      } catch (err) {
         console.error("ERROR: Retrieving Projects")
            console.error(err)
      }

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
            {!checkingAdmin && isAdmin && <ProjectList
               user={props.user}
               projects={myProjects}
               currentVer={currentMakerVersion}
               migrateVersions={migratFromVersions}
               onUpdate={getMyProjects}
            />}
         </div>
      </ConfigContext.Provider>
   </div>
}

export default ProjectMakerView