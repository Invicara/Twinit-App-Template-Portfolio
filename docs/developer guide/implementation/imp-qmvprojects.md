# In-Depth: Quick Model View Projects

Quick Model View projects contain:

* An import script with the business logic for importing models
* An import orchestrator that uses the import script to import models
* A User Config for the Admin User Group
* A User Config for the Viewers User Group

## Quick Model View User Groups

Quick Model View projects have these User Groups:

* Admin: Full access to all Twinit Services and data for the project
* Viewers: Read-Only access to all Twinit Services and data for the project

## Quick Model View User Configs

Quick Model View projects have these User Configs:

* QuickModelViewAdminConfig: the user config related the Admin User Group
* QuickModelViewViewerConfig: the user config related the Viewers User Group

## Quick Model View Pages

Quick Model View has three pages available to configure for user interfaces. Which pages are available depend on the User Group the user is a member of.

| User Group | User Groups Page | Model Import Page | Model View Page | 
| ------ | ------ |------ |------ |
| Admin | Yes (via header menu) | Yes | Yes |
| Viewers | No | No | Yes |

The User Config related to the User Group expose the pages by configuring the following pageHandlers.

### User Groups Page

The User Groups page for managing users access to the Quick Model View project (via the header menu). This page is provided by ipa-core. Read more about this pageComponent and how to configure it on [twinit.dev](https://twinit.dev/docs/uiframework/userconfigs/pagehandlers/usergroup).

### Model Import Page

The Model Import Page allows a user to see the various versions of bimpk files that have been uploaded to the project (either via Twinit plugin or through the page itself), and import those bimpks to Twinit.

> **Note**: The Quick Model View Template currently only supports importing and viewing CAD models from Revit, Civil 3D, AutoCAD, and IFC produced by one of the supported [Twinit plugins](https://apps.invicara.com/ipaplugins/). The plugins for these CAD authoring applications produce bimpk files. While Twinit has a Navisworks plugin, Navisworks models are not supported by the Quick Model View template. The Navisworks Twinit plugin produces an sgpk file that lacks some of the data needed for the Quick Model View template to work.

### Page Handler

The Model Import pageComponent can be configured to display in the web client by adding the following handler in a User Config.

```json
"modelImport": {
   "title": "Model Import",
   "icon": "fas fa-file-import fa-2x",
   "shortName": "modelimp",
   "description": "Model Import",
   "pageComponent": "modelImport/SimpleModelImportView",
   "path": "/modelimp",
   "config": {
      "bimpkUserType": "bimpk_importer",
      "sgpkUserType": "sgpk_importer"
   }
}
```

The Model Import handler takes two config settings:

* bimpkUserType: the _userType of the model import orchestrator configured to import model bimpk files
* sgpkUserType: **NOT CURRENTLY SUPPORTED IN QUICK MODEL VIEW** the _userType of the model import orchestrator configured to import model sgpk (Navisworks) files

### Model View Page

The Model View Page allows users to view imported models and see model element properties. It leverages the Twinit IafViewer component to display the 2D/3D models.

### Page Handler

The Simple Viewer pageComponent can be configured to display in the web client by adding the following handler to a User Config.

```json
"modelView": {
   "title": "Model View",
   "icon": "fas fa-building fa-2x",
   "shortName": "modelview",
   "description": "Model View",
   "pageComponent": "simpleViewer/SimpleViewerView",
   "path": "/modelview",
   "config": {}
}
```

The Simple Viewer pageComponent requires no further configuration.

---
[Developer Guide](../README.md) < Back