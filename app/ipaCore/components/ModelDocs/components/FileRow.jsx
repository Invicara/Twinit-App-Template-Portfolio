import React, { useEffect, useState } from "react";

import { IafFileSvc } from "@dtplatform/platform-api";

import { makeDateString } from '../../../pageComponents/utils/common-utils'

import './FileRow.scss'

const FileRow = ({ file, onChange, onView }) => {

   const [ versions, setVersions ] = useState()
   const [ showVersions, setShowVersions ] = useState(false)
   const [ confirmDelete, setConfirmDelete ] = useState(false)

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

   const deleteFile = () => {

      IafFileSvc.deleteFile(file._id).then(() => {
         if (onChange) onChange(file)
      })

   }

   return <>
      <tr className='file-row file-tip-row'>
         <td className='row-expander'>
            {versions?.length > 1 && !showVersions && <i className='fas fa-chevron-right' onClick={() => setShowVersions(true)}></i>}
            {versions?.length > 1 && showVersions && <i className='fas fa-chevron-down' onClick={() => setShowVersions(false)}></i>}
         </td>
         <td className='row-download'>
            <i className='fas fa-file-download' onClick={() => downloadFileVersion(file)}></i>
         </td>
         <td className='row-view'>
            {file.viewable && onView && <i className='fas fa-eye' onClick={() => onView({_fileId: file._id})}></i>}
         </td>
         <td className='row-ver'>latest</td>
         <td className='row-delete'>
            {file.deletable && <i className='fas fa-trash' onClick={() => setConfirmDelete(true)}></i>}
         </td>
         <td className='row-filename'>{file._name}</td>
      </tr>
      {confirmDelete && <tr className='confirm-delete'>
         <td colspan='4' className='delete-cell choice-btn'>
            <div className='delete' onClick={deleteFile}>Delete File</div>
         </td>
         <td colspan='2' className='cancel-cell choice-btn'>
            <div className='cancel-delete' onClick={() => setConfirmDelete(false)}>Cancel</div>
         </td>
      </tr>}
      {showVersions && versions.map(v => <tr key={v._id} className='file-row file-ver-row'>
         <td></td>
         <td className='row-dowload'><i className='fas fa-file-download' onClick={() => downloadFileVersion(v)}></i></td>
         <td></td>
         <td className='row-ver'>{v._version}</td>
         <td></td>
         <td className='row-filename'>{makeDateString(v._metadata._createdAt)}</td>
      </tr>)}
   </>


}

export default FileRow
