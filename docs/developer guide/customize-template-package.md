# Customizing the Template Portfolio template package

The template package is in **`setup/template packages/portfolioPkg`**. It defines what gets deployed when you run **Deploy Template to Project** in the Twinit extension: scripts, user configs, map types, structures, graphic references, optional default site, and optional models (BIMPKs). By editing the files and folders in `portfolioPkg`, you can change the default project setup without changing the web client code.

This guide describes the main parts of the template package and how to customize them (including switching to your own models and BIMPKs, and updating map types and structures).

---

## Template package layout

Typical structure:

```
setup/template packages/portfolioPkg/
├── manifest.json              # Template metadata and list of scripts, configs, collections, etc.
├── custom/
│   ├── setupMyTemplate.mjs    # Custom setup script run during deploy
│   └── customUploads/         # Data files used by the setup script
│       ├── mapTypes.json
│       ├── structures.json
│       ├── baseGraphicReferences.json
│       └── bimpk-files.json   # Optional: list of .bimpk files to import
├── itemsToCreate/
│   └── default-site.json     # Optional default site(s) created in the project
├── configs/                  # User config templates (Admin, Viewer, etc.)
├── scripts/                  # Scripts (Project Maker, importHelper, mapbox, etc.)
├── omapiConfig/              # API config (e.g. entities_api.json)
└── (fileUploads or root)     # Optional: GLB, PNG, .bimpk files referenced by manifest or setup
```

