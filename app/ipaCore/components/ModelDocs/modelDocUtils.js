import { IafFileSvc, IafFile } from "@dtplatform/platform-api"

const createRootFolderAndContainer = async (project) => {
   const rootFolderSearchCriteria = {
      _namespaces: project._namespaces,
      _parents: 'root',
      _type: 'dir'
   }

   const rootFolders = await IafFileSvc.getFiles(rootFolderSearchCriteria);

   let sharedFolder = rootFolders._list.find(f => f._name === 'SHARED');

   if (!sharedFolder) {
      sharedFolder = await IafFileSvc.addFolder('SHARED', project._namespaces, null);
   }

   let rootContainer = await IafFile.getRootContainer(project);

   if (!rootContainer) {
      rootContainer = await IafFile.createContainer(
         { _namespaces: project._namespaces },
         undefined
      );
   }

   let sharedFileContainer = await IafFile.getContainers(project, { _name: "SHARED" });

   if (!sharedFileContainer) {
      const sharedFileContainerInfo = {
         _name: "SHARED",
         _description: "File Container for SHARED folder in file service",
         folderId: sharedFolder._id
      }

      sharedFileContainer = await IafFile.createContainer(rootContainer, sharedFileContainerInfo);
   }

   return { sharedFolder, rootContainer, sharedFileContainer };
};

// gets or creates a File Service folder in the root container
// with the provided model's name
export const getModelFolder = async (project, modelComposite) => {

   let modelFolder

   let modelFolderResp = await IafFileSvc.getFiles({ _name: modelComposite._name, _type: 'dir' })

   if (modelFolderResp?._total === 1) modelFolder = modelFolderResp._list[0]

   if (!modelFolder) {
      modelFolder = await IafFileSvc.addFolder(modelComposite._name, project._namespaces)
   }

   await createRootFolderAndContainer(project);

   return modelFolder;
}