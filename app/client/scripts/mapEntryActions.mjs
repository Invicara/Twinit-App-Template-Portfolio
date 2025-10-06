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
    addMarkers,
    clearStaleMarkers,
    clearStaleMarkersByPath,
    makeMarkerShell,
    makePieCanvas,
    renderAllMarkers,
    zoomIntoClusterByExpansion
} from "./mapMarkers.mjs";
import {ScriptCache} from "@invicara/ipa-core/modules/IpaUtils/index.js";
import {isColorProp, normalizeColorRGB} from "./colorNormalization.mjs";
import { getCachedFile } from "../../services/utils.js";

// Global Map to store loaded geometries, accessible throughout the application
const globalLoadedGeometries = new Map();
// stable snapshot of what we’ve mirrored downstream per layer
const globalFilterKeys = new Map(); // layerId -> string

function makeGlobalFilterKey({ layer, field, ids, invert, filter }) {
    // sort ids for stable equality
    const sorted = (ids || []).slice().sort();
    return JSON.stringify({ layer, field, sorted, filter, invert: !!invert });
}

/**
 * Get geometry info for a specific graphic ID
 * @param {string} graphicId - The graphic ID to look up
 * @returns {Object|null} - The geometry info object or null if not found
 */
export function getGeometryInfo(graphicId) {
    return globalLoadedGeometries.get(graphicId) || null;
}

/**
 * Check if a geometry is already loaded
 * @param {string} graphicId - The graphic ID to check
 * @returns {boolean} - True if geometry is loaded, false otherwise
 */
export function isGeometryLoaded(graphicId) {
    return globalLoadedGeometries.has(graphicId);
}

/**
 * Get all loaded geometry IDs
 * @returns {Array<string>} - Array of all loaded graphic IDs
 */
export function getLoadedGeometryIds() {
    return Array.from(globalLoadedGeometries.keys());
}
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {IafScriptEngine} from "@dtplatform/iaf-script-engine";
import scriptModule from "../../../setup/scripts/mmv_config.mjs";

/**
 * Properly dispose of THREE.js resources to prevent memory leaks
 * @param {THREE.Object3D} obj - The 3D object to dispose
 */
function disposeObject3D(obj) {
    if (!obj) return;

    obj.traverse((node) => {
        if (node.isMesh) {
            // Dispose geometry
            if (node.geometry) {
                node.geometry.dispose();
            }

            // Dispose materials and their textures
            if (node.material) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(mat => {
                        disposeMaterial(mat);
                    });
                } else {
                    disposeMaterial(node.material);
                }
            }
        }
    });

    // Clear the object's children array
    if (obj.children) {
        obj.children.length = 0;
    }
}

/**
 * Dispose of a THREE.js material and its textures
 * @param {THREE.Material} material - The material to dispose
 */
function disposeMaterial(material) {
    if (!material) return;

    // Dispose common texture types
    const textureProperties = ['map', 'normalMap', 'roughnessMap', 'metalnessMap',
        'emissiveMap', 'bumpMap', 'displacementMap', 'aoMap',
        'lightMap', 'envMap', 'alphaMap'];

    textureProperties.forEach(prop => {
        if (material[prop] && material[prop].dispose) {
            material[prop].dispose();
        }
    });

    // Dispose the material itself
    material.dispose();
}

const getLevel = (stateName, namedPath) => namedPath.find(lvl => lvl.state === stateName);
let activeFilter = null;

/**
 * Helper function to get graphic ID using the new lookup chain:
 * structureName -> structures -> mapGraphicRefId -> graphicReferencesMap
 * @param {string} structureName - The structure name from feature properties
 * @param {Object} reduxState - Redux state containing structures and mapGraphicReferences
 * @returns {string|null} - The graphic ID or null if not found
 */
