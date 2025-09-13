//TODO: replace this script with MMV COMMANDS
import mapboxgl from 'mapbox-gl';
import { point, multiPoint,
    lineString, multiLineString,
    polygon, multiPolygon, featureCollection } from '@turf/helpers';
import {IafProj, IafSession} from "@dtplatform/platform-api";
import { MMV_COMMANDS } from '@invicara/ipa-core-mmv';
import {v4 as uuid} from "uuid"
import bbox from "@turf/bbox";
import centroid from "@turf/centroid";
import {
    clearStaleMarkersByPath,
    makeMarkerShell,
    makePieCanvas,
    renderAllMarkers,
    zoomIntoClusterByExpansion
} from "./mapMarkers.mjs";
import {ScriptCache} from "@invicara/ipa-core/modules/IpaUtils/index.js";
import {isColorProp, normalizeColorRGB} from "./colorNormalization.mjs";
import { useDispatch, useSelector } from "react-redux";
import { selectIsSelectingPosition, selectSelectedCoordinate, setDraftSite, setIsSelectingPosition, setSelectedCoordinate } from '../../ipaCore/redux/siteSetup';
import { L } from '@table-library/react-table-library/styles-492c6342';

const getLevel = (stateName, namedPath) => namedPath.find(lvl => lvl.state === stateName);
function makeBinColorExpression(config) {
    const expr = ["case"];

    for (const bin of config.bins) {
        const conds = [];

        if (bin.min !== null && bin.min !== undefined) {
            conds.push([">=", ["coalesce", ["number", ["get", config.property], 0], 0], bin.min]);
        }
        if (bin.max !== null && bin.max !== undefined) {
            conds.push(["<", ["coalesce", ["number", ["get", config.property], 0], 0], bin.max]);
        }

        let cond = conds.length === 1 ? conds[0] : ["all", ...conds];
        expr.push(cond, bin.color);
    }

    // fallback color
    expr.push("#e30f0f");
    return expr;
}

/**
 * Build theming groups from a numeric bin config, supporting extra paint props
 * at the top level and per-bin.
 *
 * @param {mapboxgl.Map} map
 * @param {string} layerId                    // target layer id
 * @param {string} idKey                      // property holding feature id
 * @param {{
 *   property: string,
 *   bins: Array<{
 *     id: string,
 *     min: number|null,
 *     max: number|null,
 *     color?: any,
 *     label?: string,
 *     // ...any extra paint props, e.g. "circle-radius", "line-width", etc.
 *   }>,
 *   // Optional top-level defaults for all groups (e.g., "circle-radius": 7)
 *   [extraProp: string]: any
 * }} binConfig
 * @returns {{
 *   groupsObject: Record<string, { ids: string[], [prop:string]: any }>
 * }}
 */
function buildGroupsFromBins(map, layerId, idKey, binConfig) {
    const layer = map.getLayer(layerId);
    if (!layer) throw new Error(`Layer "${layerId}" not found`);

    const sourceId = layer.source;
    const src = map.getSource(sourceId);
    if (!src) throw new Error(`Source "${sourceId}" not found for layer "${layerId}"`);

    // Collect features we can access
    let features = [];
    if (src.type === 'geojson') {
        const data = src._data;
        features = Array.isArray(data?.features) ? data.features : [];
    } else if (src.type === 'vector') {
        const sourceLayer = layer['source-layer'];
        if (!sourceLayer) throw new Error(`Layer "${layerId}" is vector-backed but missing "source-layer"`);
        features = map.querySourceFeatures(sourceId, { sourceLayer });
    } else {
        throw new Error(`Unsupported source type for binning: ${src.type}`);
    }

    const propName = binConfig.property;
    const bins = binConfig.bins || [];

    // Determine which keys are "control" keys we shouldn't copy as paint props
    const CONTROL_KEYS = new Set(['id', 'min', 'max', 'label', 'ids']);

    // Extract top-level extra props to apply to every group (unless overridden)
    const topLevelExtras = Object.fromEntries(
        Object.entries(binConfig).filter(([k]) => !['property', 'bins'].includes(k))
    );

    // Prepare groups keyed by bin id, prefilled with top-level extras
    const groupsObject = {};
    for (const bin of bins) {
        const base = { ids: [] };

        // Start with top-level extras…
        for (const [k, v] of Object.entries(topLevelExtras)) {
            base[k] = isColorProp(k) ? normalizeColorRGB(v) : v;
        }
        // …then apply per-bin props (these override top-level extras)
        for (const [k, v] of Object.entries(bin)) {
            if (!CONTROL_KEYS.has(k)) {
                base[k] = isColorProp(k) ? normalizeColorRGB(v) : v; // includes 'color' and any explicit paint prop like 'circle-radius'
            }
        }
        groupsObject[bin.id] = base;
    }

    // Assign features to bins
    for (const f of features) {
        const props = f?.properties || {};
        const id = props?.[idKey];
        if (id == null) continue;

        const rawVal = props?.[propName];
        const val = typeof rawVal === 'number' ? rawVal : Number(rawVal);
        if (Number.isNaN(val)) continue;

        const bin = bins.find(b =>
            (b.min == null || val >= b.min) &&
            (b.max == null || val <  b.max)
        );
        if (bin) {
            groupsObject[bin.id].ids.push(String(id));
        }
    }

    return { groupsObject };
}


