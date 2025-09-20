# Release Notes

## Version 2.1.1
_August 2025_

### Patch Changes

* The import script was enhanced to migrate existing file relations to model elements from the previous version of the imported model to the newly imported version. This carries forward model element to file item relations to each new version.
* The model upload control is hidden when any version except the latest version of the model is being viewed.
* Documentation was enhanced around model and model element file relations

### Update Support

* Supports updating projects with a current version of 2.0.0 or 2.1.0. Older projects must first be updated to 2.0.0 before migrating to 2.1.1.

## Version 2.1.0
_August 2025_

### New Features

* A new dropdown has been added allowing older versions of the imported model to be viewed.
* Files can now be attached to a model, downloaded, and viewed directly in the browser.
* Files can now be attached to a model element, downloaded, and viewed directly in the browser.
* Twinit 2D/3D Model viewer updated to version 4.6 from 4.3. See these release notes for new viewer capabilities
   * [IafViewer 4.4](https://twinit.dev/docs/concepts/v4.4/release-notes#improved-iafviewer)
   * [IafViewer 4.5](https://twinit.dev/docs/concepts/v4.5/release-notes#improved-iafviewer)
   * [IafViewer 4.6](https://twinit.dev/docs/concepts/release-notes#gis-feature-for-the-iafviewer)
* Support for secure IafViewer configuration and integration with Mapbox for 2D GIS added for Admin users.

### Other Updates

* React client updated to React 18.
* React client updated to 4.6 @dtplatform package versions.
* Common component refactoring into components directory.
* ModeContext refactored into a contexts directory.
* Specified migration paths for ProjectMaker project migration.

### Update Support

* Supports updating only projects with a current version of 2.0.0. Older projects must first be updated to 2.0.0 before migrating to 2.1.0.
 
## Version 2.0.0
_February 2025_

### New Features

* Selected model element properties have been moved into a collapsible and resizable drawer on the left side of the model view.
* When only one imported model is present, it will now automatically load in the viewer.
* New search controls allow for searching for and isolating model elements in the viewer.
* New model element table displays isolated element data and supports downloading to Excel.
* Delete the latest imported model version (to allow you to re-import it)

### Update Support

* Supports updating from 1.3.0

## Version 1.3.0
_February 2025_

1.3.0 is the first release of the Quick Model View template.

### Features

* An application template that can be deployed to Twinit, including a template web client user interface for the application
   * Quick Model View Manager that allows you create new Quick Model View Projects
   * Quick Model View functionality allowing for
      * Upload and importing CAD models in bimpk format
      * Viewing imported CAD models and the properties on model elements
      * Inviting user to Quick Model View Manager and Quick Model View projects
* User Guide for using the Application Template
* Developer Guide for deploying, supporting, and extending the Application Template