import React, { useEffect, useState } from "react";

import { IafFileSvc } from "@dtplatform/platform-api";

import { makeDateString } from '../../pageComponents/utils/common-utils'

import './FileRow.scss'

const FileRow = ({ file }) => {

   const [ versions, setVersions ] = useState()
   const [ showVersions, setShowVersions ] = useState(false) 

   useEffect(() => {
      getVersions()
   }, [])

   const getVersions = async () => {

      let versions = await IafFileSvc.getFileVersions(file._id)
      setVersions(versions._list.sort((a, b) => b._version - a._version))

   }

   const downloadFileVersion = async (fileVersion) => {

      let downloadUrl = fileVersion._url

      if (!downloadUrl) {
         downloadUrl = (await IafFileSvc.getFileVersionUrl(fileVersion._fileId, fileVersion._id))._url
      }

      if (downloadUrl) {
         window.location.href = downloadUrl
      }

   }

   return <>
      <tr className='file-tip-row'>
         <td>
            {versions?.length > 1 && !showVersions && <i className='fas fa-chevron-right' onClick={() => setShowVersions(true)}></i>}
            {versions?.length > 1 && showVersions && <i className='fas fa-chevron-down' onClick={() => setShowVersions(false)}></i>}
         </td>
         <td><i className='fas fa-file-download' onClick={() => downloadFileVersion(file)}></i></td>
         <td>latest</td>
         <td>{file._name}</td>
      </tr>
      {showVersions && versions.map(v => <tr key={v._id} className='file-ver-row'>
         <td></td>
         <td><i className='fas fa-file-download' onClick={() => downloadFileVersion(v)}></i></td>
         <td>{v._version}</td>
         <td>{makeDateString(v._metadata._createdAt)}</td>
      </tr>)}
   </>


}

export default FileRow
