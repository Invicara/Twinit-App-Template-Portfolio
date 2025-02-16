## Run Local Development

Before you can run the client you first need to be able to install dependecies from the @invicara and @dtplatform private npm repos.
TO help with this, an .npmrc file was created by create-twinit-app that will allow you to connect to these private repositories.
In order for the .npmrc file to work, you must set three environments on your system with your credentials.
Instruction on how to do this are available on [twnit.dev](https://twinit.dev/docs/apis/javascript/npm-install).
Be sure to follow those steps before going any further.

If you have created your environment variables and provided correct information when running create-twinit-app then to run the client all you need to do is:

1. npm install
2. npm run watch

## Build Deployable Client

The following command will build the client and write it to the build folder.

1. npm run build

## Setting up the Application

Quick Model View supports automated project creation via the projectMaker setup.

To setup the projectMaker:

1. Create a new Project for the Quick Model View application
2. Add the ```setup/[release number]/projectMaker/Project Maker.mjs``` script to the project with the _userType ```project-maker```. This script contains the logic for creating a new Quick Model View project.
3. Add the ```setup/[release number]/projectMaker/ProjectMakerConfig.json``` user config to the project with the _userType ```quick-view```. This is the user config for the project maker user interface and connects the user interface to the ```Project Maker``` script.
4. Add the ```setup/[release number]/projectMaker/configTemplates``` user config templates as user configs to your project. Be sure to name them ```QuickViewAdminConfig``` and ```QuickViewViewerConfig``` and give both of them the _userType ```quick-temp```. These are the user configs that will be used in the new projects that Project Maker creates.
5. Add the ```setup/[release number]/projectMaker/scriptTemplates``` script to your project. Be sure to name it ```importHelperTemplate``` and give it the _userType ```quick-temp```. This is the import script that will be added to the new project and used by the import orchestrator.
6. Create an Admin user group in the project using the vs code command.
7. Relate the ```ProjectMakerConfig (quick-view)``` user config to the Admin user group using the vs code command.

## Enabling a User to Create Projects

1. Add the user to the Quick Model Viewer App Developer User Group through the Twinit Console. This gives them permissions to create projects and user groups for the application.
2. Invite them via the Project Maker UI to the Project Maker project.