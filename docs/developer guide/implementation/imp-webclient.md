# In-Depth:  The Template Web Client

The template web client is an ipa-core based React Twinit web client. It extends the base ipa-core client with:

* A custom header component
* A Project Maker pageComponent
* A Model Import pageComponent
* A Simple Viewer pageComponent

Additionally it uses these standard pageComponents provided by ipa-core:

* [UserGroupsView](https://twinit.dev/docs/uiframework/userconfigs/pagehandlers/usergroup)

And as all ipa-core based web clients do, the template web client utilizes User Configs related to User Groups in order to display the user interface. The User Configs for the Quick Model View template must have the _userType:

* **quick-view**

## Custom Template Header

The template web client loads a custom header that replaces the default ipa-core header.

Replacing the header is configured in the user config files. Each of the user configs, and user config templates, contain the following setting to load the custom header.

```json
settings: {
   "headerComponent": "components/HeaderBar/HeaderBar"
}
```

The React component for the custom header can be found at ```app/ipaCore/components/HeaderBar/HeaderBar.jsx```.

## Project Maker pageComponent

The Project Maker pageComponent can be found at ```app/ipaCore/pageComponents/projectMaker/projectMakerView.jsx```.

Read through [the pageComponent code](../../../app/ipaCore/pageComponents/projectMaker/projectMakerView.jsx), and its subcomponents ```ProjectList.jsx``` and ```ProjectCreate.jsx``` to get a better understanding of the React code.

To learn more about how the Project Maker works read [In-Depth: Quick Model View Project Maker](./imp-projmake.md)


## Model Import pageComponent

The Model Import pageComponent can be found at ```app/ipaCore/pageComponents/modelImport/SimpleModelImportView.jsx```.

Read through [the pageComponent code](../../../app/ipaCore/pageComponents/modelImport/SimpleModelImportView.jsx), its subcomponents, and helper code to get a better understanding of how it works.

> **Note**: The Quick Model View Template currently only supports importing and viewing CAD models from Revit, Civil 3D, AutoCAD, and IFC produced by one of the supported [Twinit plugins](https://apps.invicara.com/ipaplugins/). The plugins for these CAD authoring applications produce bimpk files. While Twinit has a Navisworks plugin, Navisworks models are not supported by the Quick Model View template. The Navisworks Twinit plugin produces an sgpk file that lacks some of the data needed for the Quick Model View template to work.

To learn more about how the Model Import pageComponent works read [In-Depth: Quick Model View Projects](./imp-qmvprojects.md)

##  Simple Viewer pageComponent

The Simple Viewer pageComponent can be found at ```app/ipaCore/pageComponents/simpleViewer/SimpleViewer.jsx```.

Read through [the pageComponent code](../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx) to get a better understanding of how it works.

To learn more about how the Simple Viewer pageComponent works read [In-Depth: Quick Model View Projects](./imp-qmvprojects.md)

---
[Developer Guide](../README.md) < Back | Next > [In-Depth: Quick Model View Manager](./imp-projmake.md)