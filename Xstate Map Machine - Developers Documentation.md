# 📄 Map Machine – Developer Documentation

## Overview

This system uses an **XState v5 hierarchical state machine** (`mapMachine`) to handle:

* Loading and preparing map layers
* Navigating between different hierarchical levels of a portfolio (e.g. portfolio → site → building → model element)
* Automatically fetching and displaying features on the map based on configuration

The state machine is dynamically generated from **`namedPaths`** — a configuration that defines:

* The **hierarchy of states**
* Optional **IDs** for navigation context
* Whether a level has a **feature layer** (polygon/point/etc.)
* The **API endpoint** to fetch the data for that level

---

## Example Entry Point

```javascript
const DEFAULT_PATHS = [
    [
        { state: 'portfolio', idKey: null },
        { state: 'site', idKey: 'siteId', feature: "polygon", api: "site/all" },
        { state: 'building', idKey: 'buildingId', feature: "point", api: "building/all" },
        { state: 'modelElement', idKey: 'modelElementId' },
    ]
];

export default function PortfolioOverview({ handler }) {
    const namedPathsConfig = handler?.componentConfig;
    const namedPaths = useMemo(() => namedPathsConfig?.namedPaths || DEFAULT_PATHS, []);
    const machineDef = useMemo(() => createMachine("mapMachine", namedPaths), [namedPaths]);
    const [snapshot, send, actor] = useMachine(machineDef);

    useEffect(() => {
        const subscription = actor.subscribe((state, e) => {
            console.log("PortfolioOverview Machine state changed", state, {
                state: JSON.parse(JSON.stringify(state.value))
            });
        });
        return () => subscription.unsubscribe();
    }, [actor]);

    const currentState = useSelector(actor, state => state);

    return (
        <Grid container style={{ height: "100%" }}>
            <Grid item style={{ width: 400, height: '100%' }}>
                <StatePanel currentState={currentState} context={currentState.context} send={actor.send} />
            </Grid>
            <Grid item xs style={{ height: "100%" }}>
                <MapboxMap onMapReady={(map) => actor.send({ type: 'MAP_READY', map })} />
            </Grid>
        </Grid>
    );
}
```

---

## 🔹 How `namedPaths` Works

The `namedPaths` array **drives almost all automation**:

Each **path** is an array of levels:

```js
[
    { state: 'portfolio', idKey: null },
    { state: 'site', idKey: 'siteId', feature: "polygon", api: "site/all" },
    { state: 'building', idKey: 'buildingId', feature: "point", api: "building/all" },
    { state: 'modelElement', idKey: 'modelElementId' }
]
```

### Keys in each level:

* **`state`** – The state name in the hierarchy
* **`idKey`** – Context property used for navigation (`null` for top level)
* **`feature`** *(optional)* – `"polygon"`, `"point"`, etc. → triggers automatic feature layer creation
* **`api`** *(optional)* – REST endpoint used to fetch data for this level

---

## 🔹 State Machine Flow

### Top-Level Flow

1. **`awaitingMap`** → waits for `MAP_READY` event
2. **`addLayers`** → runs a service to:

    * Call APIs for each `feature`-enabled level in `namedPaths`
    * Add the corresponding layers to the map
3. **`idle`** → ready for navigation

---

### Navigation with `GO_TO`

* Sending `GO_TO` changes the state and updates context IDs
* If changing from one branch to another → goes through `confirmExit`
* `confirmExit` runs **entry actions** for the target state once confirmed

---

## 🔹 Entry Actions

The function `getEntryAction({ stateValue, context, event, self })` is run **every time** you enter a state (unless suppressed).

**Currently**, most `getEntryAction` implementations:

* **Zoom to the relevant features** for that state

**Developers should extend this to:**

* Add **HTML graphics** to the map
* Apply **theming/styling** to layers
* Show/hide layers depending on the state
* Trigger analytics or logging

---

## 🔹 API Requirements

If a level in `namedPaths` has both:

* `feature` defined
* `api` defined

Then:

1. The service will call that API (`/site/all`, `/building/all`, etc.)
2. It will create a corresponding Mapbox layer (`site-features-layer`, `building-features-layer`, etc.)
3. It will store features in the context for later zooming and selection

---

## 🔹 Adding a New Level

1. Add an object to the appropriate path in `namedPaths`:

```js
{ state: 'floor', idKey: 'floorId', feature: 'polygon', api: 'floor/all' }
```

