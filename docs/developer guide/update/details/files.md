# Model File Attachment

The user can now associate files to models.

Files are saved in the File Service. Each model has its own folder with the model name in the project's root container. All files related to the model are saved in the model's folder.

[getModelFolder in modelDOcUtils.js](../../../../app/ipaCore/components/ModelDocs/modelDocUtils.js) will either create a new folder for a model if it does not yet exist or it will return the existing one.

[uploadFilesToModelFolder in ModelDocUpload.jsx](../../../../app/ipaCore/components/ModelDocs/components/ModelDocUpload.jsx#L19) then handles uploading the files to the model's folder using [resumable upload](../../../../app/ipaCore/components/ModelDocs/components/ModelDocUpload.jsx#L91).

See [In-Depth: Template Data Model](../../implementation/imp-data-model.md) for more information.

---
[Developer Update Guide](../README.md) < Back