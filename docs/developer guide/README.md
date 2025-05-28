# Developer Guide: Quick Model View Twinit Application Template

The Developer Guide provides information to guide developers through:

* Understanding the Twinit application implementation and data
* Deploying the Quick Model View Template for your users
* Consuming future updates to the template
* Ideas and examples for customizing and extending the template to suit your needs, including how to customize the theme and logo in your deployed web client

> **Required**: The Quick Model View Twinit Application Template requires that you have a valid Twinit account and that you are capable of running a React web client locally and/or deploying a React web client for your users. **As such it is mandatory that you have completed the Self-Led Developer training courses, including the React UI courses, on [Twinit Academy](https://academy.twinit.io/) prior to attempting to implement the Quick Model View Twinit Application** Steps outlined in the Developer Guide will assume you know how to work with the Twinit VS Code extension and that you have a working knowledge of Twinit concepts such as Workspaces/Projects, script and user configs, and how Twinit ipa-core based web clients function.

## Understanding How the Application Template Works

Before deploying your web client you should first have a general understanding of how it works. To proceed directly to deploying the template, while possible to do, is not the best way to proceed. It would be like learning how to turn the key to start a car, but not how to actually drive the vehicle.

Start by reading the [general introduction](./implementation/general-intro.md) to how the template works. This will provide enough information in order to proceed to deploying the template and its web client with confidence.

Later, when you are ready, explore the in-depth implementation documentation to gain a very detailed understanding of the template and how it works.

## New Deployments of the Quick Model View Twinit Application Template

If you have not yet deployed the Quick Model View template, proceed with the steps in this section. If you have a previously deployed instance of the Quick Model View template, skip to the **Updating Existing Quick Model View Templates** section below.

Once you have read the [general introduction](./implementation/general-intro.md) to the template you can proceed with deploying it for the first time.

To deploy the Quick Model View Twinit Application Template to Twinit and to deploy the web client, follow these steps in order:

1. [Gather Necessary Info and Check Twinit Access](./deploy/d1-gather.md)
2. [Deploy the Application Template to Twinit](./deploy/d2-deploy-twinit.md)
3. [Build and Run the Web Client](./deploy/d3-webclient.md)
4. [Test the Template](./deploy/d4-test.md)
5. [Deploy the Web Client for Users](./deploy/d5-deploy-to-cloud.md)

## Updating an Existing Quick Model View Template to 2.0.0

If you have already deployed an earlier version of the Quick Model View and wish to update your deployment to the the current version, please refer to the [Developer Update Guide](./update/README.md)

## In-Depth Knowledge of the Application Template

You can drill down further into the details of the template and how it works in the In-Depth Guides blow. These guides describe the low level details of the template and its inner workings. If you are looking to make changes to the template code or configuration to add your own use cases, you'll want to make sure you read the In-Depth guides first.

* [In-Depth: The Template Web Client](./implementation/imp-webclient.md)
* [In-Depth: Quick Model View Manager](./implementation/imp-projmake.md)
* [In-Depth: Quick Model View Projects](./implementation/imp-qmvprojects.md)
* [In-Depth: Template Data Model](./implementation/imp-data-model.md)
* [In-Depth: Template Permissions](./implementation/imp-perms.md)

## Customizing and Extending the Application Template

Since the template provides all the Twinit scripts and user configs, and web client source code, you can take the template and make it your own. Here are some common customization or additions you may wish to make and how to go about implementing them.

* [Change the Logo in the Web Client](./customize/change-logo.md)
* [Change the Title of the App in the Web Client](./customize/change-name.md)
* [Change the Theme Colors in the Web Client](./customize/change-theme.md)
* [Customize Your Email Invitations](./customize/customize-email.md)

## Future Updates

Future updates to the Quick Model View could include:

* Moving the Twinit logic in ModelContext into Twinit Object Model API endpoints that the web client will use instead of directly using the Twinit APIs
* Allow other custom components to be loaded in the bottom panel of the SimpleViewerView pageComponent
* Additional element table capabilities like hiding columns or removing selected properties from the table

## Finding Support

As you work through the deployment of the template or the template's web client, you may encounter issues or have questions about what you are doing.

Be sure to visit the [digitaltwin-factory community](https://community.digitaltwin-factory.com/) to find help.

You'll find easy reference links to [Twinit Academy](https://community.digitaltwin-factory.com/cohorts-npcs64ni) if you need to quickly refresh your memory on topics covered in the training.

The [Knowledgebase](https://community.digitaltwin-factory.com/knowledgebase-5wzpkylt) is a growing library of common issues and their solutions to help keep you working.

And a community of developers are waiting to answer your questions in the [Ask the Community forum](https://community.digitaltwin-factory.com/ask-the-community).

[![dtf logo](../img/dtfactoryv3.png)](https://community.digitaltwin-factory.com/)

---
[Home](../../README.md) < Back | Next > [User Guide](../user%20guide/README.md)