The **manifest** tells the platform what to create (scripts, configs, collections, orchestrators, etc.). The **custom setup script** (`custom/setupMyTemplate.mjs`) runs after the platform has created those items and uses the JSON files in **custom/customUploads/** to create map types, graphic references, structures, default site, and optionally upload and import BIMPKs.

---

## manifest.json

**Purpose**: Defines the template name, version, and everything the platform should create when the template is deployed (scripts, user configs, named collections, orchestrators, user groups, and which files are part of the package).

**Key sections**:

- **setupScript**: Path to the custom setup script, e.g. `custom/setupMyTemplate.mjs`. This script runs after the platform has created the items listed in the manifest.
- **configs**: User config templates (e.g. QuickViewAdminConfigTemplate, QuickViewViewerConfigTemplate).
- **scripts**: Scripts such as Project Maker, importHelper, mapbox, mmv_config, mapTypeActions, types_and_graphrefs_setup, omapi_entities.
- **namedUserCollections**: Collections that will exist in the project (e.g. Buildings Collection, Sites Collection, Secrets Collection).
- **orchestrators**: e.g. Import BIMPK Models, Request MapBox Token.
- **userGroups** / **userGroupToUserConfig**: Which group gets which config.
- **itemsToCreate**: Optional. Describes default data to create (e.g. collection + JSON file for default site). The custom setup script can also create default site data.
- **files**: List of file names (and paths/tags) that the platform may upload and attach to the project. Include here any **.glb**, **.png**, or **.bimpk** files you want the platform to add so the setup script can use them.

**Customization**: Edit names, add/remove scripts or configs, add/remove collections or orchestrators, or change the list of **files** when you add or remove GLBs, thumbnails, or BIMPKs.

---

## custom/customUploads/ – map types, structures, graphic references

The setup script reads these JSON files from **`custom/customUploads/`** and uses them to create or update map types, graphic references, and structures in the project.

### mapTypes.json

**Purpose**: Defines the **entity schemas** (map types) used for **sites** and **buildings** in the portfolio. Each object describes the properties (and their types, titles, descriptions) for that entity.

**What it does**: The setup script creates or recreates the **map_types** collection and populates it with the objects in this file. The web client and map use these to know which fields exist on sites and buildings (e.g. `siteId`, `name`, `address`, `StatusId`, `Type`, etc.).

**Customization**:
- Add or remove properties.
- Add new entity types (e.g. another map type).
- Change titles, types, or validation.
- Keep `building` and `site` (or whatever the app expects) if the UI assumes those names.

**Example (conceptually)**: An array of schema objects; one might have `"title": "building"` with properties like `buildingId`, `name`, `siteId`, `StatusId`, `Type`, etc., and another `"title": "site"` with `siteId`, `name`, `address`, etc.

---

### baseGraphicReferences.json

**Purpose**: Defines the **map graphic references** by **name**. Each entry is a reference that will later be linked to a GLB (3D graphic) and a thumbnail image.

**What it does**: The setup script creates items in the **map_graphic_references** collection with these names. It then looks for files **`{name}.glb`** and **`{name}-thumbnail.png`** (or `.jpg`/`.jpeg`) in the package (e.g. under `fileUploads/` or `custom/customUploads/`), uploads them, and links the graphic and thumbnail file IDs to each reference.

**Customization**:
- Add or remove entries (each has at least `name`).
- Use the same names as in **structures.json** so each structure can reference a graphic by name.
- Ensure the corresponding **.glb** and **-thumbnail.*** files exist in the package and are listed in **manifest.json** **files** (or placed in a path the setup script reads).

**Example**:
`[{"name":"exchange"},{"name":"medical"}]`  
Then you need `exchange.glb`, `exchange-thumbnail.png`, `medical.glb`, `medical-thumbnail.png` in the package.

---

### structures.json

**Purpose**: Defines the **map structures** that appear on the map. Each structure is linked to a **map graphic reference** (by name) and can carry metadata (e.g. model name, required background properties).

**What it does**: The setup script creates or recreates the **map_structures** collection. For each structure it resolves **mapGraphicRefId** from the **name** (matching **baseGraphicReferences.json**). So each structure has a **name** that must match a graphic reference name, and can have **modelName**, **structureMetadata**, **requiredBackgroundProperties**, etc.

**Customization**:
- Add or remove structures.
- Change **name** to match an entry in **baseGraphicReferences.json** (and add that reference and its GLB/thumbnail if new).
- Set **modelName** to the model name your app expects (e.g. after importing a BIMPK).
- Leave **mapGraphicRefId** as-is in the file; the setup script fills it from the graphic references it creates. If you add a new reference in **baseGraphicReferences.json**, add a structure with the same **name**.

**Example**:
`[{"name":"medical","modelName":"General Medical - Architecture2024",...},{"name":"exchange","modelName":"EX11034-INV-Federated",...}]`

---

## Switching to your own models and BIMPKs

To use your own 3D models and BIMPKs instead of the defaults:

1. **Add your files to the template package**
   - **GLB + thumbnails**: For each graphic you want (e.g. `mystructure`), add:
     - `mystructure.glb`
     - `mystructure-thumbnail.png` (or `.jpg`/`.jpeg`)
   - Put them in **`fileUploads/`** or **`custom/customUploads/`** inside `portfolioPkg`, and list them in **manifest.json** under **files** (so the platform includes them in the package).

2. **Update baseGraphicReferences.json**
   - Add an entry for each new graphic, e.g. `{"name":"mystructure"}`.
   - Remove or keep existing entries depending on whether you still use those graphics.

3. **Update structures.json**
   - Add a structure with **name** matching the new graphic reference.
   - Set **modelName** to the **exact** model name that will exist in the project after you import your BIMPK (the name users see in the app).
   - Remove or update existing structures if you drop or rename models.

4. **BIMPKs**
   - Add your **.bimpk** files to the package (e.g. in **fileUploads/** or **custom/customUploads/**) and list them in **manifest.json** **files**.
   - The setup script will either:
     - Find .bimpk files in the project’s file collections (if the platform added them from **files**), or
     - Read from the package (e.g. **custom/customUploads/bimpk-files.json** plus the actual .bimpk files) and upload them, then run the BIMPK importer for each.
   - If you use **bimpk-files.json**, update it to list the exact .bimpk file names you include.
   - After import, the **model name** in Twinit (used in the app and in **structures.json**) is typically derived from the BIMPK; set **modelName** in **structures.json** to match that name.

5. **Re-zip and deploy**
   - Zip the updated **portfolioPkg** (or the folder that contains manifest + custom + files).
   - Use **Deploy Template to Project** and select the new zip so the project gets your map types, structures, and models.

---

## custom/customUploads/bimpk-files.json

**Purpose**: Optional. Lists the **.bimpk** file names that the setup script should import when the platform has not already added them to file collections. The setup reads from the package (e.g. **fileUploads/** or **custom/customUploads/**), uploads each listed file, and runs the BIMPK importer.

**Customization**: Update the list to match the .bimpk files you put in the package. Ensure those files are in the package and, if required by your manifest, listed in **manifest.json** **files**.

---

## itemsToCreate and default site

**itemsToCreate** in the manifest can point to a collection and a JSON file (e.g. **default-site.json**) so the platform or the setup script can create initial site (and related) data.

**default-site.json** (under **itemsToCreate/**) typically contains an array of site entities with:

- **name**: Display name of the site.
- **siteId**: Stable ID (e.g. `default-site-1`) so the setup script can replace or recreate a single default site on each deploy.
- **coordinates**: GeoJSON-style polygon for the site boundary.
- Other fields allowed by your **map_types** site schema (e.g. **address**).

The **custom setup script** may also create or replace the default site by deleting existing related items with a given **siteId** (e.g. `default-site-1`) and creating related items from **itemsToCreate/default-site.json**. So you can:

- **Change the default site**: Edit **itemsToCreate/default-site.json** (name, coordinates, siteId, address, etc.).
- **Add more default sites**: Add more objects to the array or more files and manifest entries.
- **Disable default site**: Remove or comment out the itemsToCreate entry and any default-site logic in **custom/setupMyTemplate.mjs**.

---

## custom/setupMyTemplate.mjs

**Purpose**: The custom setup script run during **Deploy Template to Project**. It runs after the platform has created scripts, configs, and collections from the manifest.

**What it typically does** (in order):

1. **Map types** – Create/recreate **map_types** from **custom/customUploads/mapTypes.json**.
2. **Graphic references** – Create **map_graphic_references** from **custom/customUploads/baseGraphicReferences.json** (name only at first).
3. **Structures** – Create **map_structures** from **custom/customUploads/structures.json**, linking each structure to the matching graphic reference by name.
4. **GLB and thumbnails** – For each graphic reference name, read **{name}.glb** and **{name}-thumbnail.*** from the package (e.g. fileUploads then custom/customUploads), upload them, create file items, and update the graphic reference with graphic and thumbnail file IDs.
5. **Mapbox secret** – Add the Mapbox secret to the Secrets collection (if configured).
6. **Default site** – Delete existing default site by **siteId** and create default site(s) from **itemsToCreate/default-site.json** (if the script implements this).
7. **BIMPK import** – Find .bimpk files in file collections or read from the package (e.g. **bimpk-files.json** + files), upload if needed, and run the BIMPK importer for each.

**Customization**: Usually you do **not** need to change the setup script when you only change data (map types, structures, your own GLBs/BIMPKs). If you add a new kind of entity or step, you would edit this script and re-zip the template package.

---

## Summary table

| File or folder | Purpose |
|----------------|--------|
| **manifest.json** | Template metadata; list of scripts, configs, collections, orchestrators, files. |
| **custom/setupMyTemplate.mjs** | Custom setup: map types, graphic refs, structures, GLB/thumbnail upload, Mapbox secret, default site, BIMPK import. |
| **custom/customUploads/mapTypes.json** | Schema definitions for map entities (e.g. site, building). |
| **custom/customUploads/baseGraphicReferences.json** | Names of map graphic references (GLB + thumbnail linked by setup). |
| **custom/customUploads/structures.json** | Map structures; each references a graphic by **name** and can set **modelName**. |
| **custom/customUploads/bimpk-files.json** | Optional list of .bimpk file names to import from the package. |
| **itemsToCreate/default-site.json** | Optional default site(s) created in the project. |
| **configs/** | User config templates. |
| **scripts/** | Scripts (Project Maker, importHelper, mapbox, etc.). |

To **update map types or structures**: Edit the JSON files in **custom/customUploads/** and re-zip the template package, then run **Deploy Template to Project** again (or create a new project and deploy).

To **switch models and BIMPKs**: Add your GLBs, thumbnails, and .bimpk files to the package; update **baseGraphicReferences.json**, **structures.json**, and optionally **bimpk-files.json** and **manifest.json** **files**; then re-zip and deploy.

---
[Setting up a default project](./setup-default-project.md) < Back | [Developer Guide](./README.md)
