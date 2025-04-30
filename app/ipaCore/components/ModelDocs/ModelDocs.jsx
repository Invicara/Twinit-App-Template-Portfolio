import React, { useContext, useState, useEffect } from 'react'

import { IafProj, IafFileSvc, IafFile } from '@dtplatform/platform-api'

import { ModelContext } from '../../contexts/ModelContext'

import FileRow from './FileRow'

import './ModelDocs.scss'

const ModelDocs = () => {

   const { selectedModelComposite } = useContext(ModelContext)

   const [ files, setFiles ] = useState()

   useEffect(() => {
      fetchFiles()
   }, [])

   const fetchFiles = async () => {

      const project = await IafProj.getCurrent()

      const bimpkCriteria = {
         _namespaces: project._namespaces,
         _parents: 'root',
         _ids: `${selectedModelComposite._versions[0]._userAttributes.bimpk.fileId}`
      };

      //get all bimpk files in the current project
      const fetchedBimpk = await IafFileSvc.getFiles(bimpkCriteria, null, { _pageSize: 100 }, true)

      setFiles(fetchedBimpk._list)
   }

   return <div className='model-docs-component'>
      <table className='file-table'>
         <tr>
            <th></th>
            <th></th>
            <th>Version</th>
            <th>Filename</th>
         </tr>
         {files?.map(f => <FileRow key={f._id} file={f} />)}
      </table>
   </div>

}

export default ModelDocs