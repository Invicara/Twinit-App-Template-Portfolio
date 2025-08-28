//TODO: replace this script with MMV COMMANDS
import mapboxgl from 'mapbox-gl';
import { point, multiPoint,
    lineString, multiLineString,
    polygon, multiPolygon, featureCollection } from '@turf/helpers';
import {IafProj, IafSession} from "@dtplatform/platform-api";
import { MMV_COMMANDS } from '@invicara/ipa-core-mmv';
import {v4 as uuid} from "uuid"
import bbox from "@turf/bbox";

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

        const data = src._data || src._options?.data; // ⚠️ private API
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

    // Helper to get level def from state name
    const getLevel = (stateName) => namedPath.find(lvl => lvl.state === stateName);

    // debugger;
    if (state && featureId) {
        const level = getLevel(state);
        if (!level || !level.idKey) return;

        context.mmvSend([{
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
        }]);

        return;
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

        if (getContext) {
            const currentContext = getContext();
            console.log("GETTING_CURRENT_CONTEXT", {event, currentContext});
            
            // If we have a siteId and site data, check if the site is in draft mode or being edited
            if (currentContext.data.site.some(s => s.isDraft || s.isEditing)) {
                console.log('Navigation blocked: Site is in draft mode or being edited');
                return; // Don't send the GO_TO event
            }
        }

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

        const sourceId = `${level.state}-features`;
        // Add or update source
        if (!map.getSource(sourceId)) {
            console.log("adding features", sourceId, features, turfFeatures);
            try {
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: fc
                });
            } catch (e) {
                console.error(e);
            }
        } else {
            map.getSource(sourceId).setData({ type: 'FeatureCollection', features });
        }

        // Add or update layer
        if (!map.getLayer(`${sourceId}-layer`)) {
            map.addLayer({
                id: `${sourceId}-layer`,
                type: level.feature === 'point' ? 'circle' : 'fill',
                source: sourceId,
                paint: level.feature === 'point'
                    ? { 'circle-radius': 7, 'circle-color': '#3377FF' }
                    : { 'fill-color': '#44C', 'fill-opacity': 0.18 }
            });
            const handler = makeMapOnClickHandler({ map, namedPath, send: sendBack, getContext });
            map.on('click', handler);
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
    return {data: allFeatureLayers};
}

export async function getInitAction({mapMachineInput }) {
    return addLayers(mapMachineInput)
}
export async function getEntryAction({mapMachineInput }) {
    console.log("getEntryAction", {mapMachineInput});
    const {stateValue, context, event, self} = mapMachineInput;

    if (context.suppressEntryActions) {
        return { suppressEntryActions: false };
    }

    switch (stateValue) {
        case 'portfolio': {

            zoomToFeature({map: context.map, context});
            return { commands: null };
        }

        case 'portfolio.site': {
            const siteId = event.siteId ?? context.siteId;
            zoomToFeature({map: context.map, context, state: 'site', featureId: siteId});
            return { commands: null };
        }

        case 'portfolio.site.building': {
            const siteId = event.siteId ?? context.siteId;
            const buildingId = event.buildingId ?? context.buildingId;

            zoomToFeature({map: context.map, context, state: 'building', featureId: buildingId});

            return { commands: null };
        }

        default:
            return {};
    }
}