function extendBoundsFromCoords(bounds, coords) {
    if (typeof coords[0] === 'number') {
        // coords is [lng, lat]
        bounds.extend(coords);
    } else {
        // coords is nested array
        coords.forEach(c => extendBoundsFromCoords(bounds, c));
    }
}

function zoomToAllFeatures(map, sources) {
    const bounds = new mapboxgl.LngLatBounds();

    for (const srcId of sources) {
        const src = map.getSource(srcId);
        if (!src) continue;

        const data = src._data || src._options?.data;
        if (!data || data.type !== 'FeatureCollection') continue;

        for (const feature of data.features) {
            const coords =
                feature.geometry?.coordinates ??
                (Array.isArray(feature.geometry) ? feature.geometry : null) ??
                feature.properties?.coordinates;
            if (!coords) continue;
            extendBoundsFromCoords(bounds, coords);
        }
    }

    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40 });
    }
}
/**
 * @param {object} params
 * @param {object} params.map - Mapbox GL JS instance
 * @param {object} params.context - XState context, must include namedPaths
 * @param {string} [params.state] - e.g. "building" or "site"
 * @param {string|number} [params.featureId] - id to find within that state
 */
export function zoomToFeature({ map, context, state = null, featureId = null }) {
    if (!map || !context || !context.namedPaths) return;
    const namedPath = context.namedPaths[0];//TODO, select correct namedPath index

    let commands;
    if (state && featureId) {
        const level = getLevel(state, namedPath);
        if (!level || !level.idKey) return;

        commands = [{
            commandName: MMV_COMMANDS.ZOOM_TO,
            commandRef: uuid(),
            params: {
                elementId: featureId,
                extra: {
                    field: level.idKey,
                    layerNames: [`${level.state}-features-layer`],
                    cameraOptions: {
                        animate: true,
                        duration: 2700,
                        padding: 100
                    }
                }
            }
        }]

        context.mmvSend(commands);

        return {/*commands - soon we will be sending commands to queue them and schedule react and mapbox requests for main thread execution*/};
    }

    zoomToAllFeatures(map, namedPath.map(lvl => `${lvl.state}-features`));
}

// Fetch features and convert to GeoJSON for a level
export async function fetchFeaturesForLevel(levelDef, parentFeatures) {
    if (!levelDef.api) return [];
    const ctx = await IafProj.getCurrent();
    let data = [];
    try {
        const res = await fetch(endPointConfig.itemServiceOrigin+"/omapi/"+ctx._namespaces[0]+"/"+levelDef.api, {
            method: 'GET',
            mode: 'cors',
            headers: {
                Authorization: 'Bearer ' +  IafSession.getAuthToken(ctx),
                'Content-Type': 'application/json'
            },
        });
        let omapiResponse = await res.json();
        data = omapiResponse._result;
    } catch (e) {
        console.error(e);
    }

    if (levelDef.feature === 'point') {
        return data.filter(d => d.longitude && d.latitude).map(d => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(d.longitude), parseFloat(d.latitude)]
            },
            properties: { ...d }
        }));
    }
    if (levelDef.feature === 'polygon') {
        return data.map(d => ({
            type: 'Feature',
            geometry: d.coordinates,
            properties: { ...d }
        }));
    }
    return [];
}

