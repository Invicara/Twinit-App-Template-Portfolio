# Model Files

Files uploaded to Quick Model View are managed by model and stored in a folder in the File Service specific to a model.

## Model .bimpks

All model .bimpk files are uploaded to the Root Container for the project in the File Service.

```
Root Container
├─ Model A.bimpk
├─ Model B.bimpk
```

Model .bimpk files can be retrieved from the File Service like this:

```js
const bimpkCriteria = {
   _namespaces: project._namespaces,
   _parents: 'root',
   _name: '.*bimpk',
}
   
//get all bimpk files in the current project
const fetchedBimpks = await IafFileSvc.getFiles(bimpkCriteria, null, { _pageSize: 100 })
```

## Model Folders

When a file is uploaded through the Quick Model View web-client, if a folder for the model does not yet exist in the Root Container, then one will be created with the model's name, and the file then uploaded to it.

Folders in the File Servce ca be added by:

```js
let modelFolder = await IafFileSvc.addFolder(modelComposite._name, project._namespaces)
```

Once files have been uploaded the File Service structure will like this:

```
Root Container
├─ Model A.bimpk
├─ Model B.bimpk
├─ Model A
│  ├─ Model A file 1
│  ├─ Model A file 2
├─ Model B
│  ├─ Model B file 3
│  ├─ Model B file 4
```

A folder for a specific model can be fetched from the File Service like this:

```js
// gets or creates a File Service folder in the root container
// with the provided model's name
export const getModelFolder = async(project, modelComposite) => {

   let modelFolder

   let modelFolderResp = await IafFileSvc.getFiles({_name: modelComposite._name, _type: 'dir'})

   if (modelFolderResp?._total === 1) modelFolder = modelFolderResp._list[0]

   if (!modelFolder) {
      modelFolder = await IafFileSvc.addFolder(modelComposite._name, project._namespaces)
   }

   return modelFolder

}
```

And the files in that folder can be fetched like so:

```js
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
```

---
[In-Depth: Template Data Model](../imp-data-model.md) < Back