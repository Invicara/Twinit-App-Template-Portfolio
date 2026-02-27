import React, { useContext, useState, useEffect } from 'react'

import { IafProj, IafFileSvc } from '@dtplatform/platform-api'

import { ModelContext } from '../../contexts/ModelContext'

import { getModelFolder } from './modelDocUtils'
import ModelDocUpload from './components/ModelDocUpload'
import FileRow from './components/FileRow'

import './ModelDocs.scss'

const VIEWABLES = ['pdf', 'xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'bmp', 'tiff', 'png', 'txt']

// diplays an upload files dag and drop component
// and a list of files associated to the currently selected model
// all files are fetched from the File Service directly
// bimpks are stored in the root container for the project
// all other files are stored in a folder with the model's name in the root container
// each file is extended in the componnt's state with a deletable and viewable flag
const ModelDocs = ({ onView, readOnly }) => {

   // currently selected model
   const { selectedModelComposite, selectedModelCompositeVersion } = useContext(ModelContext)

   // th elis tof fils to display
   const [ files, setFiles ] = useState()

   useEffect(() => {
      fetchFiles()
   }, [])

   // fetches files associated to the model
   const fetchFiles = async () => {

      setFiles([])

      const project = await IafProj.getCurrent()

      //get the current models bimpk
      const bimpkCriteria = {
         _namespaces: project._namespaces,
         _parents: 'root',
         _ids: `${selectedModelComposite._versions[0]._userAttributes.bimpk.fileId}`
      };

      const fetchedBimpk = await IafFileSvc.getFiles(bimpkCriteria, null, { _pageSize: 100 }, true)
      
      fetchedBimpk._list.forEach(f => {
         f.deletable = false  // bimpks are not deletable by the user
         f.viewable = false   // bimpks are not viewable in the doc viewer component
      })

      // get the File Service folder containing the model's associated files
      let modelFolder = await getModelFolder(project, selectedModelComposite)

      let allFiles = []
      let total = 0
      let _offset = 0
      let _pageSize = 100

      do {

         let filePage = await IafFileSvc.getFiles({_parents: modelFolder._id}, null, {_pageSize, _offset}, true)
         total = filePage._total
         _offset += _pageSize
         allFiles.push(...filePage._list)

      } while (allFiles.length < total)

      allFiles.sort((a,b) => a._name.localeCompare(b._name))
      
      allFiles.forEach(f => {
         f.deletable = true // users can delete these files
         f.viewable = VIEWABLES.includes(f._name.split('.').pop()) // files are viewable if in the supported list of file types
      })

      setFiles([...fetchedBimpk._list, ...allFiles])
   }

   return <div className='model-docs-component'>
      {!readOnly && selectedModelCompositeVersion?._isTip && <ModelDocUpload onFilesUploaded={fetchFiles}/>}
      <table className='file-table'>
         <tr>
            <th className='row-expander-head'></th>
            <th className='row-download-head'></th>
            <th className='row-view-head'></th>
            <th className='row-ver-head'>Version</th>
            <th className='row-delete-head'></th>
            <th className='row-filename-head'>Filename</th>
         </tr>
         {files?.map(f => <FileRow key={f._id} file={f} onChange={fetchFiles} onView={onView} readOnly={readOnly}/>)}
      </table>
   </div>

}

export default ModelDocs