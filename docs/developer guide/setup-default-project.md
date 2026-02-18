# Setting up a default project with the Template Portfolio template package

This guide explains how to create a new Twinit project and deploy the Template Portfolio template package so the project is pre-configured with map types, structures, optional default site, and optional models/BIMPKs.

You will use the **Twinit VS Code extension** and a **template package zip** from this repository’s `setup` folder.

> **Note**: You need the Twinit VS Code extension (version 7.0.0 or later for template package deploy). You must be signed in to Twinit and have your **Template Portfolio** (or similarly named) application selected.

---

## 1. Get the template package zip

The template package lives in:

**`setup/template packages/portfolioPkg`**

You have two options:

- **Option A – Use a pre-built zip**  
  If your repository or build provides a zip in the `setup` folder (e.g. `setup/portfolioPkg.zip` or `setup/portfolio-template.zip`), use that file in step 4.

- **Option B – Create the zip yourself**  
  1. Open the repository on your machine.  
  2. Go to **`setup/template packages/portfolioPkg`**.  
  3. Select all contents (or the whole `portfolioPkg` folder).  
  4. Create a zip archive (e.g. **`portfolio-template.zip`**).  
  5. Place the zip in the **`setup`** folder of the project, or remember its path for step 4.

The zip must contain the template package contents (e.g. `manifest.json`, `custom/`, `scripts/`, `configs/`, etc.) as they appear inside `portfolioPkg`.

---

## 2. Create a new project in the Twinit extension

1. In the Twinit extension panel, find your **application name** (e.g. **Template Portfolio**).
2. **Right-click the application name**.
3. Select **New Project**.
4. When prompted:
   - Enter a **project name** (e.g. *Portfolio Project 1*).
   - Enter a **project description** (optional).
   - Enter a **project short name** (e.g. *portfolio1*).

A new project appears under your application:

```
TWINIT
├─ Template Portfolio
│  ├─ Portfolio Project 1 (p)
```

---

## 3. Deploy the template package to the new project

1. In the Twinit extension, **expand the new project** you created.
2. **Right-click the project name** (e.g. *Portfolio Project 1*).
3. Select **Deploy Template to Project** (or **Deploy Template Package**, depending on your extension version).
4. When prompted to select a template package, choose the **zip file** you prepared in step 1:
   - Go to the **`setup`** folder of this repository (or where you saved the zip).
   - Select the template package zip (e.g. **`portfolio-template.zip`**).
5. Confirm and wait for the deployment to finish. The deploy log will show progress (map types, structures, graphic references, optional default site, Mapbox secret, and optional BIMPK import).

When deployment completes, the project will have scripts, user configs, map types, structures, and optionally default site and pre-imported models as defined in the template package.

You can now use this project in the web client. To change what gets deployed next time, see [Customizing the template package](./customize-template-package.md).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Get the template package zip from `setup` (or create it from `setup/template packages/portfolioPkg`). |
| 2 | In the Twinit extension: **right-click the application name** → **New Project** and fill in name/description/short name. |
| 3 | **Right-click the new project name** → **Deploy Template to Project** and select the zip from the `setup` folder. |

---
[Developer Guide](./README.md) < Back | Next > [Customizing the template package](./customize-template-package.md)