function getFeatureLayers(namedPath) {
    return namedPath
        .map((lvl, i) => ({
            state: lvl.state,
            idKey: lvl.idKey || null,
            feature: lvl.feature || null,
            layerId: `${lvl.state}-features-layer`
        }))
        .filter(l => !!l.feature); // only states with feature layers
}
const CLICK_HANDLED = Symbol('map.click.handled');

export function isHandled(e) {
    return !!(e[CLICK_HANDLED] || (e.originalEvent && e.originalEvent[CLICK_HANDLED]));
}
export function markHandled(e) {
    e[CLICK_HANDLED] = true;
    if (e.originalEvent) e.originalEvent[CLICK_HANDLED] = true; // in case someone checks DOM event
}
/**
 * Generic Mapbox click handler that:
 * - detects the deepest clicked feature
 * - fills its own idKey and all ancestor idKeys
 * - nulls descendant idKeys (bubbling up)
 * - if nothing clicked, nulls all idKeys (go to top)
 *
 * @param {object} params
 * @param {mapboxgl.Map} params.map
 * @param {Array} params.namedPath - one path from namedPaths
 * @param {Function} params.send - xstate .send
 * @param {object} [params.context] - optional; can hold lookup indices
 * @param {number} [params.pixelTolerance=0] - optional radius in pixels
 * @param {Function} [params.getContext] - optional function to get current context for draft site checking
 */
export function makeMapOnClickHandler({ map, namedPath, send, context, pixelTolerance = 0, getContext }) {
    const featureLayers = getFeatureLayers(namedPath);
    const layerIds = featureLayers.map(l => l.layerId);

    return (e) => {
        if (isHandled(e)) return;
        // query features for all relevant layers (optionally with a tolerance box)
        const geometry = pixelTolerance > 0
            ? [
                [e.point.x - pixelTolerance, e.point.y - pixelTolerance],
                [e.point.x + pixelTolerance, e.point.y + pixelTolerance],
            ]
            : e.point;

        const hits = map.queryRenderedFeatures(geometry, { layers: layerIds });

        // bucket matches by state
        const byState = {};
        for (const def of featureLayers) {
            const f = hits.find(h => h.layer && h.layer.id === def.layerId) || null;
            byState[def.state] = f;
        }

        const event = { type: 'GO_TO' };

        // if nothing relevant clicked → bubble to top
        if (hits.length === 0) {
            featureLayers.forEach(def => {
                if (def.idKey) event[def.idKey] = null;
            });
            send(event);
            return;
        }

        // pick the deepest clicked feature (largest depth)
        let deepestIdx = -1;
        for (let i = featureLayers.length - 1; i >= 0; i--) {
            const def = featureLayers[i];
            if (byState[def.state]) { deepestIdx = i; break; }
        }

        // if none matched somehow, null all
        if (deepestIdx < 0) {
            featureLayers.forEach(def => {
                if (def.idKey) event[def.idKey] = null;
            });
            send(event);
            return;
        }

        // set the deepest id from its feature
        const deepestDef = featureLayers[deepestIdx];
        const deepestFeature = byState[deepestDef.state];
        if (deepestDef.idKey) {
            event[deepestDef.idKey] = deepestFeature?.properties?.[deepestDef.idKey] ?? null;
        }

        // back-fill all ancestors (walk up)
        for (let a = deepestIdx - 1; a >= 0; a--) {
            const anc = featureLayers[a];
            if (!anc.idKey) continue;

            // prefer a direct property on the deepest feature
            let value = deepestFeature?.properties?.[anc.idKey];

            // fallback: if the ancestor layer also has a hit at this point
            if (value == null && byState[anc.state]?.properties?.[anc.idKey] != null) {
                value = byState[anc.state].properties[anc.idKey];
            }

            event[anc.idKey] = value ?? null;
        }

        // null out descendants (we’re anchoring at deepestIdx)
        for (let d = deepestIdx + 1; d < featureLayers.length; d++) {
            const desc = featureLayers[d];
            if (desc.idKey) event[desc.idKey] = null;
        }

        send(event);
    };
}

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isPos = a => Array.isArray(a) && isNum(a[0]) && isNum(a[1]);

