# Model Import Script Changes

The model import script was updated to support the new model search capabilities. To make searching the model by properties on the model efficient, the import script now pot processes the imported model. The post processing produces a list of unique type and instance properties that exist across all model elements. It then caches the list of unique property references within the model data.

The cached property references are then used by the user interface to quickly display a list of properties that can be used to search for model elements.

## Script Changes

The [model data cache collection](../../implementation/data/imported-model.md) is not new. However the import script now writes new items into it.

The post processing is initiated in the [createModelDataCache function](../../../../setup/scripts/importHelperTemplate.mjs#L1725) of the importHelper script where [cachePropertyReferences is called](../../../../setup/scripts/importHelperTemplate.mjs#L1731).

The [cachePropertyReferences function](../../../../setup/scripts/importHelperTemplate.mjs#L1694) gets all property items from the instance and type property collections for the model, compiles the unique list of properties as determined by the [property set name and the property display name](../../../../setup/scripts/importHelperTemplate.mjs#L1672).

The script then [writes the items to the data cache as 'propertyReference' items](../../../../setup/scripts/importHelperTemplate.mjs#L1617).

Here is an example property reference item:
```json
{
  "dataType": "propertyReference",
  "property": {
    "propSetName": "No Property Set",
    "propertyType": "instance",
    "dName": "System.elementId",
    "key": "SystemelementId",
    "srcType": "INTEGER"
  },
  "_id": "67c77bxxxxxc0ea0c",
  "_metadata": {
    "_updatedById": "da630aa1-xxxxx-04dea7ec70",
    "_createdAt": 1741126610225,
    "_createdById": "da630aa1-xxxxx-04dea7ec70",
    "_updatedAt": 1741126610225
  }
}
```

---
[Developer Update Guide](../README.md) < Back