2. Make sure the API exists and returns GeoJSON or an array with geometry
3. Update `getEntryAction` if you need special behavior on entering `floor`
4. Optionally, extend the `mapUtils` click handler to respond to floor clicks

---

## 🔹 Map Click Behavior

A **generic click handler**:

* Checks which feature layers were clicked
* Extracts the `idKey` from the clicked feature properties
* Sends a `GO_TO` event with all relevant IDs
* Nulls IDs for deeper levels if you’re “bubbling up”

**Important:**
If you want to **always have ancestor IDs** (e.g., clicking a building also sets `siteId`), make sure those IDs are included in the feature’s `properties`.

---

## 🔹 Extending the Machine

### Where to Look:

* **`namedPaths`** → defines hierarchy, features, APIs
* **`getEntryAction`** → handles map updates on state entry
* **`addLayersService`** → fetches data & adds layers
* **`mapUtils`** → contains generic helpers for zooming, adding layers, handling clicks

---

## 🔹 Key Developer Tasks

* **Verify API endpoints exist** for all `feature` levels in `namedPaths`
* **Include ancestor IDs** in feature properties to simplify navigation
* **Extend `getEntryAction`** for richer UI/UX:

    * Add custom HTML overlays
    * Style layers differently per state
    * Toggle layer visibility
* **Ensure map click handling** works for all feature layers

---

## Diagram – Example Hierarchy

```
portfolio
  ├─ idle
  ├─ site
  │   ├─ idle
  │   ├─ building
  │   │   ├─ idle
  │   │   ├─ modelElement
  │   │       ├─ idle
```

---
TODO: applying filters (+ optionally if UI fires many FILTERS_CHANGED in a row, debounce to reduce setFilter calls)
```
actions: {
  scheduleApplyFilters: ({ self }) => {
    clearTimeout(self._filtersTid);
    self._filtersTid = setTimeout(() => self.send({ type: 'APPLY_FILTERS_NOW' }), 120);
  }
},
on: {
  FILTERS_CHANGED: {
      // 1) store filters (with shallow diff to avoid no-op updates)
      assign(({ context, event }) => {
        const next = event.filters || {};
        const same = JSON.stringify(context.filters) === JSON.stringify(next);
        return same ? {} : { filters: next };
      }),
      // 2) apply to the map
      'scheduleApplyFilters'
    ]
  },
  APPLY_FILTERS_NOW: { actions: 'applyMapFilters' }
}
```
and here possible new setup:
```
const buildExpression = (rules) => {
  // rules: { prop: value | [values] | null }
  // null → ignore; scalar → '=='; array → 'in'
  const clauses = [];

  for (const [prop, val] of Object.entries(rules || {})) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      // ['in', ['get', prop], ['literal', val]]
      clauses.push(['in', ['get', prop], ['literal', val]]);
    } else {
      clauses.push(['==', ['get', prop], val]);
    }
  }

  return clauses.length ? ['all', ...clauses] : true; // true → no-op filter
};

const layerIdFor = (stateName) => `${stateName}-features-layer`; // same convention used when adding layers

export const createMachine = (id, paths, opts = {}) => {
  const machineDef = generateMapMachine(id, paths, { addLayersService: 'addLayersService' });

  return setup({
    actions: {
      applyMapFilters: ({ context }) => {
        const map = context.map;
        if (!map || !context.filters) return;

        // apply per-level filters if that level has a feature layer
        for (const path of paths) {
          for (const lvl of path) {
            if (!lvl.feature) continue; // only levels that rendered map layers
            const layerId = layerIdFor(lvl.state);
            if (!map.getLayer(layerId)) continue;

            const rules = context.filters[lvl.state];
            const expr = buildExpression(rules);
            try {
              map.setFilter(layerId, expr);
            } catch (e) {
              // guard against bad expressions; don't crash the app
              console.warn('setFilter failed for', layerId, rules, e);
            }
          }
        }
      },
    },
    actors: {
      addLayersService: fromPromise(async ({ input }) => {
        return addLayers(input);
      })
    }
  }).createMachine(machineDef);
};
```
to show hide entire layers:
```
map.setLayoutProperty(layerId, 'visibility', shouldShow ? 'visible' : 'none');
```

we can subscribe to redux store and send the filters:
```
actor.send({ type: 'FILTERS_CHANGED', filters: selectFilters(store.getState()) })
```

the filters could look like this:
```
 { [level]: { prop: value|[values]|null } }
```