const closeRing = (ring) => {
    if (!Array.isArray(ring) || ring.length < 4) return ring;
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) return [...ring, [fx, fy]];
    return ring;
};

export function featureFromKnownType(type, coords, properties = {}) {
    if (!type) throw new Error('type is required');
    const t = String(type).toLowerCase();

    switch (t) {
        case 'point': {
            if (!isPos(coords)) throw new Error('Point coords must be [lng, lat]');
            return point(coords, properties);
        }
        case 'multipoint': {
            if (!Array.isArray(coords) || !coords.every(isPos))
                throw new Error('MultiPoint coords must be [[lng,lat], ...]');
            return multiPoint(coords, properties);
        }
        case 'linestring': {
            if (!Array.isArray(coords) || coords.length < 2 || !coords.every(isPos))
                throw new Error('LineString needs at least two positions [[lng,lat], ...]');
            return lineString(coords, properties);
        }
        case 'multilinestring': {
            if (!Array.isArray(coords) || !coords.every(r => Array.isArray(r) && r.length >= 2 && r.every(isPos)))
                throw new Error('MultiLineString must be [[[lng,lat],...], ...]');
            return multiLineString(coords, properties);
        }
        case 'polygon': {
            if (!Array.isArray(coords) || !Array.isArray(coords[0]) || !coords[0].every(isPos))
                throw new Error('Polygon must be [[[lng,lat],...], ...]');
            const rings = coords.map(closeRing);
            return polygon(rings, properties);
        }
        case 'multipolygon': {
            if (!Array.isArray(coords) || !Array.isArray(coords[0]) || !Array.isArray(coords[0][0]) || !coords[0][0].every(isPos))
                throw new Error('MultiPolygon must be [[[[lng,lat],...]], ...]');
            const polys = coords.map(poly => poly.map(closeRing));
            return multiPolygon(polys, properties);
        }
        default:
            throw new Error(`Unsupported geometry type: ${type}`);
    }
}

