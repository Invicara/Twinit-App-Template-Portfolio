# Change the Title of the App in the Web Client

The template provides a default application title displayed in the web client. The application title appears in both the QMV Manager and Quick Model View user interface and can be changed in each independently.

## Change the Title

The title can be changed by editing the user config templates in the QMV Manager project, or editing the QMV Manager user config, or editing the user configs in Quick Model View projects.

To change the title you will modify the "appTitle" in the "settings" in each user config.

```json
"appTitle": "Quick Model View"
```

## Where to Make Title Changes

There are potentially three places you will need to make the setting change to display a different title depending on where you want the title to appear.

### QMV Manager User Interface

If you wish a new title to appear in the Project Maker user interface, you'll need to modify the QuickViewManagerConfig in the "QMV Manager" project.

### Newly Created Quick Model View Projects

If you wish a new title to appear in newly created Quick Model View projects, you'll need to modify the QuickViewAdminConfigTemplate and QuickViewViewerConfigTemplate in the "QMV Manager" project.

### Existing Quick Model View Projects

If you wish a new title to display in existing Quick Model View projects to display the new logo, you'll need to modify the QuickViewAdminConfig and QuickViewViewerConfig in each of the existing projects.

> This could be done by creating a custom migration and running these updates through the Project Maker pageComponent UI, but you will need to be careful when consuming future template updates.

---
[Developer Guide](../README.md) < Back