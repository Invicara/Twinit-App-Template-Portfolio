# Developer Guide: Template Portfolio Twinit Application Template

The Developer Guide helps you:

* Set up a default project using the template package zip (**portfolio-template.zip**) and the Twinit extension (New Project → Deploy Template to Project)
* Customize the template package (map types, structures, models, BIMPKs) in `setup/template packages/portfolioPkg`
* Deploy the Template Portfolio application and web client
* Customize and extend the template (theme, logo, etc.)

> **Required**: Template Portfolio requires a valid Twinit account and the ability to run or deploy a React web client. Completion of the Self-Led Developer training (including React UI) on [Twinit Academy](https://academy.twinit.io/) is recommended. The guide assumes you can use the Twinit VS Code extension and understand Twinit concepts such as projects, scripts, user configs, and ipa-core web clients.

## Setting up a default project (template package)

To create a new Twinit project and deploy the default Template Portfolio setup (map types, structures, optional site, optional models/BIMPKs):

1. **[Setting up a default project](./setup-default-project.md)** – Get **portfolio-template.zip** from the `setup` folder, create a new project in the Twinit extension (right-click application name → **New Project**), then right-click the project name and select **Deploy Template to Project**, and choose the zip.

To change what gets deployed (your own map types, structures, models, or BIMPKs):

2. **[Customizing the template package](./customize-template-package.md)** – Use the files and folders in `setup/template packages/portfolioPkg` to update map types, structures, graphic references, and to switch to your own models and BIMPKs. Put **GLBs, thumbnails, and BIMPKs** in **custom/customUploads/** (the setup does not use fileUploads for these). Extra files for later upload can use fileUploads. See the guide for details and how to re-zip and deploy.

## Full deployment (Twinit + web client)

To deploy the Template Portfolio application to Twinit and build/deploy the web client end to end, see the deploy steps in this guide (e.g. gather info, deploy template, build web client, test, deploy to cloud) if those documents exist in your repo.

## Customizing and extending the application template

* **[Customizing the template package](./customize-template-package.md)** – Change default map types, structures, models, and BIMPKs in `setup/template packages/portfolioPkg` and what each file does.

## Finding support

As you work through deployment or the template’s web client, you may have questions or run into issues.

* Visit the [digitaltwin-factory community](https://community.digitaltwin-factory.com/) for help.
* [Twinit Academy](https://academy.twinit.io/) – Training and concepts.
* [Knowledgebase](https://community.digitaltwin-factory.com/knowledgebase-5wzpkylt) – Common issues and solutions.
* [Ask the Community](https://community.digitaltwin-factory.com/ask-the-community) – Forum for questions.

---
[Home](../../README.md) < Back | Next > [User Guide](../user%20guide/README.md)
