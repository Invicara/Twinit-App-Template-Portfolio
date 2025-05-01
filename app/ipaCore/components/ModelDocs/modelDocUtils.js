import { IafFileSvc } from "@dtplatform/platform-api"

export const getModelFolder = async(project, modelComposite) => {

   let modelFolder

   let modelFolderResp = await IafFileSvc.getFiles({_name: modelComposite._name, _type: 'dir'})

   if (modelFolderResp?._total === 1) modelFolder = modelFolderResp._list[0]

   if (!modelFolder) {
      modelFolder = await IafFileSvc.addFolder(modelComposite._name, project._namespaces)
   }

   return modelFolder

}