// Main function to add all feature layers from a namedPath
export async function addAllFeatureLayers({ map, namedPath, sendBack, getContext }) {
    const allFeatureLayers = {}
    let parentFeatures = [];
    for (const level of namedPath) {
        if (!level.feature) continue;

        const options = level.options || {};
        const clusterOptions = options.cluster || {};
        const {sourceOptions} = clusterOptions;

        const features = await fetchFeaturesForLevel(level, parentFeatures);
        parentFeatures = features; // propagate if needed
        allFeatureLayers[level.state] = features.map(f=>f.properties);

        const turfFeatures = features.map(f => {
            const coords = Array.isArray(f.geometry)
                ? f.geometry
                : f.geometry?.coordinates ?? f.properties?.coordinates;
            return featureFromKnownType(level.feature, coords, f.properties);
        });

        const fc = featureCollection(turfFeatures);

        console.log("Features",{level: level.state, fc});

        const sourceId = `${level.state}-features`;
        // Add or update source
        if (!map.getSource(sourceId)) {
            //console.log("adding features", sourceId, features, turfFeatures);
            try {
                let source = {
                    type: 'geojson',
                    data: fc,
                }
                if(sourceOptions){
                    source = {
                        ...source,
                        //...sourceOptions,
                        //clusterProperties: {
                        //    Capacity: ["+", ["get","Capacity"]]
                        //}
                    }
                }
                map.addSource(sourceId, source);
            } catch (e) {
                console.error(e);
            }
        } else {
            map.getSource(sourceId).setData({ type: 'FeatureCollection', features });
        }

        // Always add/update UNCLUSTERED layer
        if (!map.getLayer(`${sourceId}-layer`)) {
            map.addLayer({
                id: `${sourceId}-layer`,
                type: level.feature === 'point' ? 'circle' : 'fill',
                source: sourceId,
                filter: ['!', ['has', 'point_count']],
                paint: level.feature === 'point'
                    ? { 'circle-radius': 0.01, 'circle-color': '#fff' }//TODO: or also make invisible by default?
                    : { 'fill-color': '#fff', 'fill-opacity': 0.18 }//TODO: or also make invisible by default?
            });
            const handler = makeMapOnClickHandler({ map, namedPath, send: sendBack, getContext });
            map.on('click', handler);
            map.on('mouseenter', `${sourceId}-layer`,  () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', `${sourceId}-layer`,  () => { map.getCanvas().style.cursor = ''; });
        }
        // Optionally add/update CLUSTERED layer
        if (!map.getLayer(`${sourceId}-layer-clustered`) && level.feature === 'point' && sourceOptions?.cluster) {
            map.addLayer({
                id: `${sourceId}-layer-clustered`,
                type: 'circle',
                source: sourceId,
                filter: ['has', 'point_count'],
                paint: { 'circle-radius': 0.01, 'circle-opacity': 0 } // invisible
            });
        }

        // Always add/update centroids layer for polygon features
        if (!map.getLayer(`${sourceId}-centroids-layer-circle`) && (level.feature === "polygon" || level.feature === "multiPolygon")) {
            let centroidFeatures = turfFeatures.map(f => {
                const c = centroid(f);
                // copy over properties so pies can use them
                c.properties = { ...f.properties };
                return c;
            });
            const centroidFc = featureCollection(centroidFeatures);
            map.addSource(`${sourceId}-centroids`, { type: "geojson", data: centroidFc });

            map.addLayer({
                id: `${sourceId}-centroids-layer-circle`,
                type: 'circle',
                source: `${sourceId}-centroids`,
                paint: { 'circle-radius': 0.01, 'circle-opacity': 0 } // invisible
            });
        }
    }
    return allFeatureLayers;
}

// Function to add a single feature to an existing map layer
export function addFeatureToMapLayer({ map, levelState, feature, namedPath }) {
    const sourceId = `${levelState}-features`;
    const layerId = `${sourceId}-layer`;

    // Get the level definition to understand feature type
    const levelDef = namedPath.find(lvl => lvl.state === levelState);
    if (!levelDef || !levelDef.feature) {
        console.warn(`Level definition not found for state: ${levelState}`);
        return false;
    }

    try {
        // Get existing source
        const existingSource = map.getSource(sourceId);
        if (!existingSource) {
            console.warn(`Map source not found: ${sourceId}`);
            return false;
        }

        // Get current data
        const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };

        // Convert the new feature to GeoJSON format
        const coords = Array.isArray(feature.geometry)
            ? feature.geometry
            : feature.geometry?.coordinates ?? feature.properties?.coordinates ?? feature.coordinates;

        const turfFeature = featureFromKnownType(levelDef.feature, coords, feature.properties || feature);

        // Add new feature to existing collection
        const updatedFeatures = [...(currentData.features || []), turfFeature];
        const updatedFeatureCollection = featureCollection(updatedFeatures);

        // Update the map source with new data
        existingSource.setData(updatedFeatureCollection);

        console.log(`Added feature to ${sourceId}:`, turfFeature);
        return true;

    } catch (error) {
        console.error(`Error adding feature to map layer ${sourceId}:`, error);
        return false;
    }
}

// Function to remove a feature from an existing map layer
export function removeFeatureFromMapLayer({ map, levelState, featureId, idKey, namedPath }) {
    const sourceId = `${levelState}-features`;
    const layerId = `${sourceId}-layer`;

    // Get the level definition to understand feature type
    const levelDef = namedPath.find(lvl => lvl.state === levelState);
    if (!levelDef || !levelDef.feature) {
        console.warn(`Level definition not found for state: ${levelState}`);
        return false;
    }

    // Use the provided idKey or fall back to the level's idKey
    const keyToUse = idKey || levelDef.idKey;
    if (!keyToUse) {
        console.warn(`No idKey found for level state: ${levelState}`);
        return false;
    }

    try {
        // Get existing source
        const existingSource = map.getSource(sourceId);
        if (!existingSource) {
            console.warn(`Map source not found: ${sourceId}`);
            return false;
        }

        // Get current data
        const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };

        // Filter out the feature to be removed
        const filteredFeatures = (currentData.features || []).filter(feature => {
            const featureIdValue = feature.properties?.[keyToUse];
            return featureIdValue !== featureId;
        });

        // Update the map source with filtered data
        const updatedFeatureCollection = featureCollection(filteredFeatures);
        existingSource.setData(updatedFeatureCollection);

        console.log(`Removed feature from ${sourceId}:`, { featureId, idKey: keyToUse });
        return true;

    } catch (error) {
        console.error(`Error removing feature from map layer ${sourceId}:`, error);
        return false;
    }
}

