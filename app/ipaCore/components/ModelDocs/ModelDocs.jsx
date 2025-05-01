import React, { useContext, useState, useEffect } from 'react'

import { IafProj, IafFileSvc } from '@dtplatform/platform-api'

import { ModelContext } from '../../contexts/ModelContext'

import { getModelFolder } from './modelDocUtils'
import ModelDocUpload from './components/ModelDocUpload'
import FileRow from './components/FileRow'

import './ModelDocs.scss'

const VIEWABLES = ['pdf', 'xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'bmp', 'tiff', 'png', 'txt']

const ModelDocs = ({ onView }) => {

   const { selectedModelComposite } = useContext(ModelContext)

   const [ files, setFiles ] = useState()

   useEffect(() => {
      fetchFiles()
   }, [])

   const fetchFiles = async () => {

      setFiles([])

      const project = await IafProj.getCurrent()

      const bimpkCriteria = {
         _namespaces: project._namespaces,
         _parents: 'root',
         _ids: `${selectedModelComposite._versions[0]._userAttributes.bimpk.fileId}`
      };

      //get the current models bimpk
      const fetchedBimpk = await IafFileSvc.getFiles(bimpkCriteria, null, { _pageSize: 100 }, true)
      
      fetchedBimpk._list.forEach(f => {
         f.deletable = false
         f.viewable = false
      })

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
         f.deletable = true
         f.viewable = VIEWABLES.includes(f._name.split('.').pop())
      })

      setFiles([...fetchedBimpk._list, ...allFiles])
   }

   return <div className='model-docs-component'>
      <ModelDocUpload onFilesUploaded={fetchFiles}/>
      <table className='file-table'>
         <tr>
            <th className='row-expander-head'></th>
            <th className='row-download-head'></th>
            <th className='row-view-head'></th>
            <th className='row-ver-head'>Version</th>
            <th className='row-delete-head'></th>
            <th className='row-filename-head'>Filename</th>
         </tr>
         {files?.map(f => <FileRow key={f._id} file={f} onChange={fetchFiles} onView={onView}/>)}
      </table>
   </div>

}

export default ModelDocs