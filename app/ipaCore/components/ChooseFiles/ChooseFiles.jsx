import React, { useRef, useState } from "react";
import clsx from "clsx";

import './ChooseFiles.scss'

export const ChooseFiles = ({ onAddFiles, busy, selectedElement, busyMsg = 'Uploading Files' }) => {
   const [dragging, isDragging] = useState(false)
   const fileInput = useRef()

   const handleBrowse = (e) => {
      e.preventDefault()
      fileInput.current.click()
   }

   const handleFileSelect = () => {
      if (fileInput.current.files.length) onAddFiles(Array.from(fileInput.current.files))
      fileInput.current.value = null
   }

   const handleFileDrop = event => {
      event.preventDefault()
      isDragging(false)
      onAddFiles(event.dataTransfer.files)
   }

   return (
      <div className="dropzone-anchor">
         <p className="warningText">
            {selectedElement ?
               `The selected file will be associated with ${selectedElement.instanceProps?.['BA Name']?.val}`
               : "The selected file will be associated with the current model."
            }
         </p>
         {busy ? (
            <div className="dropzone">
               <div className="icon-wrapper">
                  <i className="fas fa-spinner fa-spin" />
               </div>
               <div className="dropzone-legend">{busyMsg}</div>
            </div>
         ) : (
            <div
               className={clsx("dropzone", dragging && "dragging")}
               onDrop={handleFileDrop}
               onDragEnter={() => isDragging(true)}
               onDragLeave={() => isDragging(false)}
               onDragOver={e => e.preventDefault()}
            >
               <div className="icon-wrapper">
                  <i className="fas fa-cloud-upload-alt cloud-icon" />
               </div>
               <div className="dropzone-legend">Drag and drop files here</div>
               <a href="#" onClick={handleBrowse}>or browse for files</a>
               <input ref={fileInput} onChange={handleFileSelect} type="file" hidden multiple />
            </div>
         )}
      </div>
   );

}