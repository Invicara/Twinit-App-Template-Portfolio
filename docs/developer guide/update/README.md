# Quick Model View Developer Update Guide

The Quick Model View Developer Update Guide will want you through updating a 2.0.0 version of the template to 2.1.0.

## Update Support

The template is versioned using [semantic versions](https://semver.org/). The template version reflects a major, minor, and patch version separated by dots like so: \<major\> "." \<minor\> "." \<patch\>. For instance a version of 1.2.3 would have a major version of 1, a minor version of 2, and a patch version of 3.

Updates are supported from only one template minor release older. If you need to update from a previous release older than one minor release version, you must go back to the previous release tags and apply all updates in order.

For instance, given only these four release versions:

* 1.1.2
* 1.1.3
* 1.2.1
* 1.3.0

These upgrades would be supported:

* 1.1.2 -> 1.1.3
* 1.1.2 -> 1.2.1
* 1.2.1 -> 1.3.0

These upgrades would **not** be supported:

* 1.1.2 -X-> 1.3.0
* 1.1.3 -X-> 1.3.0

Migrating from 1.1.2 to 1.3.0  would require these updates in this order:

1. 1.1.2 -> 1.2.1
2. 1.2.1 -> 1.3.0

Each template release has its corresponding tag in the GitHub repository allowing you to easily find a previous release and its update documentation.

## Updating to 2.1.0

> **BEFORE UPDATING QUICK MODEL VIEW**: You must first make sure your Twinit VS Code extension is version 6.2.2 or newer. If you do not then the update process will not correctly deploy the template scripts to your Quick View Manager project.

Updating to 2.1.0 is seamless to users of Quick Model View. User will not be impacted during the update. The previous version of the web client will continue to function during the update. Once the new web client is deployed they will see the updated user interface.

> **Note**: It is highly recommended that you first test the update on a test deployment of the template. You can do this by creating a new deploy of the previous version of the template and then deploying this update to it.

> **A Note About Template Customizations**: If you have made any custom changes to the template, you will need to first merge the new version of the template with your custom changes. See the **Changes in 2.1.0** section below for a list of the changes in this version.

To update your existing deployed template follow these steps:

1. [Deploy template updates to Twinit](./updateTwinit.md)
2. [Deploy the updated web client](./updateWebclient.md)

> **IMPORTANT**: These steps will update the Quick Model View template and web client. To take advantage of all new updates, additional steps are required by Admin users in each Quick Model View project. Be sure to consult the [User Guide](../user%20guide/README.md) for more information.

## Changes in 2.1.0

1. [Model and Model Element File Attachment](./details/files.md)
2. [Secrets and Mapbox](./details/secrets.md)
3. [Web Client Changes](./details/webclient.md)