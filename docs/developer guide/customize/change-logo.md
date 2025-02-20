# Change the Logo in the Web Client

The template provides a default Invicara logo for the web client. This logo appears in both the Project Maker and Quick Model View user interface and can be changed in each independently.

## Change the Logo

The logo can be changed by editing the user config templates in the Project Maker project, or editing the Project Maker user config, or editing the user configs in Quick Model View projects.

To change the logo you will add information to the "settings" in each user config. Specifically you will modify the "appImage" setting.

```json
"appImage": {

}
```

The "appImage" setting can provide a new logo image through either a URL or the name of a file you have uploaded to the File Service in the project.

To use a URL for an image:

```json
"appImage": {
   "url": "https://url.to.my/logo_file.png"
}
```

To use a file name of a file that you have upload to the project: 

```json
"filename": "name_of_my_image_file.jpg"
```

## Where to Make Logo Changes

There are potentially three places you will need to make the setting change to display a different logo depending on where you want the logo to appear.

### Project Maker User Interface

If you wish the new logo to appear in the Project Maker user interface, you'll need to modify the ProjectMakerConfig in the "QMV Project Maker" project.

### Newly Created Quick Model View Projects

If you wish the new logo to appear in newly created Quick Model View projects, you'll need to modify the QuickViewAdminConfigTemplate and QuickViewViewerConfigTemplate in the "QMV Project Maker" project.

### Existing Quick Model View Projects

If you wish to update existing Quick Model View projects to display the new logo, you'll need to modify the QuickViewAdminConfig and QuickViewViewerConfig in each of the existing projects.

> This could be done by creating a custom migration and running these updates through the Project Maker UI, but you will need to be careful when consuming future template updates.

### Using a File Name for the Logo

If you choose to use a file name to provide the logo, you will have to make sure that the logo file has been uploaded to each and every project. This means that you will have to modify the ProjectMaker script that creates new Quick Model View projects. Specifically you will need to:

1. Upload the logo file to the Project Maker project
2. Update the user config templates with the appImage filename setting
3. Update the Project Maker script to upload the logo to each new Quick Model View project during the creation process

---
[Developer Guide](../README.md) < Back