function getGraphicIdFromStructureName(structureName, reduxState) {
    if (!structureName || !reduxState) return null;
    
    const structures = reduxState?.pageComponentState?.structures || {};
    const mapGraphicReferences = reduxState?.pageComponentState?.mapGraphicReferences || [];
    
    // Step 1: structureName -> structure
    const structure = structures[structureName];
    if (!structure) {
        console.warn(`No structure found for structureName: ${structureName}`);
        return null;
    }
    
    // Step 2: structure -> mapGraphicRefId
    const mapGraphicRefId = structure.mapGraphicRefId;
    if (!mapGraphicRefId) {
        console.warn(`No mapGraphicRefId found in structure: ${structureName}`, structure);
        return null;
    }
    
    // Step 3: mapGraphicRefId -> graphicReferencesMap -> graphic
    const graphicReference = mapGraphicReferences.find(ref => ref._id === mapGraphicRefId);
    if (!graphicReference) {
        console.warn(`No graphic reference found for mapGraphicRefId: ${mapGraphicRefId}`);
        return null;
    }
    
    return graphicReference.graphic;
}

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
            properties: { ...d}
        }));
    }
    if (levelDef.feature === 'mesh') {
        return data.filter(d => d.longitude && d.latitude).map(d => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(d.longitude), parseFloat(d.latitude)]
            },
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
        case 'mesh': {
            if (!isPos(coords)) throw new Error('Mesh coords must be [lng, lat]');
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

/**
 * Load and cache all unique graphics (3D models) referenced in Redux state
 * This function loads each unique graphic model only once and stores them for reuse
 *
 * @param {Array} graphicReferences - Array of graphic references from Redux state
 * @returns {Promise<Map>} - Map of loaded geometries keyed by graphic ID
 */
export async function loadGraphics(graphicIds) {
    const geometryLoadPromises = new Map();


    const loader = new GLTFLoader();

    // Load each unique graphic URL once
    const loadGeometry = async (graphicId) => {
        if (geometryLoadPromises.has(graphicId)) {
            return geometryLoadPromises.get(graphicId);
        }

        const promise = (async () => {
            try {
                // Get the cached file URL for this graphic
                const modelUrl = await getCachedFile(graphicId);
                if (!modelUrl) {
                    console.warn(`No URL found for graphic ID: ${graphicId}`);
                    return null;
                }

                console.log(`Loading graphic model: ${graphicId} from ${modelUrl}`);

                return new Promise((resolve, reject) => {
                    loader.load(modelUrl, (gltf) => {
                            console.log(`Graphic loaded successfully: ${graphicId}`);

                            // Calculate model statistics
                            let totalVertices = 0;
                            let meshCount = 0;
                            let boundingBox = new THREE.Box3();

                            gltf.scene.traverse((node) => {
                                if (node.isMesh) {
                                    meshCount++;
                                    totalVertices += node.geometry.attributes.position.count;
                                    boundingBox.expandByObject(node);
                                }
                            });

                            // Get the size of the bounding box in model units
                            const boxSize = new THREE.Vector3();
                            boundingBox.getSize(boxSize);

                            // Convert to meters (approximate)
                            const modelToMetersScale = 1;
                            const sizeInMeters = {
                                width: boxSize.x * modelToMetersScale,
                                depth: boxSize.z * modelToMetersScale,
                                height: boxSize.y * modelToMetersScale
                            };

                            const geometryInfo = {
                                scene: gltf.scene,
                                sizeInMeters,
                                boundingBox,
                                meshCount,
                                totalVertices,
                                bbox: boundingBox.min.toArray().concat(boundingBox.max.toArray()),
                                modelUrl,
                                graphicId
                            };

                            globalLoadedGeometries.set(graphicId, geometryInfo);
                            resolve(geometryInfo);
                        },
                        (progress) => {
                            console.log(`Loading progress for ${graphicId}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
                        },
                        (error) => {
                            console.error(`Error loading graphic ${graphicId}:`, error);
                            reject(error);
                        });
                });
            } catch (error) {
                console.error(`Error getting URL for graphic ${graphicId}:`, error);
                return null;
            }
        })();

        geometryLoadPromises.set(graphicId, promise);
        return promise;
    };

    // Load all unique geometries
    try {
        const results = await Promise.all(graphicIds.map(id => loadGeometry(id)));
        console.log(`Successfully loaded ${results.filter(r => r !== null).length} graphics`);
        return globalLoadedGeometries;
    } catch (error) {
        console.error('Error loading graphics:', error);
        return globalLoadedGeometries;
    }
}

/**
 * Create an optimized instance of a THREE.js scene that shares geometries but clones materials only when needed
 * This dramatically reduces memory usage by sharing geometry data across instances
 * @param {THREE.Scene} scene - The scene to instance
 * @param {boolean} cloneMaterials - Whether to clone materials (default: false for better performance)
 * @returns {THREE.Scene} - The instanced scene
 */
export function createOptimizedInstance(scene, cloneMaterials = false) {
    const instancedScene = scene.clone();

    // Only clone materials if specifically requested (e.g., for different colors/appearances)
    if (cloneMaterials) {
        instancedScene.traverse((node) => {
            if (node.isMesh && node.material) {
                if (Array.isArray(node.material)) {
                    node.material = node.material.map(mat => mat.clone());
                } else {
                    node.material = node.material.clone();
                }
            }
        });
    }

    // Geometries are automatically shared through scene.clone() - no need to clone them!
    // This saves massive amounts of memory for large models

    return instancedScene;
}

/**
 * Create a themed instance with modified material properties (e.g., different colors)
 * @param {THREE.Scene} scene - The scene to instance
 * @param {Object} materialOverrides - Object with material property overrides
 * @returns {THREE.Scene} - The themed instance
 */
export function createThemedInstance(scene, materialOverrides = {}) {
    const themedScene = createOptimizedInstance(scene, true); // Clone materials for theming

    if (Object.keys(materialOverrides).length > 0) {
        themedScene.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(material => {
                    Object.keys(materialOverrides).forEach(prop => {
                        if (prop === 'color' && materialOverrides[prop]) {
                            // Handle color specifically - convert to THREE.Color if needed
                            const color = materialOverrides[prop];
                            if (typeof color === 'string' || typeof color === 'number') {
                                material.color = new THREE.Color(color);
                            } else if (color instanceof THREE.Color) {
                                material.color = color;
                            }
                        } else if (material.hasOwnProperty(prop)) {
                            material[prop] = materialOverrides[prop];
                        }
                    });
                });
            }
        });
    }

    return themedScene;
}

/**
 * Apply color theming to an existing model instance
 * @param {THREE.Scene} modelScene - The model scene to apply colors to
 * @param {string|number|THREE.Color} color - The color to apply
 * @param {number} opacity - Optional opacity (0-1)
 */
export function applyColorToModel(modelScene, color, opacity = null) {
    if (!modelScene) return;

    modelScene.traverse((node) => {
        if (node.isMesh && node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach(material => {
                if (color) {
                    if (typeof color === 'string' || typeof color === 'number') {
                        material.color = new THREE.Color(color);
                    } else if (color instanceof THREE.Color) {
                        material.color = color;
                    }
                }

                if (opacity !== null) {
                    material.opacity = opacity;
                    material.transparent = opacity < 1;
                }
            });
        }
    });
}

/**
 * @deprecated Use createOptimizedInstance() instead for better memory efficiency
 * Deep clone a THREE.js scene to ensure each instance has independent materials and geometries
 * @param {THREE.Scene} scene - The scene to clone
 * @returns {THREE.Scene} - The cloned scene
 */
export function deepCloneScene(scene) {
    console.warn('deepCloneScene is deprecated and memory-inefficient. Use createOptimizedInstance() instead.');
    return createOptimizedInstance(scene, true); // Clone materials for backward compatibility
}

/**
 * Create 3D cube wrapper features for graphics (following npa-mmv pattern)
 * @param {Array} features - Array of point features
 * @param {Map} loadedGraphics - Map of loaded graphic geometries
 * @param {Function} getContext - Function to get Redux context
 * @returns {Array} Array of polygon features representing 3D cubes
 */
async function createCubeWrapperFeatures(features, loadedGraphics, getContext) {
    const cubeWrapperFeatures = [];

    // Get Redux state for structure lookup
    const contextData = getContext ? getContext() : {};
    const { reduxState } = contextData;

    // Default cube size and height
    const defaultCubeSizeMeters = 20; // square footprint side length
    const defaultHeightMeters = 50;

    // Helper function to convert meters to degrees
    const metersToDegrees = (meters, lat) => ({
        dLat: meters / 111320,
        dLon: meters / (111320 * Math.cos((lat * Math.PI) / 180))
    });

    for (const feature of features) {
        // Extract centroid from longitude/latitude fields
        const longitude = feature.properties?.longitude;
        const latitude = feature.properties?.latitude;

        if (!longitude || !latitude) {
            console.warn(`Feature ${feature.properties?.id} missing longitude/latitude for cube wrapper`);
            continue;
        }

        const lng = parseFloat(longitude);
        const lat = parseFloat(latitude);

        // Extract rotation and size from feature properties with defaults
        const rotation = feature.properties?.rotation ?? 0;
        const sizeProportion = feature.properties?.size ?? 1;

        // Get graphic information for sizing using new lookup chain (optional - use defaults if not available)
        const structureName = feature.properties?.structureName;
        let height = defaultHeightMeters;
        let cubeSize = defaultCubeSizeMeters;

        if (structureName) {
            const graphicId = getGraphicIdFromStructureName(structureName, reduxState);
            if (graphicId) {
                const geometryInfo = loadedGraphics.get(graphicId);
                if (geometryInfo && geometryInfo.sizeInMeters) {
                    // Use actual model dimensions if available
                    height = geometryInfo.sizeInMeters.height || defaultHeightMeters;
                    cubeSize = Math.max(
                        geometryInfo.sizeInMeters.width || defaultCubeSizeMeters,
                        geometryInfo.sizeInMeters.depth || defaultCubeSizeMeters
                    );
                }
            }
        }

        // Apply size proportion
        height *= sizeProportion;
        cubeSize *= sizeProportion;

        // Create cube footprint coordinates
        const { dLat, dLon } = metersToDegrees(cubeSize / 3, lat);
        const ring = [
            [lng - dLon, lat - dLat],
            [lng + dLon, lat - dLat],
            [lng + dLon, lat + dLat],
            [lng - dLon, lat + dLat],
            [lng - dLon, lat - dLat]
        ];

        // Create cube wrapper feature
        const cubeFeature = {
            type: 'Feature',
            id: feature.properties?.buildingId || feature.properties?.id,
            properties: {
                ...feature.properties,
                type: '3d_model',
                height: height,
                elevation: 0,
                rotation: rotation,
                size: sizeProportion,
                cube_wrapper: true // Mark as wrapper feature
            },
            geometry: {
                type: 'Polygon',
                coordinates: [ring]
            }
        };

        cubeWrapperFeatures.push(cubeFeature);
    }

    return cubeWrapperFeatures;
}

/**
 * Setup graphic layers - creates 3D custom layer and transparent wrapper layer
 * @param {Object} params - Parameters for setting up graphic layers
 */
async function setupGraphicLayers({ map, sourceId, level, features, loadedGraphics, namedPath, sendBack, getContext }) {
    const customLayerId = `${sourceId}-3d-graphics`;
    const wrapperLayerId = `${sourceId}-layer`;

    // Create 3D cube wrapper features
    const cubeWrapperFeatures = await createCubeWrapperFeatures(features, loadedGraphics, getContext);
    console.log(`Created ${cubeWrapperFeatures.length} cube wrapper features for 3D graphics`);

    // Update the source with cube wrapper features
    const existingSource = map.getSource(sourceId);
    if (existingSource) {
        existingSource.setData({
            type: 'FeatureCollection',
            features: cubeWrapperFeatures
        });
    } else {
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: cubeWrapperFeatures
            }
        });
    }

    // Create transparent wrapper layer for click handling
    if (!map.getLayer(wrapperLayerId)) {
        map.addLayer({
            id: wrapperLayerId,
            type: 'fill-extrusion',
            source: sourceId,
            metadata: {
                custom3DLayerRef: customLayerId,
                layerType: "feature-wrapper",
                description: "Feature wrapper for 3D graphics layer"
            },
            paint: {
                'fill-extrusion-color': '#000000',
                'fill-extrusion-height': ['coalesce', ['get', 'height'], 10],
                'fill-extrusion-base': ['coalesce', ['get', 'elevation'], 0],
                'fill-extrusion-opacity': 0.0 // Transparent
            }
        });

        // Add click handler
        const handler = makeMapOnClickHandler({ map, namedPath, send: sendBack, getContext });
        map.on('click', handler);
        map.on('mouseenter', wrapperLayerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', wrapperLayerId, () => { map.getCanvas().style.cursor = ''; });
    }

    // Create or update 3D custom layer
    if (!map.getLayer(customLayerId)) {
        const customLayer = createGraphicsCustomLayer(customLayerId, features, loadedGraphics, level, getContext);
        map.addLayer(customLayer);
        console.log(`Created 3D graphics layer: ${customLayerId} with ${features.length} features`);
    } else {
        // Update existing layer with new features
        const existingLayer = map.getLayer(customLayerId);
        if (existingLayer && existingLayer.updateFeatures) {
            existingLayer.updateFeatures(features, loadedGraphics, getContext);
            console.log(`Updated 3D graphics layer: ${customLayerId} with ${features.length} features`);
        }
    }
}

/**
 * Update 3D graphic transform programmatically
 * @param {Object} map - Mapbox map instance
 * @param {string} sourceId - The source ID for the graphics layer
 * @param {string} featureId - The feature ID to update
 * @param {Object} transform - Transform parameters
 * @param {Array} [transform.centroid] - New [longitude, latitude] position
 * @param {number} [transform.rotation] - New rotation in degrees
 * @param {number} [transform.size] - New size proportion
 * @param {boolean} [updateWrapper=true] - Whether to also update the cube wrapper
 * @returns {boolean} - Success status
 */
export function update3DGraphicTransform(map, sourceId, featureId, transform = {}, updateWrapper = true) {
    console.log('Updating 3D graphic transform:', { featureId, transform });
    
    const customLayerId = `${sourceId}-3d-graphics`;
    const layer = map.getLayer(customLayerId);
    
    if (!layer || layer.type !== 'custom') {
        console.warn(`3D graphics layer not found: ${customLayerId}`);
        return false;
    }
    
    // Find the feature
    const keyProperty = layer.metadata?.featureInfo?.idProperty || 'buildingId';
    const feature = layer.features.find(f => f.properties[keyProperty] === featureId);
    
    if (!feature) {
        console.warn(`Feature not found: ${featureId}`);
        return false;
    }
    
    let updated = false;
    
    // Update position if provided
    if (transform.centroid && Array.isArray(transform.centroid) && transform.centroid.length === 2) {
        const [lng, lat] = transform.centroid;
        feature.centroid = [lng, lat];
        
        const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
        feature.transform.translateX = modelAsMercatorCoordinate.x;
        feature.transform.translateY = modelAsMercatorCoordinate.y;
        feature.transform.translateZ = modelAsMercatorCoordinate.z;
        
        // Update properties
        feature.properties.longitude = lng;
        feature.properties.latitude = lat;
        
        updated = true;
        console.log(`Updated position to [${lng}, ${lat}]`);
    }
    
    // Update rotation if provided
    if (transform.rotation !== undefined && transform.rotation !== null) {
        const rotation = parseFloat(transform.rotation);
        if (!isNaN(rotation)) {
            feature.transform.rotateY = rotation * -(Math.PI / 180);
            feature.properties.rotation = rotation;
            updated = true;
            console.log(`Updated rotation to ${rotation}°`);
        }
    }
    
    // Update size if provided
    if (transform.size !== undefined && transform.size !== null) {
        const size = parseFloat(transform.size);
        if (!isNaN(size) && size > 0) {
            const centroid = feature.centroid;
            const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(centroid, 0);
            const baseScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
            feature.transform.scale = baseScale * size;
            feature.properties.size = size;
            updated = true;
            console.log(`Updated size to ${size}x`);
        }
    }
    
    if (updated) {
        // Trigger map repaint to show changes
        map.triggerRepaint();
        
        // Update cube wrapper if requested
        if (updateWrapper) {
            updateCubeWrapperForFeature(map, feature, sourceId);
        }
        
        console.log('3D graphic transform updated successfully:', {
            featureId,
            centroid: feature.centroid,
            rotation: feature.properties.rotation,
            size: feature.properties.size
        });
    }
    
    return updated;
}

/**
 * Update cube wrapper for a specific feature after transformation
 * @param {Object} map - Mapbox map instance
 * @param {Object} feature - The 3D feature that was transformed
 * @param {string} sourceId - The source ID for the graphics layer
 */
function updateCubeWrapperForFeature(map, feature, sourceId) {
    console.log('Updating cube wrapper for feature:', feature.properties);
    
    const existingSource = map.getSource(sourceId);
    if (!existingSource) {
        console.warn(`Source not found: ${sourceId}`);
        return false;
    }

    const keyProperty = feature.layer?.metadata?.featureInfo?.idProperty || 'buildingId';
    const featureId = feature.properties[keyProperty];
    
    if (!featureId) {
        console.warn('Feature ID not found for cube wrapper update');
        return false;
    }

    // Get current data
    const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };
    
    // Find the cube wrapper for this feature
    const wrapperIndex = currentData.features.findIndex(f => 
        f.properties?.[keyProperty] === featureId || f.id === featureId
    );
    
    if (wrapperIndex === -1) {
        console.warn(`Cube wrapper not found for feature: ${featureId}`);
        return false;
    }

    // Get geometry info from loaded geometries
    const geometryInfo = globalLoadedGeometries.get(feature.graphicId);
    
    // Default values
    const defaultCubeSizeMeters = 20;
    const defaultHeightMeters = 50;
    
    // Extract rotation and size from feature transform
    const rotation = feature.properties?.rotation ?? 0;
    const sizeProportion = feature.properties?.size ?? 1;
    
    // Calculate current scale from transform
    const currentScale = feature.transform.scale;
    const centroid = feature.centroid;
    const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(centroid, 0);
    const baseScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
    const actualSizeProportion = currentScale / baseScale;
    
    // Get sizing information
    let height = defaultHeightMeters;
    let cubeSize = defaultCubeSizeMeters;
    
    if (geometryInfo && geometryInfo.sizeInMeters) {
        height = geometryInfo.sizeInMeters.height || defaultHeightMeters;
        cubeSize = Math.max(
            geometryInfo.sizeInMeters.width || defaultCubeSizeMeters,
            geometryInfo.sizeInMeters.depth || defaultCubeSizeMeters
        );
    }
    
    // Apply size proportion
    height *= actualSizeProportion;
    cubeSize *= actualSizeProportion;
    
    // Helper function to convert meters to degrees
    const metersToDegrees = (meters, lat) => ({
        dLat: meters / 111320,
        dLon: meters / (111320 * Math.cos((lat * Math.PI) / 180))
    });
    
    const lng = centroid[0];
    const lat = centroid[1];
    
    // Create cube footprint coordinates with rotation consideration
    const { dLat, dLon } = metersToDegrees(cubeSize / 3, lat);
    
    // Note: For simplicity, we're not rotating the cube wrapper polygon itself
    // The rotation is handled by the 3D model's transform
    // If you need to rotate the wrapper polygon, you'd need to apply rotation matrix to these points
    const ring = [
        [lng - dLon, lat - dLat],
        [lng + dLon, lat - dLat],
        [lng + dLon, lat + dLat],
        [lng - dLon, lat + dLat],
        [lng - dLon, lat - dLat]
    ];
    
    // Update the cube wrapper feature
    const updatedWrapper = {
        type: 'Feature',
        id: featureId,
        properties: {
            ...currentData.features[wrapperIndex].properties,
            ...feature.properties,
            height: height,
            elevation: 0,
            rotation: rotation,
            size: actualSizeProportion,
            cube_wrapper: true
        },
        geometry: {
            type: 'Polygon',
            coordinates: [ring]
        }
    };
    
    // Replace the wrapper in the features array
    const updatedFeatures = [...currentData.features];
    updatedFeatures[wrapperIndex] = updatedWrapper;
    
    // Update the source
    existingSource.setData({
        type: 'FeatureCollection',
        features: updatedFeatures
    });
    
    console.log(`Updated cube wrapper for feature ${featureId}:`, {
        position: centroid,
        rotation,
        size: actualSizeProportion,
        height
    });
    
    return true;
}

/**
 * Helper function to get and control 3D graphics layer with move, rotate, and scale functionality
 * @param {Object} map - Mapbox map instance
 * @param {string} sourceId - The source ID for the graphics layer
 * @returns {Object} - Object with methods to control 3D graphics visibility and transformations
 */
export function get3DGraphicsController(map, sourceId) {
    const customLayerId = `${sourceId}-3d-graphics`;
    const layer = map.getLayer(customLayerId);

    if (!layer || layer.type !== 'custom') {
        console.warn(`3D graphics layer not found: ${customLayerId}`);
        return null;
    }

    // State for tracking interaction mode and handlers
    let interactionState = {
        mode: null, // 'move', 'rotate', 'scale', or null
        activeFeatureId: null,
        activeFeature: null,
        isDragging: false,
        startPosition: null,
        startRotation: 0,
        startScale: 1,
        activeHandle: null,
        
        // Event handlers (stored for cleanup)
        mouseMoveHandler: null,
        mouseDownHandler: null,
        mouseUpHandler: null
    };

    /**
     * Enable move mode for a specific feature
     * @param {string} featureId - The feature ID to enable move mode for
     */
    const enableMove = (featureId) => {
        if (interactionState.mode) {
            console.warn('Another interaction mode is active. Disable it first.');
            return false;
        }

        const feature = layer.features.find(f => f.properties[layer.metadata.featureInfo.idProperty] === featureId);
        if (!feature) {
            console.error(`Feature not found: ${featureId}`);
            return false;
        }

        interactionState.mode = 'move';
        interactionState.activeFeatureId = featureId;
        interactionState.activeFeature = feature;

        // Add visual handles
        if (layer.startEditingFeature) {
            layer.startEditingFeature(featureId);
        }

        // Attach move-specific event handlers
        attachMoveHandlers();
        
        console.log(`Move mode enabled for feature: ${featureId}`);
        map.triggerRepaint();
        return true;
    };

    /**
     * Enable rotate mode for a specific feature
     * @param {string} featureId - The feature ID to enable rotate mode for
     */
    const enableRotate = (featureId) => {
        if (interactionState.mode) {
            console.warn('Another interaction mode is active. Disable it first.');
            return false;
        }

        const feature = layer.features.find(f => f.properties[layer.metadata.featureInfo.idProperty] === featureId);
        if (!feature) {
            console.error(`Feature not found: ${featureId}`);
            return false;
        }

        interactionState.mode = 'rotate';
        interactionState.activeFeatureId = featureId;
        interactionState.activeFeature = feature;

        // Add visual handles
        if (layer.startEditingFeature) {
            layer.startEditingFeature(featureId);
        }

        // Attach rotate-specific event handlers
        attachRotateHandlers();
        
        console.log(`Rotate mode enabled for feature: ${featureId}`);
        map.triggerRepaint();
        return true;
    };

    /**
     * Enable scale mode for a specific feature
     * @param {string} featureId - The feature ID to enable scale mode for
     */
    const enableScale = (featureId) => {
        if (interactionState.mode) {
            console.warn('Another interaction mode is active. Disable it first.');
            return false;
        }

        const feature = layer.features.find(f => f.properties[layer.metadata.featureInfo.idProperty] === featureId);
        if (!feature) {
            console.error(`Feature not found: ${featureId}`);
            return false;
        }

        interactionState.mode = 'scale';
        interactionState.activeFeatureId = featureId;
        interactionState.activeFeature = feature;

        // Add visual handles
        if (layer.startEditingFeature) {
            layer.startEditingFeature(featureId);
        }

        // Attach scale-specific event handlers
        attachScaleHandlers();
        
        console.log(`Scale mode enabled for feature: ${featureId}`);
        map.triggerRepaint();
        return true;
    };

    /**
     * Disable the current interaction mode
     * @param {Array<Function>} callbacks - Optional array of callback functions to execute with the updated feature
     */
    const disableInteraction = (callbacks = null) => {
        if (!interactionState.mode) {
            return true;
        }

        // Store reference to active feature before clearing state
        const activeFeature = interactionState.activeFeature;
        const previousMode = interactionState.mode;

        // Remove event handlers
        if (interactionState.mouseMoveHandler) {
            map.off('mousemove', interactionState.mouseMoveHandler);
        }
        if (interactionState.mouseDownHandler) {
            map.off('mousedown', interactionState.mouseDownHandler);
        }
        if (interactionState.mouseUpHandler) {
            map.off('mouseup', interactionState.mouseUpHandler);
        }

        // Clear visual handles
        if (layer.clearEditingState) {
            layer.clearEditingState();
        }

        // Reset cursor
        map.getCanvas().style.cursor = '';
        map.dragPan.enable();

        // Execute callbacks with the updated feature
        if (activeFeature) {
            // Default callback: update cube wrapper
            const defaultCallback = (feature) => {
                updateCubeWrapperForFeature(map, feature, sourceId);
            };

            // Combine default callback with user-provided callbacks
            const allCallbacks = [defaultCallback, ...(callbacks || [])];
            
            allCallbacks.forEach(callback => {
                try {
                    callback(activeFeature);
                } catch (error) {
                    console.error('Error executing callback:', error);
                }
            });
        }

        // Clear state
        interactionState = {
            mode: null,
            activeFeatureId: null,
            activeFeature: null,
            isDragging: false,
            startPosition: null,
            startRotation: 0,
            startScale: 1,
            activeHandle: null,
            mouseMoveHandler: null,
            mouseDownHandler: null,
            mouseUpHandler: null
        };

        console.log(`${previousMode} mode disabled`);
        map.triggerRepaint();
        return true;
    };

    /**
     * Attach event handlers for move mode
     */
    const attachMoveHandlers = () => {
        interactionState.mouseMoveHandler = (e) => {
            const point = { x: e.point.x, y: e.point.y };

            if (!interactionState.isDragging && layer.detectHandle) {
                // Handle hover detection for cursor changes
                const handleInfo = layer.detectHandle(point);
                if (layer.updateCursor) {
                    layer.updateCursor(handleInfo);
                }
                return;
            }

            // Handle active drag operation for move
            if (interactionState.isDragging && interactionState.activeHandle === 'move') {
                const position = [e.lngLat.lng, e.lngLat.lat];
                
                // Update feature position
                const feature = interactionState.activeFeature;
                feature.centroid = position;
                
                const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(position, 0);
                feature.transform.translateX = modelAsMercatorCoordinate.x;
                feature.transform.translateY = modelAsMercatorCoordinate.y;
                feature.transform.translateZ = modelAsMercatorCoordinate.z;
                
                map.triggerRepaint();
            }
        };

        interactionState.mouseDownHandler = (e) => {
            const point = { x: e.point.x, y: e.point.y };
            
            if (layer.detectHandle) {
                const handleInfo = layer.detectHandle(point);
                
                if (handleInfo && handleInfo.type === 'moveHandle') {
                    interactionState.activeHandle = 'move';
                    interactionState.isDragging = true;
                    interactionState.startPosition = point;
                    map.getCanvas().style.cursor = 'grabbing';
                    map.dragPan.disable();
                    e.preventDefault();
                }
            }
        };

        interactionState.mouseUpHandler = (e) => {
            if (interactionState.isDragging) {
                interactionState.isDragging = false;
                interactionState.activeHandle = null;
                map.dragPan.enable();
                
                const point = { x: e.point.x, y: e.point.y };
                if (layer.detectHandle) {
                    const handleInfo = layer.detectHandle(point);
                    if (layer.updateCursor) {
                        layer.updateCursor(handleInfo);
                    }
                }
            }
        };

        map.on('mousemove', interactionState.mouseMoveHandler);
        map.on('mousedown', interactionState.mouseDownHandler);
        map.on('mouseup', interactionState.mouseUpHandler);
    };

    /**
     * Attach event handlers for rotate mode
     */
    const attachRotateHandlers = () => {
        interactionState.mouseMoveHandler = (e) => {
            const point = { x: e.point.x, y: e.point.y };

            if (!interactionState.isDragging && layer.detectHandle) {
                const handleInfo = layer.detectHandle(point);
                if (layer.updateCursor) {
                    layer.updateCursor(handleInfo);
                }
                return;
            }

            // Handle active drag operation for rotate
            if (interactionState.isDragging && interactionState.activeHandle === 'rotate') {
                const feature = interactionState.activeFeature;
                const center = feature.centroid;
                const centerPixel = map.project(center);
                
                // Calculate rotation angle in 2D screen space
                const angle = Math.atan2(e.point.y - centerPixel.y, e.point.x - centerPixel.x);
                const startAngle = Math.atan2(
                    interactionState.startPosition.y - centerPixel.y,
                    interactionState.startPosition.x - centerPixel.x
                );
                const deltaAngle = (angle - startAngle) * (180 / Math.PI);
                const newRotation = (interactionState.startRotation + deltaAngle) % 360;
                
                // Update feature rotation (Y-axis rotation to keep building upright)
                feature.transform.rotateY = newRotation * -(Math.PI / 180);
                
                // Update feature properties to track rotation
                feature.properties.rotation = newRotation;
                
                map.triggerRepaint();
            }
        };

        interactionState.mouseDownHandler = (e) => {
            const point = { x: e.point.x, y: e.point.y };
            
            if (layer.detectHandle) {
                const handleInfo = layer.detectHandle(point);
                
                if (handleInfo && handleInfo.type === 'boundingBox') {
                    interactionState.activeHandle = 'rotate';
                    interactionState.isDragging = true;
                    interactionState.startPosition = point;
                    
                    // Extract current rotation from transform
                    const currentRotateY = interactionState.activeFeature.transform.rotateY || 0;
                    interactionState.startRotation = currentRotateY * -(180 / Math.PI);
                    
                    map.getCanvas().style.cursor = 'grabbing';
                    map.dragPan.disable();
                    e.preventDefault();
                }
            }
        };

        interactionState.mouseUpHandler = (e) => {
            if (interactionState.isDragging) {
                interactionState.isDragging = false;
                interactionState.activeHandle = null;
                map.dragPan.enable();
                
                const point = { x: e.point.x, y: e.point.y };
                if (layer.detectHandle) {
                    const handleInfo = layer.detectHandle(point);
                    if (layer.updateCursor) {
                        layer.updateCursor(handleInfo);
                    }
                }
            }
        };

        map.on('mousemove', interactionState.mouseMoveHandler);
        map.on('mousedown', interactionState.mouseDownHandler);
        map.on('mouseup', interactionState.mouseUpHandler);
    };

    /**
     * Attach event handlers for scale mode
     */
    const attachScaleHandlers = () => {
        interactionState.mouseMoveHandler = (e) => {
            const point = { x: e.point.x, y: e.point.y };

            if (!interactionState.isDragging && layer.detectHandle) {
                const handleInfo = layer.detectHandle(point);
                if (layer.updateCursor) {
                    layer.updateCursor(handleInfo);
                }
                return;
            }

            // Handle active drag operation for scale
            if (interactionState.isDragging && interactionState.activeHandle === 'scale') {
                const feature = interactionState.activeFeature;
                const center = feature.centroid;
                const centerPixel = map.project(center);
                
                const currentDistance = Math.sqrt(
                    Math.pow(e.point.x - centerPixel.x, 2) + 
                    Math.pow(e.point.y - centerPixel.y, 2)
                );
                const startDistance = Math.sqrt(
                    Math.pow(interactionState.startPosition.x - centerPixel.x, 2) + 
                    Math.pow(interactionState.startPosition.y - centerPixel.y, 2)
                );
                
                const scaleFactor = startDistance > 0 ? currentDistance / startDistance : 1;
                const newScale = Math.max(0.1, Math.min(3.0, interactionState.startScale * scaleFactor));
                
                // Update feature scale
                const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(center, 0);
                feature.transform.scale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits() * newScale;
                
                // Update feature properties to track size
                feature.properties.size = newScale;
                
                map.triggerRepaint();
            }
        };

        interactionState.mouseDownHandler = (e) => {
            const point = { x: e.point.x, y: e.point.y };
            
            if (layer.detectHandle) {
                const handleInfo = layer.detectHandle(point);
                
                if (handleInfo && handleInfo.type === 'scaleHandle') {
                    interactionState.activeHandle = 'scale';
                    interactionState.isDragging = true;
                    interactionState.startPosition = point;
                    
                    // Extract current scale from transform
                    const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
                        interactionState.activeFeature.centroid,
                        0
                    );
                    const baseScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
                    interactionState.startScale = interactionState.activeFeature.transform.scale / baseScale;
                    
                    map.getCanvas().style.cursor = 'nw-resize';
                    map.dragPan.disable();
                    e.preventDefault();
                }
            }
        };

        interactionState.mouseUpHandler = (e) => {
            if (interactionState.isDragging) {
                interactionState.isDragging = false;
                interactionState.activeHandle = null;
                map.dragPan.enable();
                
                const point = { x: e.point.x, y: e.point.y };
                if (layer.detectHandle) {
                    const handleInfo = layer.detectHandle(point);
                    if (layer.updateCursor) {
                        layer.updateCursor(handleInfo);
                    }
                }
            }
        };

        map.on('mousemove', interactionState.mouseMoveHandler);
        map.on('mousedown', interactionState.mouseDownHandler);
        map.on('mouseup', interactionState.mouseUpHandler);
    };

    return {
        // Layer-wide visibility control
        show: () => layer.show3DGraphics && layer.show3DGraphics(),
        hide: () => layer.hide3DGraphics && layer.hide3DGraphics(),
        toggle: () => layer.toggle3DGraphics && layer.toggle3DGraphics(),
        isVisible: () => layer.is3DGraphicsVisible && layer.is3DGraphicsVisible(),

        // Individual feature visibility control
        showFeatures: (featureIds) => layer.showFeatures && layer.showFeatures(featureIds),
        hideFeatures: (featureIds) => layer.hideFeatures && layer.hideFeatures(featureIds),
        toggleFeatures: (featureIds, forceVisible = null) => layer.toggleFeatures && layer.toggleFeatures(featureIds, forceVisible),
        getFeatureVisibility: (featureIds) => layer.getFeatureVisibility && layer.getFeatureVisibility(featureIds),
        getAllFeatureVisibility: () => layer.getAllFeatureVisibility && layer.getAllFeatureVisibility(),

        // Transformation controls with visual overlays and callbacks
        enableMove,
        enableRotate,
        enableScale,
        disableInteraction,
        
        // Programmatic transform update
        updateTransform: (featureId, transform, updateWrapper = true) => {
            return update3DGraphicTransform(map, sourceId, featureId, transform, updateWrapper);
        },
        
        // Get feature transform data
        getFeatureTransform: (featureId) => {
            const keyProperty = layer.metadata?.featureInfo?.idProperty || 'buildingId';
            const feature = layer.features.find(f => f.properties[keyProperty] === featureId);
            
            if (!feature) {
                console.warn(`Feature not found: ${featureId}`);
                return null;
            }
            
            return {
                centroid: feature.centroid,
                rotation: feature.properties.rotation ?? 0,
                size: feature.properties.size ?? 1,
                transform: { ...feature.transform },
                properties: { ...feature.properties }
            };
        },
        
        // Get current interaction state
        getInteractionState: () => ({
            mode: interactionState.mode,
            activeFeatureId: interactionState.activeFeatureId,
            isDragging: interactionState.isDragging
        }),

        // Direct layer access for advanced usage
        layer: layer
    };
}

/**
 * Create a 3D custom layer for graphics rendering
 * @param {string} layerId - The layer ID
 * @param {Array} features - Array of GeoJSON features
 * @param {Map} loadedGraphics - Map of loaded graphic geometries
 * @param {Object} level - The level definition
 * @param {Function} getContext - Function to get Redux context and graphic references
 * @returns {Object} - Mapbox custom layer object
 */
function createGraphicsCustomLayer(layerId, features, loadedGraphics, level, getContext) {
    console.log("createGraphicsCustomLayer", {layerId, features, loadedGraphics, level, getContext})
    const defaultModelAltitude = 0;
    const defaultModelRotate = [Math.PI / 2, 0, 0];

    return {
        id: layerId,
        type: 'custom',
        renderingMode: '3d',
        metadata: {
            type: '3d-graphics-layer',
            description: '3D Graphics Features Layer',
            featureInfo: {
                idProperty: level.idKey || 'id',
                geometryType: '3d-mesh',
            }
        },
        features: [],
        // Visibility control for performance optimization
        _3dGraphicsVisible: false, // Default to hidden for better performance

        // Method to query features at a point
        queryFeatures: function(point) {
            if (!this.features.length) return [];
            // Define click tolerance in pixels
            const tolerance = 100; // pixels
            // Check each feature for proximity to click point
            return this.features.filter(f => {
                const p = this.map.project({ lng: f.centroid[0], lat: f.centroid[1] }); // -> pixel space
                const dx = point.x - p.x;
                const dy = point.y - p.y;
                return Math.sqrt(dx*dx + dy*dy) <= tolerance;
            }).map(f => ({
                type: 'Feature',
                id: f.properties.id,
                geometry: {
                    type: 'Point',
                    coordinates: f.centroid
                },
                properties: f.properties,
                layer: {
                    id: this.id,
                    type: this.metadata.type
                }
            }));
        },

        // Toggle methods for 3D graphics visibility control
        show3DGraphics: function() {
            console.log('Showing 3D graphics for layer:', this.id);
            this._3dGraphicsVisible = true;
            if (this.map) {
                this.map.triggerRepaint();
            }
        },

        hide3DGraphics: function() {
            console.log('Hiding 3D graphics for layer:', this.id);
            this._3dGraphicsVisible = false;
            if (this.map) {
                this.map.triggerRepaint();
            }
        },

        toggle3DGraphics: function() {
            if (this._3dGraphicsVisible) {
                this.hide3DGraphics();
            } else {
                this.show3DGraphics();
            }
            return this._3dGraphicsVisible;
        },

        is3DGraphicsVisible: function() {
            return this._3dGraphicsVisible;
        },

        // Selective feature visibility control methods
        showFeatures: function(featureIds) {
            if (!Array.isArray(featureIds)) {
                featureIds = [featureIds];
            }

            let updated = false;
            const keyProperty = this.metadata.featureInfo.idProperty;

            featureIds.forEach(id => {
                const feature = this.features.find(f => f.properties[keyProperty] === id);
                if (feature && !feature._featureVisible) {
                    feature._featureVisible = true;
                    updated = true;
                    console.log(`Showing feature: ${id}`);
                }
            });

            if (updated && this.map) {
                this.map.triggerRepaint();
            }
            return updated;
        },

        hideFeatures: function(featureIds) {
            if (!Array.isArray(featureIds)) {
                featureIds = [featureIds];
            }

            let updated = false;
            const keyProperty = this.metadata.featureInfo.idProperty;

            featureIds.forEach(id => {
                const feature = this.features.find(f => f.properties[keyProperty] === id);
                if (feature && feature._featureVisible) {
                    feature._featureVisible = false;
                    updated = true;
                    console.log(`Hiding feature: ${id}`);
                }
            });

            if (updated && this.map) {
                this.map.triggerRepaint();
            }
            return updated;
        },

        toggleFeatures: function(featureIds, forceVisible = null) {
            if (!Array.isArray(featureIds)) {
                featureIds = [featureIds];
            }

            let updated = false;
            const keyProperty = this.metadata.featureInfo.idProperty;

            featureIds.forEach(id => {
                const feature = this.features.find(f => f.properties[keyProperty] === id);
                if (feature) {
                    const newVisibility = forceVisible !== null ? forceVisible : !feature._featureVisible;
                    if (feature._featureVisible !== newVisibility) {
                        feature._featureVisible = newVisibility;
                        updated = true;
                        console.log(`${newVisibility ? 'Showing' : 'Hiding'} feature: ${id}`);
                    }
                }
            });

            if (updated && this.map) {
                this.map.triggerRepaint();
            }
            return updated;
        },

        // Get visibility state of specific features
        getFeatureVisibility: function(featureIds) {
            if (!Array.isArray(featureIds)) {
                featureIds = [featureIds];
            }

            const keyProperty = this.metadata.featureInfo.idProperty;
            const result = {};

            featureIds.forEach(id => {
                const feature = this.features.find(f => f.properties[keyProperty] === id);
                result[id] = feature ? feature._featureVisible : null;
            });

            return featureIds.length === 1 ? result[featureIds[0]] : result;
        },

        // Get all feature IDs and their visibility states
        getAllFeatureVisibility: function() {
            const keyProperty = this.metadata.featureInfo.idProperty;
            const result = {};

            this.features.forEach(feature => {
                const id = feature.properties[keyProperty];
                result[id] = feature._featureVisible;
            });

            return result;
        },

        // Start editing an existing feature with visual handles
        startEditingFeature: function(featureId) {
            console.log("Starting edit for feature:", featureId);
            
            // Clear any existing editing state first
            this.clearEditingState();
            
            // Find the feature to edit
            const feature = this.features.find(f => f.properties[this.metadata.featureInfo.idProperty] === featureId);
            if (!feature) {
                console.error("Feature not found for editing:", featureId);
                return false;
            }

            // Set editing state
            this.editingFeatureId = featureId;
            
            // Apply editing opacity (0.7) to this specific feature
            this.setFeatureOpacity(feature, 0.7);
            
            // Create handles for this specific feature
            const handleGroup = this.createHandleGroup(feature);
            if (handleGroup) {
                feature.handles = handleGroup;
                feature.model.add(handleGroup);
            }
            
            return true;
        },

        // Clear editing state and remove handles from any existing graphics
        clearEditingState: function() {
            this.features.forEach(feature => {
                if (feature.handles) {
                    // Remove handles from the feature
                    feature.model.remove(feature.handles);
                    // Dispose of handle resources
                    this.disposeHandleGroup(feature.handles);
                    feature.handles = null;
                }
                // Restore full opacity
                this.setFeatureOpacity(feature, 1.0);
            });
            this.editingFeatureId = null;
        },

        // Set opacity for a specific feature
        setFeatureOpacity: function(feature, opacity) {
            const targetModel = feature.modelMesh || feature.model;
            targetModel.traverse((node) => {
                if (node.isMesh && node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(mat => {
                            mat.transparent = opacity < 1.0;
                            mat.opacity = opacity;
                        });
                    } else {
                        node.material.transparent = opacity < 1.0;
                        node.material.opacity = opacity;
                    }
                }
            });
        },

        // Dispose of handle group resources
        disposeHandleGroup: function(handleGroup) {
            if (!handleGroup) return;
            handleGroup.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        },

        // Create handle group for a specific feature
        createHandleGroup: function(feature) {
            // Get geometry info from loaded geometries if available
            const geometryInfo = globalLoadedGeometries.get(feature.graphicId);
            if (!geometryInfo) {
                console.error('Geometry info not available for feature handles:', feature.graphicId);
                return null;
            }

            const handleGroup = new THREE.Group();
            handleGroup.name = 'editingHandles';
            
            const bbox = geometryInfo.boundingBox;
            
            // Building outline box - covers entire building shape
            const boxGeometry = new THREE.BoxGeometry(
                bbox.max.x - bbox.min.x,
                bbox.max.y - bbox.min.y,
                bbox.max.z - bbox.min.z
            );
            const boxMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                wireframe: true,
                transparent: true,
                opacity: 0.6
            });
            const boundingBoxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
            boundingBoxMesh.position.y = (bbox.max.y + bbox.min.y) / 2;
            boundingBoxMesh.userData = { type: 'boundingBox', isEditingHandle: true };
            handleGroup.add(boundingBoxMesh);

            // Scale handles (corner cubes)
            const handleSize = 0.05;
            const scalePositions = [
                [bbox.max.x, bbox.max.y, bbox.max.z], // top-front-right
                [bbox.min.x, bbox.max.y, bbox.max.z], // top-front-left
                [bbox.max.x, bbox.min.y, bbox.max.z], // top-back-right
                [bbox.min.x, bbox.min.y, bbox.max.z]  // top-back-left
            ];

            scalePositions.forEach((pos, index) => {
                const handleGeometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
                const scaleHandleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const handle = new THREE.Mesh(handleGeometry, scaleHandleMaterial);
                handle.position.set(pos[0], pos[1], pos[2]);
                handle.userData = { type: 'scaleHandle', index, isEditingHandle: true };
                handleGroup.add(handle);
            });

            // Center move handle
            const moveGeometry = new THREE.SphereGeometry(0.03, 16, 16);
            const moveMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
            const moveHandle = new THREE.Mesh(moveGeometry, moveMaterial);
            moveHandle.position.set(0, bbox.max.y + 0.05, 0);
            moveHandle.userData = { type: 'moveHandle', isEditingHandle: true };
            handleGroup.add(moveHandle);

            return handleGroup;
        },

        // Handle detection using distance-based approach
        detectHandle: function(point) {
            console.log("detectHandle called", {point, editingFeatureId: this.editingFeatureId});
            
            // Check for editing handles on existing features
            if (this.editingFeatureId) {
                const editingFeature = this.features.find(f => f.properties[this.metadata.featureInfo.idProperty] === this.editingFeatureId);
                if (editingFeature && editingFeature.handles) {
                    return this.detectHandleAtPosition(point, editingFeature);
                }
            }
            
            console.log("No handles available for detection");
            return null;
        },

        // Common handle detection logic for features
        detectHandleAtPosition: function(point, feature) {
            // Simple distance-based detection
            const canvas = this.map.getCanvas();
            
            // Get the feature's screen position
            const featureWorldPosition = new THREE.Vector3(
                feature.transform.translateX,
                feature.transform.translateY,
                feature.transform.translateZ
            );

            // Convert world position to lng/lat using map transform
            const mercatorCoord = {
                x: feature.transform.translateX,
                y: feature.transform.translateY,
                z: feature.transform.translateZ
            };
            const featureLngLat = this.map.transform.coordinateLocation(mercatorCoord);
            
            const featureScreenPos = this.map.project(featureLngLat);
            
            // Calculate distance from click point to feature center
            const distanceToCenter = Math.sqrt(
                Math.pow(point.x - featureScreenPos.x, 2) + 
                Math.pow(point.y - featureScreenPos.y, 2)
            );
            
            console.log("Distance calculation", {
                clickPoint: point,
                featureScreenPos,
                distanceToCenter
            });

            // Define interaction zones (in pixels)
            const moveHandleRadius = 30;        // Blue sphere - move
            const scaleHandleRadius = 50;       // Red cubes - scale  
            const boundingBoxRadius = 80;       // Blue wireframe - rotate
            
            // Check which handle zone we're in (from innermost to outermost)
            if (distanceToCenter <= moveHandleRadius) {
                console.log("Detected move handle (blue sphere)");
                return {
                    type: 'moveHandle',
                    index: 0,
                    object: null,
                    point: point,
                    feature: feature
                };
            } else if (distanceToCenter <= scaleHandleRadius) {
                console.log("Detected scale handle (red cubes)");
                return {
                    type: 'scaleHandle',
                    index: 0,
                    object: null,
                    point: point,
                    feature: feature
                };
            } else if (distanceToCenter <= boundingBoxRadius) {
                console.log("Detected bounding box (blue wireframe - rotation)");
                return {
                    type: 'boundingBox',
                    index: 0,
                    object: null,
                    point: point,
                    feature: feature
                };
            }

            console.log("No handle detected");
            return null;
        },

        // Update cursor based on handle hover
        updateCursor: function(handleInfo) {
            const canvas = this.map.getCanvas();
            if (!handleInfo) {
                canvas.style.cursor = 'default';
                return;
            }

            switch(handleInfo.type) {
                case 'moveHandle':
                    canvas.style.cursor = 'move';        // Blue sphere - move
                    break;
                case 'scaleHandle':
                    canvas.style.cursor = 'nw-resize';   // Red cubes - scale
                    break;
                case 'boundingBox':
                    canvas.style.cursor = 'grab';        // Blue wireframe - rotate
                    break;
                default:
                    canvas.style.cursor = 'pointer';
            }
        },

        // Create optimized instance that shares geometries for better memory efficiency
        createModelInstance: function(scene, cloneMaterials = false, materialOverrides = null) {
            if (materialOverrides) {
                return createThemedInstance(scene, materialOverrides);
            }
            return createOptimizedInstance(scene, cloneMaterials);
        },

        // Apply theming based on feature properties
        applyFeatureTheming: function(modelScene, properties) {
            if (!properties) return;

            // Check for common color properties
            const colorProps = ['color', 'Color', 'fill-color', 'fillColor', 'material_color'];
            const opacityProps = ['opacity', 'Opacity', 'alpha', 'transparency'];

            let color = null;
            let opacity = null;

            // Find color from properties
            for (const prop of colorProps) {
                if (properties[prop]) {
                    color = properties[prop];
                    break;
                }
            }

            // Find opacity from properties
            for (const prop of opacityProps) {
                if (properties[prop] !== undefined) {
                    opacity = parseFloat(properties[prop]);
                    break;
                }
            }

            // Apply theming if found
            if (color || opacity !== null) {
                applyColorToModel(modelScene, color, opacity);
                console.log(`Applied theming: color=${color}, opacity=${opacity}`);
            }
        },

        onAdd: function(map, gl) {
            console.log('Initializing 3D graphics layer');

            this.camera = new THREE.Camera();
            this.scene = new THREE.Scene();

            // Create directional lights for better illumination
            const directionalLight = new THREE.DirectionalLight(0xffffff);
            directionalLight.position.set(0, -70, 100).normalize();
            this.scene.add(directionalLight);

            const directionalLight2 = new THREE.DirectionalLight(0xffffff);
            directionalLight2.position.set(0, 70, 100).normalize();
            this.scene.add(directionalLight2);

            // Create WebGL renderer
            this.renderer = new THREE.WebGLRenderer({
                canvas: map.getCanvas(),
                context: gl,
                antialias: true
            });
            this.renderer.autoClear = false;
            this.map = map;

            // Process features and create 3D models
            this.updateFeatures(features, loadedGraphics, getContext);

            console.log('3D graphics layer initialized');
        },

        updateFeatures: function(newFeatures, graphics, contextGetter) {
            if (!this.scene) return;

            // Clear existing features and dispose resources properly
            this.features.forEach(feature => {
                if (feature.model) {
                    // Properly dispose of THREE.js resources before removing from scene
                    disposeObject3D(feature.model);
                    this.scene.remove(feature.model);
                }
            });
            this.features = [];

            // Get Redux state for structure lookup
            const contextData = contextGetter ? contextGetter() : {};
            const { reduxState } = contextData;

            const structures = reduxState?.pageComponentState?.structures || {};
            console.log(`Processing ${newFeatures.length} features with ${Object.keys(structures).length} structures`);

            // Process each feature using the new approach
            newFeatures.forEach(feature => {
                // Extract centroid from longitude/latitude fields
                const longitude = feature.properties?.longitude;
                const latitude = feature.properties?.latitude;

                if (!longitude || !latitude) {
                    console.warn(`Feature ${feature.properties?.id} missing longitude/latitude:`, feature.properties);
                    return;
                }

                const centroid = [parseFloat(longitude), parseFloat(latitude)];

                // Get structureName from feature and lookup graphic using new chain
                const structureName = feature.properties?.structureName;
                if (!structureName) {
                    console.warn(`Feature ${feature.properties?.id} missing structureName:`, feature.properties);
                    return;
                }

                // Lookup graphic using new chain: structureName -> structures -> mapGraphicRefId -> graphicReferencesMap
                const graphicId = getGraphicIdFromStructureName(structureName, reduxState);
                if (!graphicId) {
                    console.warn(`No graphic found for structureName ${structureName}`);
                    return;
                }

                // Get cached geometry
                const geometryInfo = graphics.get(graphicId);
                if (!geometryInfo) {
                    console.warn(`No cached geometry found for graphic ${graphicId}`);
                    return;
                }

                // Use addModelInstance to add the feature
                // const instanceId = feature.properties?.id || `feature-${Date.now()}-${Math.random()}`;
                const instanceId = feature.properties.buildingId;
                const success = this.addModelInstance(graphicId, centroid, instanceId, geometryInfo, feature.properties);

                if (success) {
                    // Update the added feature with original properties
                    const addedFeature = this.features[this.features.length - 1];
                    if (addedFeature) {
                        addedFeature.properties = {
                            ...addedFeature.properties,
                            ...feature.properties,
                            centroid: centroid,
                            structureName: structureName,
                            graphicId: graphicId
                        };
                    }
                }
            });

            console.log(`Updated 3D graphics layer with ${this.features.length} features using addModelInstance`);
            //repainiting after feature update - this line was moved here from "render" to prevent infinite loop
            this.map.triggerRepaint();
        },

        addModelInstance: function(graphicId, centroid, instanceId, geometryInfo, featureProperties = null) {
            console.log(`Adding new model instance: ${instanceId} at [${centroid}]`);

            if (!geometryInfo) {
                console.error('No geometry info available for graphic:', graphicId);
                return false;
            }

            const { meshCount, totalVertices, bbox } = geometryInfo;

            // Create an optimized instance that shares geometries but clones materials to preserve colors
            // This maintains performance (shared geometry) while allowing individual colors/materials
            const featureScene = this.createModelInstance(geometryInfo.scene, true);

            // Apply feature-based theming if properties contain color information
            if (featureProperties) {
                this.applyFeatureTheming(featureScene, featureProperties);
            }

            console.log(`Created optimized instance for ${instanceId}: sharing geometry (${totalVertices} vertices) with individual materials`);

            // Extract rotation and size from feature properties with fallback values
            const rotation = featureProperties?.rotation ?? 0; // Default rotation: 0 degrees
            const sizeProportion = featureProperties?.size ?? 1; // Default size proportion: 1

            // Calculate model transform for this instance
            const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
                centroid,
                0 // defaultModelAltitude
            );

            const modelTransform = {
                translateX: modelAsMercatorCoordinate.x,
                translateY: modelAsMercatorCoordinate.y,
                translateZ: modelAsMercatorCoordinate.z,
                rotateX: Math.PI / 2, // Fixed: 90° to make building stand upright (never changes)
                rotateY: rotation * -(Math.PI / 180), // Variable: user-controlled rotation around vertical axis
                rotateZ: 0, // Fixed: 0° to prevent tilting (never changes)
                scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits() * sizeProportion
            };

            const keyProperty = this.metadata.featureInfo.idProperty

            // Create feature information for the custom layer
            const feature = {
                model: featureScene,
                centroid: centroid,
                layer: this,
                transform: modelTransform,
                graphicId: graphicId,
                // Individual feature visibility control
                _featureVisible: true, // Default to visible for individual features
                properties: {
                    [keyProperty]: instanceId,
                    name: 'Placed 3D Model',
                    type: '3d_model',
                    graphic: graphicId,
                    attributes: {
                        mesh_count: meshCount,
                        total_vertices: totalVertices,
                        bbox,
                        shared_geometry: true,
                        geometry_url: geometryInfo.modelUrl,
                        placed_instance: true
                    }
                }
            };

            // Add to features array and scene
            this.features.push(feature);
            this.scene.add(featureScene);

            console.log('New model instance added successfully:', instanceId);
            return true;
        },


        render: function(gl, matrix) {
            // Skip rendering entirely if 3D graphics are hidden for performance optimization
            if (!this._3dGraphicsVisible || !this.renderer || !this.features.length) return;

            this.renderer.resetState();

            // Store original visibility states (following npa-mmv pattern)
            const originalVisibility = new Map();
            this.features.forEach(f => {
                originalVisibility.set(f, f.model.visible);
            });

            // Process each feature with its own transform
            this.features.forEach(feature => {
                // Skip rendering if this feature's model is set to invisible or feature is individually hidden
                if (!originalVisibility.get(feature) || !feature._featureVisible) {
                    return;
                }

                const transform = feature.transform;

                const rotationX = new THREE.Matrix4().makeRotationAxis(
                    new THREE.Vector3(1, 0, 0),
                    transform.rotateX
                );
                const rotationY = new THREE.Matrix4().makeRotationAxis(
                    new THREE.Vector3(0, 1, 0),
                    transform.rotateY
                );
                const rotationZ = new THREE.Matrix4().makeRotationAxis(
                    new THREE.Vector3(0, 0, 1),
                    transform.rotateZ
                );

                const m = new THREE.Matrix4().fromArray(matrix);
                const l = new THREE.Matrix4()
                    .makeTranslation(
                        transform.translateX,
                        transform.translateY,
                        transform.translateZ
                    )
                    .scale(
                        new THREE.Vector3(
                            transform.scale,
                            -transform.scale,
                            transform.scale
                        )
                    )
                    .multiply(rotationX)
                    .multiply(rotationY)
                    .multiply(rotationZ);

                this.camera.projectionMatrix = m.multiply(l);

                // Temporarily set visibility for rendering this feature only
                feature.model.visible = true;
                this.features.forEach(f => {
                    if (f !== feature) f.model.visible = false;
                });

                this.renderer.render(this.scene, this.camera);
            });

            // Restore original visibility states (following npa-mmv pattern)
            this.features.forEach(f => {
                f.model.visible = originalVisibility.get(f);
            });
        },

        // Clean up all resources when layer is removed
        onRemove: function() {
            console.log('Cleaning up 3D graphics layer resources');

            // Dispose of all feature models
            if (this.features) {
                this.features.forEach(feature => {
                    if (feature.model) {
                        disposeObject3D(feature.model);
                    }
                });
                this.features = [];
            }

            // Clean up scene
            if (this.scene) {
                this.scene.clear();
                this.scene = null;
            }

            // Clean up renderer
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }

            console.log('3D graphics layer cleanup complete');
        }
    };
}

// Main function to add all feature layers from a namedPath
export async function addAllFeatureLayers({ map, namedPath, sendBack, getContext }) {
    const allFeatureLayers = {}
    let parentFeatures = [];

    // Access Redux state through getContext if available
    const contextData = getContext ? getContext() : {};
    window.contextData = contextData;
    const { reduxState, reduxDispatch } = contextData;

    let loadedGraphics = new Map();
    // if (reduxState?.pageComponentState?.mapGraphicReferences) {
    //     console.log('Loading graphics from Redux state...');
    //     window.reduxState = reduxState;
    //     window.namedPath = namedPath;
        // loadedGraphics = await loadGraphics(reduxState.pageComponentState.mapGraphicReferences);
    //     console.log(`Loaded ${loadedGraphics.size} graphics for use in features`);

    //     // Keep backward compatibility - create graphicsDict for reference lookup
    //     const graphicsDict = Object.fromEntries(
    //         reduxState.pageComponentState.mapGraphicReferences.map(g => [g._id, g.graphic])
    //     );
    // }


    for (const level of namedPath) {
        if (!level.feature) continue;

        const options = level.options || {};
        const clusterOptions = options.cluster || {};
        const {sourceOptions} = clusterOptions;

        const features = await fetchFeaturesForLevel(level, parentFeatures);

        if(level.feature === "mesh" && reduxState?.pageComponentState?.mapGraphicReferences){
            try{
                window.features = features;

                const foundStructures = features.map(f => f.properties.structureName).filter((el, i, s) => s.indexOf(el) === i).map(el => reduxState.pageComponentState.structures[el]).filter(el => el)

                let graphicDict = Object.assign({}, ...reduxState.pageComponentState.mapGraphicReferences
                    .map(r => ({[r._id]: r.graphic})));

                const graphicIds = foundStructures.map(el => graphicDict[el.mapGraphicRefId])
                    .filter((el, i, s) => el && s.indexOf(el) === i);
                window.graphicIds = graphicIds;

                loadedGraphics = await loadGraphics(graphicIds);

                // if(graphicIds.length){
                //     console.log('Loading graphics from Redux state...');
                //     loadedGraphics = await loadGraphics(graphicIds);
                // }

                console.log(`Loaded ${loadedGraphics.size} graphics for use in features`);

            } catch(e){
                console.error("FAILED_TO_IMPROVE", e);
            }
        }


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

        // Handle different feature types
        if (level.feature === 'mesh') {
            // For graphic features, create a 3D custom layer and transparent fill layer
            await setupGraphicLayers({ map, sourceId, level, features: turfFeatures, loadedGraphics, namedPath, sendBack, getContext });
        } else {
            // Always add/update UNCLUSTERED layer for non-graphic features
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
export function addFeatureToMapLayer({ map, levelState, feature, namedPath: levelDef }) {
    const sourceId = `${levelState}-features`;

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
export function removeFeatureFromMapLayer({ map, levelState, featureId, idKey, namedPath: levelDef }) {
    const sourceId = `${levelState}-features`;

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
    const { map, namedPaths, reduxStore, reduxDispatch } = context;
    if (!map || !namedPaths) return;

    // Access Redux state if available
    let reduxState = null;
    if (reduxStore && reduxStore.getState) {
        reduxState = reduxStore.getState();
        console.log('Redux state accessible in addLayers:', reduxState);
    }

    const allFeatureLayers = await addAllFeatureLayers({
        map,
        namedPath: namedPaths[0],
        sendBack,
        getContext: self ? () => {
            const currentContext = self.getSnapshot().context;
            // Include Redux access in the context
            return {
                ...currentContext,
                reduxState: currentContext.reduxStore ? currentContext.reduxStore.getState() : null,
                reduxDispatch: currentContext.reduxDispatch
            };
        } : () => context
    });

    const afterLayerSetupCommands = await ScriptCache.runScript("afterLayerSetupCommands", {
        groupedFeatures: allFeatureLayers,
        reduxState,
        reduxDispatch
    });
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

            for (const markersInfo of markersConfig) {
                const {featureDef, config, ...restMarkerInfo} = markersInfo;
                const {path} = featureDef;

                const sourceId = path + "-features";
                if (e && e.sourceId === sourceId && e.hasOwnProperty("isSourceLoaded") && !e.isSourceLoaded) {
                    continue;
                } else if (e && e.sourceId !== sourceId && e.type == "sourcedata") {
                    continue;
                }

                const {graphics, visibleFeatures, allFeaturesMarkerIds, previousMarkerIds, currentMarkerIds, filters} = await renderAllMarkers(e, {self}, markersInfo);
                //console.log("UPDATE_FILTERS renderAllMarkers", {graphics, visibleFeatures, previousMarkerIds, currentMarkerIds, filters: filters});

                if (previousMarkerIds && previousMarkerIds.length > 0) {
                    const toRemove = previousMarkerIds.filter(id=>!currentMarkerIds.includes(id));
                    if(toRemove.length>0){
                        const commands = [{
                            commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
                            commandRef: uuid(),
                            params: {
                                ids: toRemove,//remove stale
                            }
                        }]
                        context.mmvSend(commands);
                        clearStaleMarkers(toRemove);
                    }
                }
                if (graphics && graphics.length > 0) {
                    const commands = [{
                        commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
                        commandRef: uuid(),
                        params: {
                            ids: allFeaturesMarkerIds,//remove stale
                        }
                    },{
                        commandName: MMV_COMMANDS.ADD_GRAPHICS,
                        commandRef: uuid(),
                        params: {
                            graphics: graphics
                        }
                    }]
                    context.mmvSend(commands);
                    graphics.forEach(graphic => {
                        addMarkers(graphic);//track markers internally
                    })
                }


                if (path == "site" && visibleFeatures && visibleFeatures.length > 0) {

                    const ids = visibleFeatures.map(f => f.properties["siteId"]);
                    const key = makeGlobalFilterKey({
                        layer: 'site-features-layer',
                        field: 'siteId',
                        ids,
                        invert: false,
                        filter: context.filters?.["site"]
                    });
                    if (ids.length && globalFilterKeys.get('site-features-layer') !== key) {
                        try {
                            context.mmvSend([
                                {
                                    commandName: MMV_COMMANDS.CUSTOM,
                                    commandRef: uuid(),
                                    params: {
                                        commandName: 'filtermodel',
                                        commandRef: uuid(),
                                        params: {
                                            clear: false,
                                            ids: ids,
                                            invert: false,
                                            extra: {
                                                //layerNames: ['site-features-layer','site-features-centroids-layer-circle'],
                                                layerNames: 'site-features-layer',
                                                field: 'siteId',
                                                fieldType: 'string'
                                            }
                                        }
                                    }

                                },
                                {
                                    commandName: MMV_COMMANDS.CUSTOM,
                                    commandRef: uuid(),
                                    params: {
                                        commandName: 'filtermodel',
                                        commandRef: uuid(),
                                        params: {
                                            clear: false,
                                            ids: ids,
                                            invert: false,
                                            extra: {
                                                //layerNames: ['site-features-layer','site-features-centroids-layer-circle'],
                                                layerNames: 'site-features-centroids-layer-circle',
                                                field: 'siteId',
                                                fieldType: 'string'
                                            }
                                        }
                                    }

                                }
                            ]);
                        } catch (e) {
                            console.error(e)
                        }
                    }

                    globalFilterKeys.set('site-features-layer', key);
                    globalFilterKeys.set('site-features-centroids-layer-circle', key);

                }

            }
        }


        if(context.map) {
            context.map.on('moveend', manageMarkers);
            context.map.on('idle', manageMarkers);
            context.map.on('sourcedata', manageMarkers);
        }
        manageMarkers();
    }

    return {manageMarkers}
}

export async function getInitAction({mapMachineInput }) {
    return addLayers(mapMachineInput)
}
export async function getEntryAction({mapMachineInput }) {
    const {stateValue, context, event, self} = mapMachineInput;

    const {suppressEntryActions} = context;

    if (suppressEntryActions) {
        return { suppressEntryActions: false };
    }

    switch (stateValue) {
        case 'portfolio': {

            //we are calling the mapbox API imperatively here, we will replace that with commands in next task

            //using local script not global due to development mode
            //let { commands, theme = {}, singleMarkers, legend } = await ScriptCache.runScript("getEntryActionTheme", {suppressEntryActions, stateValue});
            let { commands, theme = {}, singleMarkers, legend } = await scriptModule.getEntryActionTheme( {suppressEntryActions, stateValue})
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
            const {manageMarkers} = await handleMarkers(stateValue, markersConfig, {context, self});

            if(globalFilterKeys.get('site-features-layer')){
                context.mmvSend([{
                    commandName: MMV_COMMANDS.CUSTOM,
                    commandRef: uuid(),
                    params: {
                        commandName: 'filtermodel',
                        commandRef: uuid(),
                        params: {
                            clear: true,
                            extra: {
                                //layerNames: ['site-features-layer','site-features-centroids-layer-circle'],
                                layerNames: 'site-features-centroids-layer-circle',
                            }
                        }
                    }
                }])
            }
            if(globalFilterKeys.get('site-features-centroids-layer-circle')){
                context.mmvSend([{
                    commandName: MMV_COMMANDS.CUSTOM,
                    commandRef: uuid(),
                    params: {
                        commandName: 'filtermodel',
                        commandRef: uuid(),
                        params: {
                            clear: true,
                            extra: {
                                //layerNames: ['site-features-layer','site-features-centroids-layer-circle'],
                                layerNames: 'site-features-layer',
                                field: 'siteId',
                                fieldType: 'string'
                            }
                        }
                    }
                }])
            }

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

/**
 * Helper function to add cube wrapper for a single building
 * @param {Object} params - Parameters for adding cube wrapper
 * @param {mapboxgl.Map} params.map - Mapbox map instance
 * @param {string} params.buildingId - Building ID
 * @param {Array} params.centroid - [longitude, latitude] coordinates
 * @param {Object} params.geometryInfo - Geometry information from loaded graphics
 * @param {Function} params.getContext - Function to get Redux context
 * @param {Object} params.featureProperties - Optional feature properties (for rotation and size)
 */
function addCubeWrapperForBuilding({ map, buildingId, centroid, geometryInfo, getContext, featureProperties = {} }) {
    const sourceId = 'building-features';
    const wrapperLayerId = 'building-features-layer';

    // Get existing source
    const existingSource = map.getSource(sourceId);
    if (!existingSource) {
        console.warn(`Source not found: ${sourceId}`);
        return false;
    }

    // Default cube size and height
    const defaultCubeSizeMeters = 20; // square footprint side length
    const defaultHeightMeters = 50;

    // Extract rotation and size from feature properties with defaults
    const rotation = featureProperties?.rotation ?? 0;
    const sizeProportion = featureProperties?.size ?? 1;

    // Helper function to convert meters to degrees
    const metersToDegrees = (meters, lat) => ({
        dLat: meters / 111320,
        dLon: meters / (111320 * Math.cos((lat * Math.PI) / 180))
    });

    const lng = parseFloat(centroid[0]);
    const lat = parseFloat(centroid[1]);

    // Get sizing information from geometry
    let height = defaultHeightMeters;
    let cubeSize = defaultCubeSizeMeters;

    if (geometryInfo && geometryInfo.sizeInMeters) {
        // Use actual model dimensions if available
        height = geometryInfo.sizeInMeters.height || defaultHeightMeters;
        cubeSize = Math.max(
            geometryInfo.sizeInMeters.width || defaultCubeSizeMeters,
            geometryInfo.sizeInMeters.depth || defaultCubeSizeMeters
        );
    }

    // Apply size proportion
    height *= sizeProportion;
    cubeSize *= sizeProportion;

    // Create cube footprint coordinates
    const { dLat, dLon } = metersToDegrees(cubeSize / 3, lat);
    const ring = [
        [lng - dLon, lat - dLat],
        [lng + dLon, lat - dLat],
        [lng + dLon, lat + dLat],
        [lng - dLon, lat + dLat],
        [lng - dLon, lat - dLat]
    ];

    // Create cube wrapper feature
    const cubeFeature = {
        type: 'Feature',
        id: buildingId,
        properties: {
            buildingId: buildingId,
            longitude: lng,
            latitude: lat,
            type: '3d_model',
            height: height,
            elevation: 0,
            rotation: rotation,
            size: sizeProportion,
            cube_wrapper: true, // Mark as wrapper feature
            ...featureProperties // Include any additional properties
        },
        geometry: {
            type: 'Polygon',
            coordinates: [ring]
        }
    };

    // Get current data and add the new cube wrapper
    const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };
    const updatedFeatures = [...(currentData.features || []), cubeFeature];
    const updatedFeatureCollection = {
        type: 'FeatureCollection',
        features: updatedFeatures
    };

    // Update the source with the new cube wrapper
    existingSource.setData(updatedFeatureCollection);

    console.log(`Added cube wrapper for building ${buildingId}:`, {
        position: centroid,
        rotation,
        size: sizeProportion,
        height
    });
    return true;
}

/**
 * Remove both 3D graphic and cube wrapper for a building
 * @param {Object} params - Parameters for removal
 * @param {mapboxgl.Map} params.map - Mapbox map instance
 * @param {string} params.featureId - Feature ID to remove
 * @param {string} params.entityType - Map Entity ID
 * @param {Object} params.namedPath - Named path configuration
 * @returns {boolean} - Success status
 */
export function removeMeshElementFromMap({ map, featureId, entityType, namedPath }) {
    console.log(`Removing mesh element ${featureId} from map`);

    let success = true;

    // Remove from 3D graphics layer
    const LayerId = `${entityType}-features-3d-graphics`;
    const meshLayer = map.getLayer(LayerId);

    if (meshLayer && meshLayer.features) {
        // Find and remove the feature from the 3D layer
        const featureIndex = meshLayer.features.findIndex(
            feature => feature.properties?.[namedPath.idKey] === featureId
        );

        if (featureIndex !== -1) {
            const feature = meshLayer.features[featureIndex];

            // Properly dispose of resources and remove the model from the scene
            if (feature.model && meshLayer.scene) {
                // Dispose of THREE.js resources before removing from scene
                disposeObject3D(feature.model);
                meshLayer.scene.remove(feature.model);
            }

            // Remove from features array
            meshLayer.features.splice(featureIndex, 1);
            console.log(`Removed mesh element ${featureId} from 3D graphics layer`);
        } else {
            console.warn(`mesh element ${featureId} not found in 3D graphics layer`);
            success = false;
        }
    } else {
        console.warn(`Mesh element 3D layer not found: ${LayerId}`);
        success = false;
    }

    // Remove cube wrapper from features source
    const sourceId = `${entityType}-features`;
    const existingSource = map.getSource(sourceId);

    if (existingSource) {
        const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };

        // Filter out the cube wrapper feature
        const filteredFeatures = (currentData.features || []).filter(feature => {
            const foundFeatureId = feature.properties?.[namedPath.idKey] || feature.id;
            return foundFeatureId !== featureId;
        });

        // Update the source with filtered data
        const updatedFeatureCollection = {
            type: 'FeatureCollection',
            features: filteredFeatures
        };
        existingSource.setData(updatedFeatureCollection);

        console.log(`Removed cube wrapper for building ${featureId}`);
    } else {
        console.warn(`Source not found: ${sourceId}`);
        success = false;
    }

    // Trigger map refresh/repaint
    map.triggerRepaint();

    if (success) {
        console.log(`Successfully removed building ${featureId} from map`);
    } else {
        console.error(`Failed to completely remove building ${featureId} from map`);
    }

    return success;
}

// External function to add a building model instance to the map
export function addBuildingToMap({ map, buildingId, centroid, graphicId, geometryInfo, entityType, getContext }) {
    console.log(`Adding building ${buildingId} to map at [${centroid}]`);

    if (!geometryInfo) {
        console.error('No geometry info available for graphic:', graphicId);
        return false;
    }

    // Find the 3D graphics layer for buildings
    const buildingLayerId = `${entityType}-features-3d-graphics`;
    const buildingLayer = map.getLayer(buildingLayerId);


    if (!buildingLayer) {
        console.warn(`Building 3D layer not found: ${buildingLayerId}`);
        return false;
    }

    // Use the layer's addModelInstance method
    const success = buildingLayer.addModelInstance(graphicId, centroid, buildingId, geometryInfo);


    if (success) {
        console.log(`Successfully added building ${buildingId} to 3D layer`);

        // // Add cube wrapper feature for the new building
        addCubeWrapperForBuilding({ map, buildingId, centroid, geometryInfo, getContext });

        // // Trigger map refresh/repaint
        map.triggerRepaint();
        return true;
    } else {
        console.error(`Failed to add building ${buildingId} to 3D layer`);
        return false;
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
            if(markerIds && markerIds.length) {
                const commands = [{
                    commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
                    commandRef: uuid(),
                    params: {
                        ids: [...markerIds],
                    }
                }]
                context.mmvSend(commands);
            }

            return { manageMarkers: {...context.manageMarkers, [stateValue]: null } };
        }
        case 'portfolio.site': {

            if(context.manageMarkers[stateValue]){
                context.map.off('moveend', context.manageMarkers[stateValue]);
                context.map.off('idle', context.manageMarkers[stateValue]);
                context.map.off('sourcedata', context.manageMarkers[stateValue]);
            }
            const markerIds = clearStaleMarkersByPath("building");
            if(markerIds && markerIds.length) {
                const commands = [{
                    commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
                    commandRef: uuid(),
                    params: {
                        ids: [...markerIds],
                    }
                }]
                context.mmvSend(commands);
            }

            return { manageMarkers: {...context.manageMarkers, [stateValue]: null } };
        }

        default:
            return {};
    }
}