// Example: Use this in your addLayersService for XState
export async function addLayers({ context, sendBack, self }) {
    // Choose the correct namedPath for this instance
    // For now, we pick the first path
    const { map, namedPaths } = context;
    if (!map || !namedPaths) return;
    const allFeatureLayers = await addAllFeatureLayers({
        map,
        namedPath: namedPaths[0],
        sendBack,
        getContext: self ? () => self.getSnapshot().context : () => context
    });

    const afterLayerSetupCommands = await ScriptCache.runScript("afterLayerSetupCommands", {groupedFeatures: allFeatureLayers});
    context.mmvSend(afterLayerSetupCommands || []);

    return {data: allFeatureLayers};
}

async function handleMarkers(stateValue, markersConfig, {context, self}) {

    let manageMarkers;

    if(context.manageMarkers[stateValue]){
        context.map.off('moveend', context.manageMarkers[stateValue]);
        context.map.off('idle', context.manageMarkers[stateValue]);
        context.map.off('sourcedata', context.manageMarkers[stateValue])
    }

    

    if(markersConfig){
        manageMarkers = async (e) => {
            console.log('renderallmarkers');
            console.log(markersConfig);
            const {graphics} = await renderAllMarkers(e, {context, self}, markersConfig);

            if (graphics && graphics.length > 0) {
                const commands = [{
                    commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
                    commandRef: uuid(),
                    params: {
                        ids: graphics.map(g => g.id),//remove stale
                    }
                }, {
                    commandName: MMV_COMMANDS.ADD_GRAPHICS,
                    commandRef: uuid(),
                    params: {
                        graphics: graphics
                    }
                }]
                context.mmvSend(commands);
            };
        }
        context.map.on('moveend', manageMarkers);
        context.map.on('idle', manageMarkers);
        context.map.on('sourcedata', manageMarkers);
        manageMarkers();
    }

    return {manageMarkers}
}

export async function getInitAction({mapMachineInput }) {
    return addLayers(mapMachineInput)
}
export async function getEntryAction({mapMachineInput }) {
    console.log("getEntryAction", {mapMachineInput});
    const {stateValue, context, event, self} = mapMachineInput;

    const {suppressEntryActions} = context;

    if (suppressEntryActions) {
        return { suppressEntryActions: false };
    }

    console.log('StateValue');
    console.log(stateValue);
    switch (stateValue) {
        case 'portfolio': {

            //we are calling the mapbox API imperatively here, we will replace that with commands in next task

            let { commands, theme = {}, singleMarkers, legend } = await ScriptCache.runScript("getEntryActionTheme", {suppressEntryActions, stateValue});
            //zoom out to all features
            zoomToFeature({map: context.map, context});
            const namedPath = context.namedPaths[0];//TODO, select correct namedPath index

            for(const layerId of Object.keys(theme)) {
                const themeConfig = theme[layerId];
                const state = layerId.split("-")[0];
                const level = getLevel(state, namedPath);
                if(level){
                    const { groupsObject } =
                        buildGroupsFromBins(context.map, layerId, level.idKey, themeConfig);

                    const mmvThemeCommands = [{
                        commandName: MMV_COMMANDS.THEME_ELEMENTS,
                        commandRef: uuid(),
                        params: {
                            groups: groupsObject,
                            clear: false,
                            extra: {
                                field: level.idKey,
                                fieldType: level.idType || "string",
                                layerNames: [layerId]
                            }
                        }
                    }];
                    console.log("Theming command",{stateValue, mmvThemeCommands});
                    context.mmvSend(mmvThemeCommands)
                }
            }

            const markersConfig = singleMarkers;
            console.log("markersConfig", {markersConfig});
            const {manageMarkers} = await handleMarkers(stateValue, markersConfig, {context, self});

            return { commands: null, manageMarkers: {...context.manageMarkers, [stateValue]: manageMarkers}, theme, legend };
        }

        case 'portfolio.site': {
            const siteId = event.siteId ?? context.siteId;
            zoomToFeature({map: context.map, context, state: 'site', featureId: siteId});
            const namedPath = context.namedPaths[0];//TODO, select correct namedPath index
            let { commands, theme = {}, singleMarkers, legend } = await ScriptCache.runScript("getEntryActionTheme", {suppressEntryActions, stateValue});
            const markersConfig = singleMarkers;
            const {manageMarkers} = await handleMarkers(stateValue, markersConfig, {context, self});

            for(const layerId of Object.keys(theme)) {
                const themeConfig = theme[layerId];
                const state = layerId.split("-")[0];
                const level = getLevel(state, namedPath);
                if(level){
                    const { groupsObject } =
                        buildGroupsFromBins(context.map, layerId, level.idKey, themeConfig);

                    const mmvThemeCommands = [{
                        commandName: MMV_COMMANDS.THEME_ELEMENTS,
                        commandRef: uuid(),
                        params: {
                            groups: groupsObject,
                            clear: false,
                            extra: {
                                field: level.idKey,
                                fieldType: level.idType || "string",
                                layerNames: [layerId]
                            }
                        }
                    }];
                    console.log("Theming command",{stateValue, mmvThemeCommands});
                    context.mmvSend(mmvThemeCommands)
                }
            }

            return { commands: null, manageMarkers: {...context.manageMarkers, [stateValue]: manageMarkers}, theme, legend };
        }

        case 'portfolio.site.building': {
            const siteId = event.siteId ?? context.siteId;
            const buildingId = event.buildingId ?? context.buildingId;
            let { commands, theme = {}, singleMarkers, legend } = await ScriptCache.runScript("getEntryActionTheme", {suppressEntryActions, stateValue});
            zoomToFeature({map: context.map, context, state: 'building', featureId: buildingId});
            return { commands: null, legend };
        }

        default:
            return {};
    }
}

