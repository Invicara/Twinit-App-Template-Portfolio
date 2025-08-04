# Model and Model Element File Attachment

The user can now associate files to models and model elements.

Files are saved in the File Service. Each model has its own folder with the model name in the project's root container. All files related to the model are saved in the model's folder.
All files related to a model element are saved in a SHARED folder in the File Service. Those files will also have a corresponding File Item in the Item Service.

## Code Updates

[getModelFolder in modelDOcUtils.js](../../../../app/ipaCore/components/ModelDocs/modelDocUtils.js) will either create a new folder for a model if it does not yet exist or it will return the existing one. It will also make sure the SHARED folder is created and the Item Service is configured with file containers.

[uploadFilesToModelFolder in ModelDocUpload.jsx](../../../../app/ipaCore/components/ModelDocs/components/ModelDocUpload.jsx#L19) then handles uploading the files to the model's folder or the SHARED folder using [resumable upload](../../../../app/ipaCore/components/ModelDocs/components/ModelDocUpload.jsx#L91).

## Config Updates

Only Admin users can upload and delete files. To control the web-client user interface, a new config option has been added the SimpleViewerView pageComponent confguration. A ```config.managefiles`` setting has been added.

When set to true, the user will see the upload and delete user interface components for files. If it is no provided its default is false.

```json
"modelView": {
   "title": "Model View",
   "icon": "fas fa-building fa-2x",
   "shortName": "modelview",
   "description": "Model View",
   "pageComponent": "simpleViewer/SimpleViewerView",
   "path": "/modelview",
   "config": {
      "manageFiles": true
   }
   },
```

> Note: Even if set to true, the user will still need the appropriate permissions on Twinit to upload and delete files.

## More Information

See [In-Depth: Template Data Model](../../implementation/imp-data-model.md) for more information.

---
[Developer Update Guide](../README.md) < Back