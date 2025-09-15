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
import { getCachedFile } from "../../services/utils.js";

// Global Map to store loaded geometries, accessible throughout the application
const globalLoadedGeometries = new Map();

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
export async function loadGraphics(graphicReferences) {
    const geometryLoadPromises = new Map();

    if (!graphicReferences || !Array.isArray(graphicReferences)) {
        console.warn('loadGraphics: No graphic references provided');
        return globalLoadedGeometries;
    }

    // Get unique graphic IDs
    const uniqueGraphicIds = [...new Set(graphicReferences.map(ref => ref.graphic))];
    console.log(`Loading ${uniqueGraphicIds.length} unique graphics for ${graphicReferences.length} references`);

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
        const results = await Promise.all(uniqueGraphicIds.map(id => loadGeometry(id)));
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

    // Get graphic references from Redux state
    const contextData = getContext ? getContext() : {};
    const { reduxState } = contextData;
    const graphicReferences = reduxState?.pageComponentState?.mapGraphicReferences || [];

    // Create lookup map for graphicReferences: graphicRefId -> graphic
    const graphicReferencesMap = new Map();
    graphicReferences.forEach(ref => {
        graphicReferencesMap.set(ref._id, ref.graphic);
    });

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

        // Get graphic information for sizing (optional - use defaults if not available)
        const graphicRefId = feature.properties?.graphicRefId;
        let height = defaultHeightMeters;
        let cubeSize = defaultCubeSizeMeters;

        if (graphicRefId) {
            const graphicId = graphicReferencesMap.get(graphicRefId);
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

        // Method to query features at a point
        queryFeatures: function(point) {
            if (!this.features.length) return [];

            // Check each feature for proximity to click point
            return this.features.filter(f => {
                const featurePoint = f.centroid;

                // Define click tolerance in pixels
                const tolerance = 100; // pixels

                // Simple distance check in pixel space
                const distance = Math.sqrt(
                    Math.pow(point.x - featurePoint[0], 2) +
                    Math.pow(point.y - featurePoint[1], 2)
                );

                return distance <= tolerance;
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

            // Get graphic references from Redux state
            const contextData = contextGetter ? contextGetter() : {};
            const { reduxState } = contextData;
            const graphicReferences = reduxState?.pageComponentState?.mapGraphicReferences || [];

            // Create lookup map for graphicReferences: graphicRefId -> graphic
            const graphicReferencesMap = new Map();
            graphicReferences.forEach(ref => {
                graphicReferencesMap.set(ref._id, ref.graphic);
            });

            console.log(`Processing ${newFeatures.length} features with ${graphicReferences.length} graphic references`);

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

                // Get graphicRefId from feature
                const graphicRefId = feature.properties?.graphicRefId;
                if (!graphicRefId) {
                    console.warn(`Feature ${feature.properties?.id} missing graphicRefId:`, feature.properties);
                    return;
                }

                // Lookup graphic using graphicRefId
                const graphicId = graphicReferencesMap.get(graphicRefId);
                if (!graphicId) {
                    console.warn(`No graphic reference found for graphicRefId ${graphicRefId}`);
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
                            graphicRefId: graphicRefId,
                            graphicId: graphicId
                        };
                    }
                }
            });

            console.log(`Updated 3D graphics layer with ${this.features.length} features using addModelInstance`);
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

            // Calculate model transform for this instance
            const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
                centroid,
                0 // defaultModelAltitude
            );

            const modelTransform = {
                translateX: modelAsMercatorCoordinate.x,
                translateY: modelAsMercatorCoordinate.y,
                translateZ: modelAsMercatorCoordinate.z,
                rotateX: Math.PI / 2, // defaultModelRotate[0]
                rotateY: 0, // defaultModelRotate[1]
                rotateZ: 0, // defaultModelRotate[2]
                scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits()
            };

            const keyProperty = this.metadata.featureInfo.idProperty

            // Create feature information for the custom layer
            const feature = {
                model: featureScene,
                centroid: centroid,
                layer: this,
                transform: modelTransform,
                graphicId: graphicId,
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
            if (!this.renderer || !this.features.length) return;

            this.renderer.resetState();

            // Store original visibility states (following npa-mmv pattern)
            const originalVisibility = new Map();
            this.features.forEach(f => {
                originalVisibility.set(f, f.model.visible);
            });

            // Process each feature with its own transform
            this.features.forEach(feature => {
                // Skip rendering if this feature's model is set to invisible
                if (!originalVisibility.get(feature)) {
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

            this.map.triggerRepaint();
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
    const { reduxState, reduxDispatch } = contextData;

    // Load graphics if Redux state is available and contains graphic references
    let loadedGraphics = new Map();
    if (reduxState?.pageComponentState?.mapGraphicReferences) {
        console.log('Loading graphics from Redux state...');
        loadedGraphics = await loadGraphics(reduxState.pageComponentState.mapGraphicReferences);
        console.log(`Loaded ${loadedGraphics.size} graphics for use in features`);

        // Keep backward compatibility - create graphicsDict for reference lookup
        const graphicsDict = Object.fromEntries(
            reduxState.pageComponentState.mapGraphicReferences.map(g => [g._id, g.graphic])
        );
    }


    for (const level of namedPath) {
        if (!level.feature) continue;

        const options = level.options || {};
        const clusterOptions = options.cluster || {};
        const {sourceOptions} = clusterOptions;

        const features = await fetchFeaturesForLevel(level, parentFeatures);
        console.log("featuresLevel", {features, level})
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

/**
 * Helper function to add cube wrapper for a single building
 * @param {Object} params - Parameters for adding cube wrapper
 * @param {mapboxgl.Map} params.map - Mapbox map instance
 * @param {string} params.buildingId - Building ID
 * @param {Array} params.centroid - [longitude, latitude] coordinates
 * @param {Object} params.geometryInfo - Geometry information from loaded graphics
 * @param {Function} params.getContext - Function to get Redux context
 */
function addCubeWrapperForBuilding({ map, buildingId, centroid, geometryInfo, getContext }) {
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
            cube_wrapper: true // Mark as wrapper feature
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

    console.log(`Added cube wrapper for building ${buildingId}`);
    return true;
}

/**
 * Remove both 3D graphic and cube wrapper for a building
 * @param {Object} params - Parameters for removal
 * @param {mapboxgl.Map} params.map - Mapbox map instance
 * @param {string} params.buildingId - Building ID to remove
 * @param {Array} params.namedPath - Named path configuration
 * @returns {boolean} - Success status
 */
export function removeBuildingFromMap({ map, buildingId, namedPath }) {
    console.log(`Removing building ${buildingId} from map`);

    let success = true;

    // Remove from 3D graphics layer
    const buildingLayerId = 'building-features-3d-graphics';
    const buildingLayer = map.getLayer(buildingLayerId);

    if (buildingLayer && buildingLayer.features) {
        // Find and remove the feature from the 3D layer
        const featureIndex = buildingLayer.features.findIndex(
            feature => feature.properties?.buildingId === buildingId
        );

        if (featureIndex !== -1) {
            const feature = buildingLayer.features[featureIndex];

            // Properly dispose of resources and remove the model from the scene
            if (feature.model && buildingLayer.scene) {
                // Dispose of THREE.js resources before removing from scene
                disposeObject3D(feature.model);
                buildingLayer.scene.remove(feature.model);
            }

            // Remove from features array
            buildingLayer.features.splice(featureIndex, 1);
            console.log(`Removed building ${buildingId} from 3D graphics layer`);
        } else {
            console.warn(`Building ${buildingId} not found in 3D graphics layer`);
            success = false;
        }
    } else {
        console.warn(`Building 3D layer not found: ${buildingLayerId}`);
        success = false;
    }

    // Remove cube wrapper from building-features source
    const sourceId = 'building-features';
    const existingSource = map.getSource(sourceId);

    if (existingSource) {
        const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };

        // Filter out the cube wrapper feature
        const filteredFeatures = (currentData.features || []).filter(feature => {
            const featureBuildingId = feature.properties?.buildingId || feature.id;
            return featureBuildingId !== buildingId;
        });

        // Update the source with filtered data
        const updatedFeatureCollection = {
            type: 'FeatureCollection',
            features: filteredFeatures
        };
        existingSource.setData(updatedFeatureCollection);

        console.log(`Removed cube wrapper for building ${buildingId}`);
    } else {
        console.warn(`Source not found: ${sourceId}`);
        success = false;
    }

    // Trigger map refresh/repaint
    map.triggerRepaint();

    if (success) {
        console.log(`Successfully removed building ${buildingId} from map`);
    } else {
        console.error(`Failed to completely remove building ${buildingId} from map`);
    }

    return success;
}

// External function to add a building model instance to the map
export function addBuildingToMap({ map, buildingId, centroid, graphicId, geometryInfo, namedPath, getContext }) {
    console.log(`Adding building ${buildingId} to map at [${centroid}]`);

    if (!geometryInfo) {
        console.error('No geometry info available for graphic:', graphicId);
        return false;
    }

    // Find the 3D graphics layer for buildings
    const buildingLayerId = 'building-features-3d-graphics';
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
