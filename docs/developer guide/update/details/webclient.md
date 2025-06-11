# Web Client Changes

Updates to the Quick Model View web-client include:

* Update to React 18, @dtplatform 4.6 packages, and the addition of a new node package
* Refactoring of the ModelContext to a ```contexts``` folder and common React components to a ```components``` directory
* Support was added for viewing older imported versions of the current model
* Addition of a Floating Doc Viewer component for viewing files in the browser using the Twinit IafDocViewer component.
* SimpleViewerView updates to add a document drawer allowing for associating, managing, and viewing files associated with the current model
* Addition of a Mapbox Settings pageComponent and workflow allowing Admins in a Quick Model View Project to create Mapbox secrets enabling Mapbox features in the IafViewer
* ProjectMaker now compares current project versions against a list of supported migration versions and disables migrating projects that are too old

## React 18, @dtplatform updates, and New Packages

In order to use the latest Twinit IafViewer the web-client had to be upgraded to React 18.

Since ipa-core has not yet moved to the 4.6 @dtplatform packages and React 18, the ipa-core dependencies are overridden in [package.json](../../../../package.json#L120).

Additionally, [app/client/index.js](../../../../app/client/index.jsx#L20) was updated to use the new React root.render method.

One new package was added to the web client to support new features:

* react-rnd

[https://github.com/bokuweb/react-rnd](https://github.com/bokuweb/react-rnd)

react-rnd is used to provide an easy to implement floating, draggable, and resizable dialog in which to display the Twinit IafDocViewer.

## ModelContext and Component Refactoring

The ModelContext was moved from the SimpleViewerView pageComponent directory to a [app/ipaCore/contexts directory](../../../../app/ipaCore/contexts/ModelContext.js)

Many other components were also moved from the SimpleViewerView pageComponent directory to the [app/ipaCore/components directory](../../../../app/ipaCore/components/)

## Viewing Older Model Versions

Users can now select from any of the imported versions of a model to view in the Twinit model viewer.

The ModelContext now [loads all model versions](../../../../app/ipaCore/contexts/ModelContext.js#L140) after a model has been selected to be viewed and makes the versions [available in its state](../../../../app/ipaCore/contexts/ModelContext.js#L19).

The ModelSelect component allows a user to [select from the versions](../../../../app/ipaCore/components/ModelSelect/ModelSelect.jsx#L57) of the selected model.

The IaFViewerDBM in SimpleViewerView is then given the [selected model and selected model version](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx#L125) to display.

If there is only one model imported the viewer will display that model by default. Also, by default, the latest version of the model will be loaded, until the user selects a different version.

## New FloatingDocViewer Component

A new [FloatingDocViewer component](../../../../app/ipaCore/components/FloatingDocViewer/FloatingModelDocViewer.jsx) was added. This component is based on the one found in the [digitaltwin-factory samples](https://github.com/Invicara/digitaltwin-factory/tree/master/components/FloatingDocViewer).

It uses the [IafDocViewer](https://twinit.dev/docs/apis/doc-viewer/overview) to display supported file types in the browser.

## SimpleViewerView Model Document Drawer

A new StackableDrawer was added to the SimpleViewerView to allow Admins to upload and associate files to the current model. All users can also use the drawer to list, view, and download the files.

The [StackableDrawer](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx#L114) renders the [ModelDocs component](../../../../app/ipaCore/components/ModelDocs/ModelDocs.jsx) when a model is selected.

The ModelDocs component renders a drag and drop (or manual select) file upload component for Admins and a list of files associated to the current model. The model list allows all users to download any version of any file and to view any version of any supported file type. Admins can also delete files.

For information on how files are associated to models see [the data model documentation](../../implementation/imp-data-model.md)

## Mapbox Settings and API Token Workflow

A new workflow was introduced to allow the web-client to fetch temporary Mapbox API tokens for support of 2D GIS features in the Twinit model viewer.

For a complete description of the entire workflow see [In-Depth: Handling Secrets and the Mapbox Token Workflow](./implementation/imp-secrets.md).

The workflow begins with the new [MapboxSettingsView pageComponent](../../../../app/ipaCore/pageComponents/mapboxSettings/MapboxSettingsView.jsx) in which admin users can enter a Mapbox user name and secret token. Only one Mapbox secret is allowed in the Secrets collection, so if one already exists and the admin enters a new user name and secret token on the MapboxSettingsView pageComponent, the new entry will replace the existing one.

The pageComponent also displays a checklist of the necessary configurations for the Mapbox API Token workflow to complete successfully:

* Mapbox Authentication Script
* Mapbox Authentication Orchestrator
* Mapbox Secrets Store
* Mapbox Secret Token

If all four are configured and display with a green check, then the SimpleViewerView will be able to request a temporary Mapbox token.

When the [SimpleViewerView pageComponent mounts](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx#L81) the page will attempt to [fetch a temporary token](../../../../app/ipaCore/pageComponents/utils/mapboxUtils.js#L7) using the Mapbox Authentication Orchestrator. If a temporary token is successfully retrieved [the viewer will able the Mapbox features](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx#L131).

For a complete description of the entire workflow see [In-Depth: Handling Secrets and the Mapbox Token Workflow](./implementation/imp-secrets.md).

## ProjectMaker Supported Migrations

Users are now only able to migrate projects which they created.

The ProjectMakerView pageComponent now relies on a two versions returned from the Project Maker script. As before it uses the [CURRENT_MAKER_VERSION](../../../../app/ipaCore/pageComponents/projectMaker/projectMakerView.jsx#L88) to know it current release version. It now also uses an array of previous release versions in [MIGRATE_PROJECT_VERSIONS](../../../../app/ipaCore/pageComponents/projectMaker/projectMakerView.jsx#L89) to know projects at what versions [can be migrated to the current release](../../../../app/ipaCore/pageComponents/projectMaker/ProjectList/ProjectUpdater.jsx#L77). 

---
[Developer Update Guide](../README.md) < Back
