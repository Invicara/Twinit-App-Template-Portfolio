import React, { useEffect, useState } from "react";

import { IafFileSvc, IafFile, IafProj } from "@dtplatform/platform-api";

import { makeDateString } from '../../../pageComponents/utils/common-utils'

import './FileRow.scss'

// a file row in the ModelDocs file table representing one file
const FileRow = ({ file,       // the file in the row
   onChange,   // callback for when there is a file change
   onView,     // callback for when the user clicks to view the file
   readOnly    // whether the row is read-only or not
}) => {

   // versions of the file
   const [versions, setVersions] = useState()

   // whether to show the version in the table or collapse to latest version
   const [showVersions, setShowVersions] = useState(false)

   // confirm file delete
   const [confirmDelete, setConfirmDelete] = useState(false)

   useEffect(() => {
      getVersions()
   }, [])

   // gets the version of the file in the row
   const getVersions = async () => {

      let versions = await IafFileSvc.getFileVersions(file._id)
      setVersions(versions._list.sort((a, b) => b._version - a._version))

   }

   // downloads a version of the file locally
   const downloadFileVersion = async (fileVersion) => {
      let downloadUrl = fileVersion._url

      if (!downloadUrl) {
         if (fileVersion.downloadID && fileVersion.downloadVersionID) {
            downloadUrl = (await IafFileSvc.getFileVersionUrl(fileVersion.downloadID, fileVersion.downloadVersionID))._url
         } else {
            downloadUrl = (await IafFileSvc.getFileVersionUrl(fileVersion._fileId, fileVersion._id))._url
         }
      }

      if (downloadUrl) {
         window.location.href = downloadUrl
      }

   }

   // deletes a file
   const deleteFile = async () => {
      IafFileSvc.deleteFile(file._id);

      const currentProject = await IafProj.getCurrent()
      const sharedFileContainer = await IafFile.getContainers(currentProject, { _name: "SHARED" });
      const fileItem = (await IafFile.getFileItems(sharedFileContainer[0], { name: file._name }))?._list[0];

      if (sharedFileContainer && fileItem) {
         await IafFile.deleteFileItem(sharedFileContainer[0], fileItem);
      }

      if (onChange) onChange(file)
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
            {file.viewable && onView && <i className='fas fa-eye' onClick={() => onView({ _fileId: file._id })}></i>}
         </td>
         <td className='row-ver'>latest</td>
         <td className='row-delete'>
            {!readOnly && file.deletable && <i className='fas fa-trash' onClick={() => setConfirmDelete(true)}></i>}
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
         <td>{file.viewable && onView && <i className='fas fa-eye' onClick={() => onView({ _fileId: v._fileId, _fileVersionId: v._id })}></i>}</td>
         <td className='row-ver'>{v._version}</td>
         <td></td>
         <td className='row-filename'>{makeDateString(v._metadata._createdAt)}</td>
      </tr>)}
   </>


}

export default FileRow