export async function getExitAction({mapMachineInput }) {
    const {stateValue, context, event, self} = mapMachineInput;
    console.log("getExitAction", {mapMachineInput});
    if (context.suppressExitActions) {
        return { suppressExitActions: false };
    }
    switch (stateValue) {
        case 'portfolio': {

            if(context.manageMarkers[stateValue]){
                context.map.off('moveend', context.manageMarkers[stateValue]);
                context.map.off('idle', context.manageMarkers[stateValue]);
                context.map.off('sourcedata', context.manageMarkers[stateValue]);
            }
            const markerIds = clearStaleMarkersByPath("site")
            const commands = [{
                commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
                commandRef: uuid(),
                params: {
                    ids: [...markerIds],
                }
            }]
            context.mmvSend(commands);

            return { manageMarkers: {...context.manageMarkers, [stateValue]: null } };
        }
        case 'portfolio.site': {

            if(context.manageMarkers[stateValue]){
                context.map.off('moveend', context.manageMarkers[stateValue]);
                context.map.off('idle', context.manageMarkers[stateValue]);
                context.map.off('sourcedata', context.manageMarkers[stateValue]);
            }
            const markerIds = clearStaleMarkersByPath("building")
            const commands = [{
                commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
                commandRef: uuid(),
                params: {
                    ids: [...markerIds],
                }
            }]
            context.mmvSend(commands);

            return { manageMarkers: {...context.manageMarkers, [stateValue]: null } };
        }

        default:
            return {};
    }
}

export async function getChartStatus({ mapMachineInput }) {
    const {stateValue, context, event, self} = mapMachineInput;
    const {suppressEntryActions} = context;

    if (suppressEntryActions) {
        return { suppressEntryActions: false };
    }

     let result = await ScriptCache.runScript("getEntryActionTheme", {suppressEntryActions, stateValue});
     let statusConfig = result?.singleMarkers?.[0]?.popupConfig?.statusPopup?.statusConfig;
     let legend = result?.legend?.bins;

   const reshapedStatusConfig = Object.keys(statusConfig.labelMap).reduce((acc, key) => {

    const rawLabel = statusConfig.labelMap[key];
    const label = rawLabel || key; // fallback to the key name if label is missing


    const camelKey = toCamelCase(label);     // e.g. "suspendedOperation"
        acc[camelKey] = {
        label,
        color: statusConfig.colorMap[key],
        statusId: key,
        };

        return acc;
    }, {});

    const statusTemplate = Object.keys(reshapedStatusConfig).reduce((acc, key) => {
    acc[key] = 0;
    return acc;
    }, {});

    // Enrich each legend entry with a cloned status object
    const statusLegend = legend.map(item => ({
    ...item,
    status: { ...statusTemplate }
    }));

    const data = updateStatusLegend(statusLegend, reshapedStatusConfig, context?.data);

    return {statusConfig: reshapedStatusConfig, data: data};
}

