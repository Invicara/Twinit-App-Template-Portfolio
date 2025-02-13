# Quick Model View 1.3.0 Setup

Migration from 1.2.0 to 1.3.0 requires only updates the project maker user config and script, and a client deploy.

## Migration Steps

1. Update the ProjectMaker script (_userType: project-maker) with the contents of ```1.3.0/setup/ProjectMaker.mjs``` and commit as a New Version
2. Update the ProjectMakerConfig (_userType: quick-view) with the contents of ```1.3.0/setup/ProjectMakerConfig.json``` and commit as a New Version
3. Deploy the latest version of the client