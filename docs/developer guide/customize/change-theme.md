# Change the Theme Colors in the Web Client

The template provides a default theme for the web client. The application is defined in both the QMV Manager and Quick Model View user configs and can be changed in each independently.

## Change the Theme

The theme can be changed by editing the user config templates in the QMV Manager project, or editing the QMV Manager user config, or editing the user configs in Quick Model View projects.

To change the theme you will modify the "styles" in the "settings" in each user config.

```json
"styles": {

}
```

The "styles" setting supports adjusting the following theme colors:

```json
"styles": {
   //accent color for the entire application
   "--app-accent-color": "#C71784",

   //styles for the app header and dropdown menu
   "--head-bkg-color": "black",
   "--head-appname-color": "whitesmoke",
   "--head-menu-bkg-color": "#FFFFFF",
   "--head-menu-hover-color": "#F3F3F3",

   //styles for the left navbar
   "--nav-bkg-color": "#1D1D1D",
   "--nav-icon-color": "#F3F3F3",
   "--nav-hover-color": "#3E3E3E",
   "--nav-activegrp-bkg-color": "#3E3E3E",

   //styles for the FancyTree control by level
   "--fancytree-one-color": "#C71784",
   "--fancytree-one-channel-color": "#f3d5e4",
   "--fancytree-two-color": "#f26827",
   "--fancytree-two-channel-color": "#fde0d7",
   "--fancytree-three-color": "#00a693",
   "--fancytree-three-channel-color": "#cdebe8",

   // styles for the element table in the bottom panel
   "--element-table-font-primary": "#141414",
   "--element-table-font-secondary": "#757575",
   "--element-table-font-disabled": "#9e9e9e",
   "--element-table-border": "#9e9e9e",
   "--element-table-selected-row-color": "lightcyan"
}
```
**Note**: the comments in the json above must be removed before adding the styles to the user config as comments are not supported in json.

All of the above styles must be provided, partial theme definitions are not supported.

## Where to Make Theme Changes

There are potentially three places you will need to make the setting change to display a different theme depending on where you want the theme to appear.

### QMV Manager User Interface

If you wish a new theme to appear in the QMV Manager user interface, you'll need to modify the ProjectMakerConfig in the "QMV Manager" project.

### Newly Created Quick Model View Projects

If you wish a new theme to appear in newly created Quick Model View projects, you'll need to modify the QuickViewAdminConfigTemplate and QuickViewViewerConfigTemplate in the "QMV Manager" project.

### Existing Quick Model View Projects

If you wish a new theme to display in existing Quick Model View projects to display the new logo, you'll need to modify the QuickViewAdminConfig and QuickViewViewerConfig in each of the existing projects.

> This could be done by creating a custom migration and running these updates through the Project Maker pageComponent UI, but you will need to be careful when consuming future template updates.

---
[Developer Guide](../README.md) < Back