function updateStatusLegend(statusLegend, statusConfig, data) {
  // Build lookup: statusId → statusKey (Planned, Construction, etc.)
  const statusIdToKey = {};
  for (const [key, cfg] of Object.entries(statusConfig)) {
    if (cfg && cfg.statusId != null) {
      statusIdToKey[Number(cfg.statusId)] = key;
    }
  }

  const updatedLegend = statusLegend.map(item => ({
    ...item,
    status: { ...item.status }
  }));

  for (const site of data?.site || []) {
    for (const b of site?.buildings || []) {
      const capacity = Number(b.Capacity);
      const statusId = Number(b.StatusId);
      if (isNaN(capacity)) continue;

      // Find correct bucket
      const bucket = updatedLegend.find(item => {
        const min = item.min ?? -Infinity;
        const max = item.max;
        if (max == null) return capacity >= min;
        return capacity >= min && capacity <= max;
      });

      if (!bucket) continue;

      // Map statusId → statusKey
      const statusKey = statusIdToKey[statusId] ?? 'unknown';

      if (bucket.status.hasOwnProperty(statusKey)) {
        bucket.status[statusKey] += 1;
      } else {
        bucket.status.unknown += 1;
      }
    }
  }

  return updatedLegend;
}

const toCamelCase = (str) => {
  return str
    .toLowerCase()
    .replace(/(?:^\w|[\s-_]\w)/g, (match, index) =>
      index === 0
        ? match.toLowerCase()
        : match.replace(/[\s-_]/, '').toUpperCase()
    );
};


export async function filterFeatures({ mapMachineInput, data, dispatch, send}) {
    const {stateValue, context, event, self, map, namedPaths} = mapMachineInput;
    const {suppressEntryActions} = context;

    console.log(self);

    console.log('mapMachineInput');
    console.log(mapMachineInput);

    const datatosend = {building: context.data.building, site: data};
    clearAllSites(map, context.data.site, context.namedPaths);
    // dispatch(setSelectedCoordinate());
    // dispatch(setIsSelectingPosition(false));
    //  send({
    //         type: 'UPDATE_DATA',
    //         data: datatosend
    //     });
    if (suppressEntryActions) {
        return { suppressEntryActions: false };
    }

     let result = await ScriptCache.runScript("getEntryActionTheme", {suppressEntryActions, stateValue});
     let singleMarkers = result?.singleMarkers;

     const allowedIds = new Set(data.map(f => f.siteId));

     
   // const filterMarkers = filterSingleMarkers({ singleMarkers }, allowedIds);
   
   const allowedSet = new Set((Array.isArray(data) ? data : []).map(d => d.siteId));
   const filteredSingleMarkers = await singleMarkers.map(cfg => {
    const copy = { ...cfg };
    copy.features = Array.isArray(cfg.features)
      ? cfg.features.filter(f => allowedSet.has(f?.properties?.siteId))
      : [];
    return copy;
  });
  

  console.log('filteredSingleMarkers');
  console.log({filteredSingleMarkers}); 

const { manageMarkers } = await handleMarkers(stateValue, filteredSingleMarkers, { context, self }); 
    
//const {manageMarkers} = await handleMarkers(stateValue, singleMarkers, {context, self});

     let legend = result?.legend?.bins;


    return 'okay';
}

function filterSingleMarkers({ singleMarkers }, allowedIds) {
    if (!Array.isArray(singleMarkers)) return;

    const allowedArray = Array.isArray(allowedIds) ? allowedIds : Array.from(allowedIds || []);

    singleMarkers.forEach(group => {
        if (Array.isArray(group.features)) {
            group.features = group.features.filter(f => allowedArray.includes(f.properties.siteId));
        }
    });
}


function clearAllSites(map, sites, namedPath) {
  sites.forEach(site => {
    removeFeatureFromMapLayer({
      map,
      levelState: 'site',
      featureId: site.siteId,
      idKey: 'siteId',
      namedPath
    });
  });
}