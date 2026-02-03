//TODO: replace this script with MMV COMMANDS
import mapboxgl from 'mapbox-gl';
import {
  point, multiPoint,
  lineString, multiLineString,
  polygon, multiPolygon, featureCollection
} from '@turf/helpers';
import { IafProj, IafSession } from '@dtplatform/platform-api';
import { MMV_COMMANDS } from '@invicara/ipa-core-mmv';
import { v4 as uuid } from 'uuid';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';
import {
  addMarkers, clearAllMarkers,
  clearStaleMarkers, getMarkers,
  renderAllMarkers
} from './mapMarkers.mjs';
import { ScriptCache } from '@invicara/ipa-core/modules/IpaUtils/index.js';
import { isColorProp, normalizeColorRGB } from './colorNormalization.mjs';
import { getCachedFile } from '../../services/utils.js';
import { setGraphicsGateLoading, setGraphicsGateReady } from '../../ipaCore/redux/graphicsGate.js';

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
 * ---------------------------------------------------------------------------
 * 3D INITIALIZATION GATE (prevents markers + other UI until custom layer onAdd)
 * ---------------------------------------------------------------------------
 *
 * We resolve this promise exactly when the custom 3D layer reaches:
 *   console.log('3D graphics layer initialized');
 *
 * IMPORTANT: we store the gate on the XState machine context reference.
 */
function ensure3DInitializedGate(context, key = 'global') {
  if (!context) return { promise: Promise.resolve(true), resolve: () => {}, done: true };
  context.__mmv3d = context.__mmv3d || {};
  if (!context.__mmv3d[key]) {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    context.__mmv3d[key] = { promise, resolve, done: false };
  }
  return context.__mmv3d[key];
}

function signal3DInitialized(context, key = 'global') {
  const gate = ensure3DInitializedGate(context, key);
  if (!gate.done) {
    gate.done = true;
    gate.resolve(true);
  }
}

async function waitFor3DInitialized(context, key = 'global', { timeoutMs = 15000 } = {}) {
  const gate = ensure3DInitializedGate(context, key);
  if (gate.done) return true;

  const expectedToken = context?._graphicsGateToken?.[key];

  return new Promise((resolve) => {
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(ok);
    };

    const onReady = (e) => {
        const stateValue = e?.detail?.stateValue;
        const token = e?.detail?.token;

        if (stateValue !== key) return;

        // if we expect a token, ignore events without it or with a mismatch
        if (expectedToken != null) {
            if (token == null) return;
            if (token !== expectedToken) return;
        }

        signal3DInitialized(context, key);
        finish(true);
    };

    const cleanup = () => {
      window.removeEventListener('mmv:3d-layer-initialized', onReady);
      if (timer) clearTimeout(timer);
    };

    window.addEventListener('mmv:3d-layer-initialized', onReady);

    const timer = setTimeout(() => finish(false), timeoutMs);

    gate.promise.then(() => finish(true)).catch(() => finish(false));
  });
}

export function getGeometryInfo(graphicId) {
    return globalLoadedGeometries.get(graphicId) || null;
}


import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { IafScriptEngine } from '@dtplatform/iaf-script-engine';
import scriptModule from '../../../setup/scripts/mmv_config.mjs';
import { DEFAULT_PATHS } from '../../ipaCore/pageComponents/portfolioOverview/PortfolioOverview.jsx';
import { FilterCompiler, getGlobalFilterFunctions } from '../../ipaCore/pageComponents/utils/filters.global.js';
import { ContentCutTwoTone } from '@mui/icons-material';

// Function to generate square coordinates around a centroid
// widthInMeters: width of the square in meters (default 500m)
// Returns array of [lng, lat] coordinates forming a closed polygon
export function generateSquareCoordinates(centerLng, centerLat, widthInMeters = 500) {
  // Convert meters to degrees (rough approximation)
  // 1 degree of longitude ≈ 111,320 meters * cos(latitude)
  // 1 degree of latitude ≈ 110,540 meters
  const halfWidthLng = (widthInMeters / 2) / (111320 * Math.cos(centerLat * Math.PI / 180));
  const halfWidthLat = (widthInMeters / 2) / 110540;

  // Create square coordinates (clockwise from top-left)
  return [
    [centerLng - halfWidthLng, centerLat + halfWidthLat], // Top-left
    [centerLng + halfWidthLng, centerLat + halfWidthLat], // Top-right
    [centerLng + halfWidthLng, centerLat - halfWidthLat], // Bottom-right
    [centerLng - halfWidthLng, centerLat - halfWidthLat], // Bottom-left
    [centerLng - halfWidthLng, centerLat + halfWidthLat]  // Close polygon
  ];
}

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
          node.material.forEach((mat) => {
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
  const textureProperties = [
    'map', 'normalMap', 'roughnessMap', 'metalnessMap',
    'emissiveMap', 'bumpMap', 'displacementMap', 'aoMap',
    'lightMap', 'envMap', 'alphaMap'
  ];

  textureProperties.forEach((prop) => {
    if (material[prop] && material[prop].dispose) {
      material[prop].dispose();
    }
  });

  // Dispose the material itself
  material.dispose();
}

const getLevel = (stateName, namedPath) => namedPath.find((lvl) => lvl.state === stateName);
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
  const graphicReference = mapGraphicReferences.find((ref) => ref._id === mapGraphicRefId);
  if (!graphicReference) {
    console.warn(`No graphic reference found for mapGraphicRefId: ${mapGraphicRefId}`);
    return null;
  }

  return graphicReference.graphic;
}

function makeBinColorExpression(config) {
  const expr = ['case'];

  for (const bin of config.bins) {
    const conds = [];

    if (bin.min !== null && bin.min !== undefined) {
      conds.push(['>=', ['coalesce', ['number', ['get', config.property], 0], 0], bin.min]);
    }
    if (bin.max !== null && bin.max !== undefined) {
      conds.push(['<', ['coalesce', ['number', ['get', config.property], 0], 0], bin.max]);
    }

    const cond = conds.length === 1 ? conds[0] : ['all', ...conds];
    expr.push(cond, bin.color);
  }

  // fallback color
  expr.push('#e30f0f');
  return expr;
}

/**
 * Build theming groups from a numeric bin config, supporting extra paint props
 * at the top level and per-bin.
 */
function buildGroupsFromBins(map, layerId, idKey, binConfig) {
  const layer = map.getLayer(layerId);
  if (!layer) return {};

  const sourceId = layer.source;
  const src = map.getSource(sourceId);
  if (!src) return {};

  // Collect features we can access
  let features = [];
  if (src.type === 'geojson') {
    const data = src._data;
    features = Array.isArray(data?.features) ? data.features : [];
  } else if (src.type === 'vector') {
    const sourceLayer = layer['source-layer'];
    if (!sourceLayer) throw new Error(`Layer '${layerId}' is vector-backed but missing 'source-layer'`);
    features = map.querySourceFeatures(sourceId, { sourceLayer });
  } else {
    return {};
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
        base[k] = isColorProp(k) ? normalizeColorRGB(v) : v;
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

    const bin = bins.find((b) =>
      (b.min == null || val >= b.min) &&
      (b.max == null || val < b.max)
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
    coords.forEach((c) => extendBoundsFromCoords(bounds, c));
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
    map.fitBounds(bounds, { maxZoom: 8, padding: 40 });
  }
}

// ---- helpers ---------------------------------------------------------------

/**
 * Resolve true once the given sourceId exists and is loaded.
 * Listens once; cleans itself up; optional timeout.
 */
function waitForSourceLoaded(map, sourceId, { timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    if (!map || !sourceId) return resolve(false);

    const isReady = () => {
      const src = map.getSource(sourceId);
      return !!src && (typeof map.isSourceLoaded === 'function' ? map.isSourceLoaded(sourceId) : true);
    };

    if (isReady()) return resolve(true);

    let timer = null;

    const cleanup = () => {
      map.off('sourcedata', onSourceData);
      map.off('styledata', onStyleData);
      map.off('idle', onIdle);
      if (timer) clearTimeout(timer);
    };

    const tryResolve = () => {
      if (isReady()) {
        cleanup();
        resolve(true);
      }
    };

    const onSourceData = (e) => {
      if (!e || e.sourceId !== sourceId) return;
      if (Object.prototype.hasOwnProperty.call(e, 'isSourceLoaded') && !e.isSourceLoaded) return;
      tryResolve();
    };

    const onStyleData = tryResolve;
    const onIdle = tryResolve;

    map.on('sourcedata', onSourceData);
    map.on('styledata', onStyleData);
    map.on('idle', onIdle);

    if (timeout > 0) {
      timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeout);
    }
  });
}

function waitForSourcesLoaded(map, sourceIds) {
  return new Promise((resolve) => {
    const done = () => {
      const allLoaded = sourceIds.every((id) => map.isSourceLoaded(id));
      if (allLoaded) {
        map.off('sourcedata', done);
        resolve();
      }
    };

    done();
    map.on('sourcedata', done);
  });
}

// ---- main API --------------------------------------------------------------

/**
 * @param {object} params
 * @param {object} params.map - Mapbox GL JS instance
 * @param {object} params.context - XState context, must include namedPaths
 * @param {string} [params.state] - e.g. 'building' or 'site'
 * @param {string|number} [params.featureId] - id to find within that state
 * @param {number} [params.timeout] - ms to wait for source to load (default 10s)
 */
export async function zoomToFeature({ map, context, state = null, featureId = null, timeout = 10000 }) {
  if (!map || !context || !context.namedPaths) return;
  const namedPath = context.namedPaths[0];

  if (state && featureId != null) {
    const level = getLevel(state, namedPath);
    if (!level || !level.idKey) return;

    const sourceId = `${level.state}-features`;
    const ready = await waitForSourceLoaded(map, sourceId, { timeout });

    if (!ready) {
      console.warn(`[zoomToFeature] source '${sourceId}' not ready (timeout ${timeout}ms). Sending anyway.`);
    }

    const commands = [{
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
    }];

    context.mmvSend(commands);
    return;
  }

  const sourceIds = namedPath.filter((lvl) => lvl.feature).map((lvl) => `${lvl.state}-features`);
  await waitForSourcesLoaded(map, sourceIds, { timeout });
  zoomToAllFeatures(map, sourceIds);
}

function dataToFeatures(levelDef, data) {
  if (!data) {
    return null;
  }
  const features = data.map((d) => {
    let coordinates = d.coordinates;
    if (levelDef.feature === 'point' && !coordinates) {
      coordinates = [parseFloat(d.longitude), parseFloat(d.latitude)];
    }
    if (levelDef.feature === 'mesh' && !coordinates) {
      const squareCoords = generateSquareCoordinates(d.longitude, d.latitude, 1);
      coordinates = [squareCoords];
    }
    let f;
    try {
      f = featureFromKnownType(levelDef.feature, coordinates, { ...d });
      f.id = d[levelDef.idKey] || d._id;
    } catch (e) {
      console.error('featureFromKnownType', e);
    }
    return f;
  }).filter((f) => !!f);

  features.forEach((f) => {
    if (f?.properties && f.properties.size == null && f.properties.scale != null) {
      f.properties.size = f.properties.scale;
    }
  });
  return features;
}

export function fixParentFeaturesUsingChildData(levelDef, data, parent = {}) {
  const { features: parentFeatures, level: parentLevelDef } = parent;
  if (parentFeatures && parentLevelDef.state === 'site') {
    parentFeatures.forEach((siteFeature) => {
      if (data) {
        for (const building of data) {
          if (
            building[parentLevelDef.idKey] &&
            building[parentLevelDef.idKey] === siteFeature?.properties[parentLevelDef.idKey] &&
            siteFeature?.properties?.buildings &&
            !siteFeature.properties.buildings.find((b) => b[levelDef.idKey] === building[levelDef.idKey])
          ) {
            siteFeature.properties.buildings.push(building);
          }
        }
      }
    });
  }
}

// Fetch features and convert to GeoJSON for a level
export async function fetchFeaturesForLevel(levelDef, parent = {}) {
  if (!levelDef.api) return [];
  const ctx = await IafProj.getCurrent();
  let data = [];
  try {
    const res = await fetch(endPointConfig.itemServiceOrigin + '/omapi/' + ctx._namespaces[0] + '/' + levelDef.api, {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + IafSession.getAuthToken(ctx),
        'Content-Type': 'application/json'
      },
    });
    const omapiResponse = await res.json();
    data = omapiResponse._result;
  } catch (e) {
    console.error(e);
  }

  fixParentFeaturesUsingChildData(levelDef, data, parent);

  return dataToFeatures(levelDef, data) || [];
}

function getFeatureLayers(namedPath) {
  return namedPath
    .map((lvl) => ({
      state: lvl.state,
      idKey: lvl.idKey || null,
      feature: lvl.feature || null,
      layerId: `${lvl.state}-features-layer`
    }))
    .filter((l) => !!l.feature);
}

const CLICK_HANDLED = Symbol('map.click.handled');

export function isHandled(e) {
  return !!(e[CLICK_HANDLED] || (e.originalEvent && e.originalEvent[CLICK_HANDLED]));
}
export function markHandled(e) {
  e[CLICK_HANDLED] = true;
  if (e.originalEvent) e.originalEvent[CLICK_HANDLED] = true;
}

/**
 * Generic Mapbox click handler
 */
export function makeMapOnClickHandler({ map, namedPath, send, context, pixelTolerance = 0, getContext }) {
  const featureLayers = getFeatureLayers(namedPath);
  const layerIds = featureLayers.map((l) => l.layerId);

  return (e) => {
    if (isHandled(e)) return;

    const geometry = pixelTolerance > 0
      ? [
        [e.point.x - pixelTolerance, e.point.y - pixelTolerance],
        [e.point.x + pixelTolerance, e.point.y + pixelTolerance],
      ]
      : e.point;

    const hits = map.queryRenderedFeatures(geometry, { layers: layerIds });

    const byState = {};
    for (const def of featureLayers) {
      const f = hits.find((h) => h.layer && h.layer.id === def.layerId) || null;
      byState[def.state] = f;
    }

    const event = { type: 'GO_TO' };

    if (hits.length === 0) {
      featureLayers.forEach((def) => {
        if (def.idKey) event[def.idKey] = null;
      });
      send(event);
      return;
    }

    let deepestIdx = -1;
    for (let i = featureLayers.length - 1; i >= 0; i--) {
      const def = featureLayers[i];
      if (byState[def.state]) { deepestIdx = i; break; }
    }

    if (deepestIdx < 0) {
      featureLayers.forEach((def) => {
        if (def.idKey) event[def.idKey] = null;
      });
      send(event);
      return;
    }

    const deepestDef = featureLayers[deepestIdx];
    const deepestFeature = byState[deepestDef.state];
    if (deepestDef.idKey) {
      event[deepestDef.idKey] = deepestFeature?.properties?.[deepestDef.idKey] ?? null;
    }

    for (let a = deepestIdx - 1; a >= 0; a--) {
      const anc = featureLayers[a];
      if (!anc.idKey) continue;

      let value = deepestFeature?.properties?.[anc.idKey];

      if (value == null && byState[anc.state]?.properties?.[anc.idKey] != null) {
        value = byState[anc.state].properties[anc.idKey];
      }

      event[anc.idKey] = value ?? null;
    }

    for (let d = deepestIdx + 1; d < featureLayers.length; d++) {
      const desc = featureLayers[d];
      if (desc.idKey) event[desc.idKey] = null;
    }

    send(event);
  };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPos = (a) => Array.isArray(a) && isNum(a[0]) && isNum(a[1]);

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
      if (!Array.isArray(coords) || !coords.every(isPos)) {
        throw new Error('MultiPoint coords must be [[lng,lat], ...]');
      }
      return multiPoint(coords, properties);
    }
    case 'linestring': {
      if (!Array.isArray(coords) || coords.length < 2 || !coords.every(isPos)) {
        throw new Error('LineString needs at least two positions [[lng,lat], ...]');
      }
      return lineString(coords, properties);
    }
    case 'multilinestring': {
      if (!Array.isArray(coords) || !coords.every((r) => Array.isArray(r) && r.length >= 2 && r.every(isPos))) {
        throw new Error('MultiLineString must be [[[lng,lat],...], ...]');
      }
      return multiLineString(coords, properties);
    }
    case 'mesh':
    case 'polygon': {
      if (!Array.isArray(coords) || !Array.isArray(coords[0]) || !coords[0].every(isPos)) {
        console.log('featureFromKnownType mesh', { coords, properties });
        throw new Error('Polygon must be [[[lng,lat],...], ...]');
      }
      const rings = coords.map(closeRing);
      return polygon(rings, properties);
    }
    case 'multipolygon': {
      if (!Array.isArray(coords) || !Array.isArray(coords[0]) || !Array.isArray(coords[0][0]) || !coords[0][0].every(isPos)) {
        throw new Error('MultiPolygon must be [[[[lng,lat],...]], ...]');
      }
      const polys = coords.map((poly) => poly.map(closeRing));
      return multiPolygon(polys, properties);
    }
    default:
      throw new Error(`Unsupported geometry type: ${type}`);
  }
}

/**
 * Load and cache all unique graphics (3D models)
 */
export async function loadGraphics(graphicIds) {
  const geometryLoadPromises = new Map();
  const loader = new GLTFLoader();

  const loadGeometry = async (graphicId) => {
    if (geometryLoadPromises.has(graphicId)) {
      return geometryLoadPromises.get(graphicId);
    }

    const promise = (async () => {
      try {
        const modelUrl = await getCachedFile(graphicId);
        if (!modelUrl) {
          console.warn(`No URL found for graphic ID: ${graphicId}`);
          return null;
        }

        console.log(`Loading graphic model: ${graphicId} from ${modelUrl}`);

        return new Promise((resolve, reject) => {
          loader.load(modelUrl, (gltf) => {
            console.log(`Graphic loaded successfully: ${graphicId}`);

            let totalVertices = 0;
            let meshCount = 0;
            const boundingBox = new THREE.Box3();

            gltf.scene.traverse((node) => {
              if (node.isMesh) {
                meshCount++;
                totalVertices += node.geometry.attributes.position.count;
                boundingBox.expandByObject(node);
              }
            });

            const boxSize = new THREE.Vector3();
            boundingBox.getSize(boxSize);

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

  try {
    const results = await Promise.all(graphicIds.map((id) => loadGeometry(id)));
    console.log(`Successfully loaded ${results.filter((r) => r !== null).length} graphics`);
    return globalLoadedGeometries;
  } catch (error) {
    console.error('Error loading graphics:', error);
    return globalLoadedGeometries;
  }
}

/**
 * Create an optimized instance of a THREE.js scene
 */
export function createOptimizedInstance(scene, cloneMaterials = false) {
  const instancedScene = scene.clone();

  if (cloneMaterials) {
    instancedScene.traverse((node) => {
      if (node.isMesh && node.material) {
        if (Array.isArray(node.material)) {
          node.material = node.material.map((mat) => mat.clone());
        } else {
          node.material = node.material.clone();
        }
      }
    });
  }

  return instancedScene;
}

export function createThemedInstance(scene, materialOverrides = {}) {
  const themedScene = createOptimizedInstance(scene, true);

  if (Object.keys(materialOverrides).length > 0) {
    themedScene.traverse((node) => {
      if (node.isMesh && node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          Object.keys(materialOverrides).forEach((prop) => {
            if (prop === 'color' && materialOverrides[prop]) {
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

export function applyColorToModel(modelScene, color, opacity = null) {
  if (!modelScene) return;

  modelScene.traverse((node) => {
    if (node.isMesh && node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
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

export function deepCloneScene(scene) {
  console.warn('deepCloneScene is deprecated and memory-inefficient. Use createOptimizedInstance() instead.');
  return createOptimizedInstance(scene, true);
}

// --- helpers (put them near other small helpers) ---

function computeCentroidFromProps(props) {
  const lon = props?.longitude, lat = props?.latitude;
  if (lon == null || lat == null) return null;
  return [parseFloat(lon), parseFloat(lat)];
}

// builds the transform shape render() expects
function buildModelTransform(centroid, props) {
  const rotationDeg = props?.rotation ?? 0;
  const sizeProp = (props?.size ?? props?.scale ?? 1);
  const elevation = props?.elevation ?? 0;
  const height = props?.height ?? 0;

  const mc = mapboxgl.MercatorCoordinate.fromLngLat(centroid, elevation);

  const meter = mc.meterInMercatorCoordinateUnits();
  const extraZ = height * meter;

  return {
    translateX: mc.x,
    translateY: mc.y,
    translateZ: mc.z + extraZ,
    rotateX: Math.PI / 2,
    rotateY: (rotationDeg || 0) * -(Math.PI / 180),
    rotateZ: 0,
    scale: meter * (sizeProp || 1),
  };
}

function placementSignature(centroid, props) {
  const c = Array.isArray(centroid) ? centroid : [null, null];
  return [
    c[0], c[1],
    props?.elevation ?? 0,
    props?.height ?? 0,
    props?.rotation ?? 0,
    (props?.size ?? props?.scale ?? 1)
  ].join('|');
}

// returns a rotated ground-footprint polygon for a model
function buildCubeWrapperFeature({
  level,
  id,
  centroid,
  geometryInfo,
  featureProperties,
  transform = {},
  yawSign = -1,
  axes = { widthAxis: 'x', depthAxis: 'z' }
}) {
  if (!centroid || centroid.length !== 2) return null;
  const [lng, lat] = centroid;

  const mPerDegLat = 110540;
  const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);
  const toLngLat = (dx, dy) => [lng + dx / mPerDegLon, lat + dy / mPerDegLat];

  const sizeM = geometryInfo?.sizeInMeters;
  let widthM, depthM, heightM;

  if (sizeM && (sizeM.width != null || sizeM.depth != null)) {
    widthM = sizeM.width ?? 20;
    depthM = sizeM.depth ?? 20;
    heightM = sizeM.height ?? 50;
  } else {
    const sizeU = geometryInfo?.size || {};
    const metersPerUnit =
      transform.metersPerUnit ??
      geometryInfo?.metersPerUnit ??
      (geometryInfo?.unitsPerMeter ? 1 / geometryInfo.unitsPerMeter : 1);

    const wAxis = axes.widthAxis || 'x';
    const dAxis = axes.depthAxis || 'z';

    widthM = (sizeU[wAxis] ?? 20) * metersPerUnit;
    depthM = (sizeU[dAxis] ?? 20) * metersPerUnit;
    heightM = (sizeU.y ?? 50) * metersPerUnit;
  }

  const sxFeat = featureProperties.scaleX ?? featureProperties.size ?? featureProperties.scale ?? 1;
  const szFeat = featureProperties.scaleZ ?? featureProperties.size ?? featureProperties.scale ?? 1;
  const sxMesh = transform.scaleX ?? 1;
  const szMesh = transform.scaleZ ?? 1;
  const sxNorm = transform.extraScaleX ?? geometryInfo?.extraScaleX ?? 1;
  const szNorm = transform.extraScaleZ ?? geometryInfo?.extraScaleZ ?? 1;

  const scaleX_used = sxFeat * sxMesh * sxNorm;
  const scaleZ_used = szFeat * szMesh * szNorm;

  widthM *= scaleX_used;
  depthM *= scaleZ_used;
  heightM *= (featureProperties.scaleY ?? featureProperties.size ?? featureProperties.scale ?? 1);

  const halfW = widthM / 2;
  const halfD = depthM / 2;

  const rect = [
    [-halfW, -halfD], [halfW, -halfD],
    [halfW, halfD], [-halfW, halfD],
    [-halfW, -halfD],
  ];

  const yawDeg =
    transform.yawDeg ??
    featureProperties.rotation ??
    featureProperties.yaw ??
    featureProperties.heading ??
    0;

  const theta = (yawDeg * yawSign) * Math.PI / 180;
  const cos = Math.cos(theta), sin = Math.sin(theta);

  const ring = rect.map(([x, y]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return toLngLat(rx, ry);
  });

  return {
    type: 'Feature',
    id,
    properties: {
      [level.idKey]: id,
      longitude: lng,
      latitude: lat,
      type: '3d_model',
      height: heightM,
      elevation: featureProperties?.elevation ?? 0,
      rotation: yawDeg,
      scale: featureProperties?.scale ?? 1,
      size: featureProperties?.size ?? 1,
      cube_wrapper: true,
      ...featureProperties,
      scaleY: featureProperties?.scaleY ?? featureProperties.size ?? featureProperties?.scale ?? 1,
      scaleX: scaleX_used, width: widthM,
      scaleZ: scaleZ_used, depth: depthM,
    },
    geometry: { type: 'Polygon', coordinates: [ring] }
  };
}

function setCubeWrapperDebug(map, sourceId, on = true) {
  const wrapperLayerId = `${sourceId}-layer`;
  if (!map.getLayer(wrapperLayerId)) return;

  map.setPaintProperty(wrapperLayerId, 'fill-extrusion-opacity', on ? 0.6 : 0.0);
  map.setPaintProperty(wrapperLayerId, 'fill-extrusion-color', on ? '#ff4d4f' : '#000000');
  map.setPaintProperty(wrapperLayerId, 'fill-extrusion-height', ['*', ['coalesce', ['get', 'height'], 10], 1]);
}

/**
 * Helper function to get and control 3D graphics layer
 */
export function get3DGraphicsController(map, sourceId) {
  const customLayerId = `${sourceId}-3d-graphics`;
  const layer = map.getLayer(customLayerId);

  if (!layer || layer.type !== 'custom') {
    console.warn(`3D graphics layer not found: ${customLayerId}`);
    return null;
  }

  let interactionState = {
    mode: null,
    activeFeatureId: null,
    activeFeature: null,
    isDragging: false,
    startPosition: null,
    startRotation: 0,
    startScale: 1,
    activeHandle: null,
    onTransformCallback: null,
    dataSource: null,
    mouseMoveHandler: null,
    mouseDownHandler: null,
    mouseUpHandler: null
  };

  const enableTransform = (featureId, callback = null) => {
    if (interactionState.mode) {
      console.warn('Another interaction mode is active. Disable it first.');
      return false;
    }

    const feature = layer.features.find((f) => f.properties[layer.metadata.featureInfo.idProperty] === featureId);
    if (!feature) {
      console.error(`Feature not found: ${featureId}`);
      return false;
    }

    interactionState.mode = 'transform';
    interactionState.activeFeatureId = featureId;
    interactionState.activeFeature = feature;
    interactionState.onTransformCallback = callback;
    interactionState.dataSource = map.getSource(sourceId);
    window.dataSource = interactionState.dataSource;

    if (layer.startEditingFeature) {
      layer.startEditingFeature(featureId);
    }

    attachUnifiedTransformHandlers();

    console.log(`Transform mode enabled for feature: ${featureId} (move, rotate, scale available)`);
    map.triggerRepaint();
    return true;
  };

  const enableMove = (featureId, callback = null) => {
    console.warn('enableMove is deprecated. Use enableTransform instead for unified move/rotate/scale.');
    return enableTransform(featureId, callback);
  };

  const enableRotate = (featureId, callback = null) => {
    console.warn('enableRotate is deprecated. Use enableTransform instead for unified move/rotate/scale.');
    return enableTransform(featureId, callback);
  };

  const enableScale = (featureId, callback = null) => {
    console.warn('enableScale is deprecated. Use enableTransform instead for unified move/rotate/scale.');
    return enableTransform(featureId, callback);
  };

  const disableInteraction = (callbacks = null) => {
    if (!interactionState.mode) {
      return true;
    }

    const activeFeature = interactionState.activeFeature;
    const previousMode = interactionState.mode;

    if (interactionState.mouseMoveHandler) {
      map.off('mousemove', interactionState.mouseMoveHandler);
    }
    if (interactionState.mouseDownHandler) {
      map.off('mousedown', interactionState.mouseDownHandler);
    }
    if (interactionState.mouseUpHandler) {
      map.off('mouseup', interactionState.mouseUpHandler);
    }

    if (layer.clearEditingState) {
      layer.clearEditingState();
    }

    map.getCanvas().style.cursor = '';
    map.dragPan.enable();

    if (activeFeature) {
      const defaultCallback = (feature) => {
        layer.updateCubeWrapperForFeature(feature, sourceId);
      };

      const allCallbacks = [defaultCallback, ...(callbacks || [])];

      allCallbacks.forEach((callback) => {
        try {
          callback(activeFeature);
        } catch (error) {
          console.error('Error executing callback:', error);
        }
      });
    }

    interactionState = {
      mode: null,
      activeFeatureId: null,
      activeFeature: null,
      isDragging: false,
      startPosition: null,
      startRotation: 0,
      startScale: 1,
      activeHandle: null,
      onTransformCallback: null,
      mouseMoveHandler: null,
      mouseDownHandler: null,
      mouseUpHandler: null
    };

    console.log(`${previousMode} mode disabled`);
    map.triggerRepaint();
    return true;
  };

  const attachUnifiedTransformHandlers = () => {
    interactionState.mouseMoveHandler = (e) => {
      const featureFromSource = interactionState.dataSource._data.features.find((el) => el.id === interactionState.activeFeatureId);
      window.featureFromSource = featureFromSource;

      const callbackValue = {
        centroid: [featureFromSource.properties.longitude, featureFromSource.properties.latitude],
        rotation: featureFromSource.properties.rotation,
        scale: featureFromSource.properties.scale
      };

      const point = { x: e.point.x, y: e.point.y };

      if (!interactionState.isDragging && layer.detectHandle) {
        const handleInfo = layer.detectHandle(point, e);
        if (layer.updateCursor) {
          layer.updateCursor(handleInfo);
        }
        return;
      }

      if (interactionState.isDragging) {
        const feature = interactionState.activeFeature;
        window.feature = feature;

        if (interactionState.activeHandle === 'move') {
          const position = [e.lngLat.lng, e.lngLat.lat];
          callbackValue.centroid = position;
          feature.centroid = position;

          const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(position, 0);
          feature.transform.translateX = modelAsMercatorCoordinate.x;
          feature.transform.translateY = modelAsMercatorCoordinate.y;
          feature.transform.translateZ = modelAsMercatorCoordinate.z;
        } else if (interactionState.activeHandle === 'rotate') {
          const center = feature.centroid;
          const centerPixel = map.project(center);

          const angle = Math.atan2(e.point.y - centerPixel.y, e.point.x - centerPixel.x);
          const startAngle = Math.atan2(
            interactionState.startPosition.y - centerPixel.y,
            interactionState.startPosition.x - centerPixel.x
          );
          const deltaAngle = (angle - startAngle) * (180 / Math.PI);
          const newRotation = (interactionState.startRotation + deltaAngle) % 360;
          callbackValue.rotation = newRotation;

          feature.transform.rotateY = newRotation * -(Math.PI / 180);
          feature.properties.rotation = newRotation;
        } else if (interactionState.activeHandle === 'scale') {
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
          callbackValue.scale = newScale;

          const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(center, 0);
          feature.transform.scale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits() * newScale;
          feature.properties.size = newScale;
        }

        if (interactionState.onTransformCallback) {
          try {
            const outcomeGeneralPosition = {
              position: feature.centroid,
              rotation: feature.properties.rotation,
              size: feature.properties.size
            };

            interactionState.onTransformCallback(outcomeGeneralPosition);
          } catch (error) {
            console.error('Error executing transform callback:', error);
          }
        }

        map.triggerRepaint();
      }
    };

    interactionState.mouseDownHandler = (e) => {
      const point = { x: e.point.x, y: e.point.y };

      if (layer.detectHandle) {
        const handleInfo = layer.detectHandle(point, e);

        if (handleInfo) {
          if (handleInfo.type === 'moveHandle') {
            interactionState.activeHandle = 'move';
            interactionState.isDragging = true;
            interactionState.startPosition = point;
            map.getCanvas().style.cursor = 'grabbing';
            map.dragPan.disable();
            e.preventDefault();
          } else if (handleInfo.type === 'boundingBox') {
            interactionState.activeHandle = 'rotate';
            interactionState.isDragging = true;
            interactionState.startPosition = point;

            const currentRotateY = interactionState.activeFeature.transform.rotateY || 0;
            interactionState.startRotation = currentRotateY * -(180 / Math.PI);

            map.getCanvas().style.cursor = 'grabbing';
            map.dragPan.disable();
            e.preventDefault();
          } else if (handleInfo.type === 'scaleHandle') {
            interactionState.activeHandle = 'scale';
            interactionState.isDragging = true;
            interactionState.startPosition = point;

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
      }
    };

    interactionState.mouseUpHandler = (e) => {
      if (interactionState.isDragging) {
        interactionState.isDragging = false;
        interactionState.activeHandle = null;
        map.dragPan.enable();

        const point = { x: e.point.x, y: e.point.y };
        if (layer.detectHandle) {
          const handleInfo = layer.detectHandle(point, e);
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

  // --- legacy handlers block you pasted (move/rotate/scale) remains unchanged ---
  // (kept exactly as you sent; not used when enableTransform is used)
  const attachMoveHandlers = () => {
    interactionState.mouseMoveHandler = (e) => {
      const point = { x: e.point.x, y: e.point.y };

      if (!interactionState.isDragging && layer.detectHandle) {
        const handleInfo = layer.detectHandle(point, e);
        if (layer.updateCursor) {
          layer.updateCursor(handleInfo);
        }
        return;
      }

      if (interactionState.isDragging && interactionState.activeHandle === 'move') {
        const position = [e.lngLat.lng, e.lngLat.lat];

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
        const handleInfo = layer.detectHandle(point, e);

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
          const handleInfo = layer.detectHandle(point, e);
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

  const attachRotateHandlers = () => {
    interactionState.mouseMoveHandler = (e) => {
      const point = { x: e.point.x, y: e.point.y };

      if (!interactionState.isDragging && layer.detectHandle) {
        const handleInfo = layer.detectHandle(point, e);
        if (layer.updateCursor) {
          layer.updateCursor(handleInfo);
        }
        return;
      }

      if (interactionState.isDragging && interactionState.activeHandle === 'rotate') {
        const feature = interactionState.activeFeature;
        const center = feature.centroid;
        const centerPixel = map.project(center);

        const angle = Math.atan2(e.point.y - centerPixel.y, e.point.x - centerPixel.x);
        const startAngle = Math.atan2(
          interactionState.startPosition.y - centerPixel.y,
          interactionState.startPosition.x - centerPixel.x
        );
        const deltaAngle = (angle - startAngle) * (180 / Math.PI);
        const newRotation = (interactionState.startRotation + deltaAngle) % 360;

        feature.transform.rotateY = newRotation * -(Math.PI / 180);
        feature.properties.rotation = newRotation;

        map.triggerRepaint();
      }
    };

    interactionState.mouseDownHandler = (e) => {
      const point = { x: e.point.x, y: e.point.y };

      if (layer.detectHandle) {
        const handleInfo = layer.detectHandle(point, e);

        if (handleInfo && handleInfo.type === 'boundingBox') {
          interactionState.activeHandle = 'rotate';
          interactionState.isDragging = true;
          interactionState.startPosition = point;

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
          const handleInfo = layer.detectHandle(point, e);
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

  const attachScaleHandlers = () => {
    interactionState.mouseMoveHandler = (e) => {
      const point = { x: e.point.x, y: e.point.y };

      if (!interactionState.isDragging && layer.detectHandle) {
        const handleInfo = layer.detectHandle(point, e);
        if (layer.updateCursor) {
          layer.updateCursor(handleInfo);
        }
        return;
      }

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

        const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(center, 0);
        feature.transform.scale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits() * newScale;

        feature.properties.size = newScale;

        map.triggerRepaint();
      }
    };

    interactionState.mouseDownHandler = (e) => {
      const point = { x: e.point.x, y: e.point.y };

      if (layer.detectHandle) {
        const handleInfo = layer.detectHandle(point, e);

        if (handleInfo && handleInfo.type === 'scaleHandle') {
          interactionState.activeHandle = 'scale';
          interactionState.isDragging = true;
          interactionState.startPosition = point;

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
          const handleInfo = layer.detectHandle(point, e);
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
    show: () => layer.show3DGraphics && layer.show3DGraphics(),
    hide: () => layer.hide3DGraphics && layer.hide3DGraphics(),
    toggle: () => layer.toggle3DGraphics && layer.toggle3DGraphics(),
    isVisible: () => layer.is3DGraphicsVisible && layer.is3DGraphicsVisible(),

    showFeatures: (featureIds) => layer.showFeatures && layer.showFeatures(featureIds),
    hideFeatures: (featureIds) => layer.hideFeatures && layer.hideFeatures(featureIds),
    toggleFeatures: (featureIds, forceVisible = null) => layer.toggleFeatures && layer.toggleFeatures(featureIds, forceVisible),
    getFeatureVisibility: (featureIds) => layer.getFeatureVisibility && layer.getFeatureVisibility(featureIds),
    getAllFeatureVisibility: () => layer.getAllFeatureVisibility && layer.getAllFeatureVisibility(),

    enableTransform,
    disableInteraction,

    updateTransform: (featureId, transform, updateWrapper = true) => {
      return layer.update3DGraphicTransform(sourceId, featureId, transform, updateWrapper);
    },

    getFeatureTransform: (featureId) => {
      const keyProperty = layer.metadata?.featureInfo?.idProperty || 'buildingId';
      const feature = layer.features.find((f) => f.properties[keyProperty] === featureId);

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

    getInteractionState: () => ({
      mode: interactionState.mode,
      activeFeatureId: interactionState.activeFeatureId,
      isDragging: interactionState.isDragging
    }),

    layer
  };
}

/**
 * Create a 3D custom layer for graphics rendering
 */
function createGraphicsCustomLayer(layerId, features, loadedGraphics, level, getContext) {
  console.log('createGraphicsCustomLayer', { layerId, features, loadedGraphics, level, getContext });
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
    _3dGraphicsVisible: false,

    queryFeatures: function(point) {
      if (!this.features.length) return [];
      const tolerance = 100;
      return this.features.filter((f) => {
        const p = this.map.project({ lng: f.centroid[0], lat: f.centroid[1] });
        const dx = point.x - p.x;
        const dy = point.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) <= tolerance;
      }).map((f) => ({
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

    showFeatures: function(featureIds) {
      if (!Array.isArray(featureIds)) {
        featureIds = [featureIds];
      }

      let updated = false;
      const keyProperty = this.metadata.featureInfo.idProperty;

      featureIds.forEach((id) => {
        const feature = this.features.find((f) => f.properties[keyProperty] === id);
        if (feature && !feature._featureVisible) {
          feature._featureVisible = true;
          updated = true;
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

      featureIds.forEach((id) => {
        const feature = this.features.find((f) => f.properties[keyProperty] === id);
        if (feature && feature._featureVisible) {
          feature._featureVisible = false;
          updated = true;
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

      featureIds.forEach((id) => {
        const feature = this.features.find((f) => f.properties[keyProperty] === id);
        if (feature) {
          const newVisibility = forceVisible !== null ? forceVisible : !feature._featureVisible;
          if (feature._featureVisible !== newVisibility) {
            feature._featureVisible = newVisibility;
            updated = true;
          }
        }
      });

      if (updated && this.map) {
        this.map.triggerRepaint();
      }
      return updated;
    },

    getFeatureVisibility: function(featureIds) {
      if (!Array.isArray(featureIds)) {
        featureIds = [featureIds];
      }

      const keyProperty = this.metadata.featureInfo.idProperty;
      const result = {};

      featureIds.forEach((id) => {
        const feature = this.features.find((f) => f.properties[keyProperty] === id);
        result[id] = feature ? feature._featureVisible : null;
      });

      return featureIds.length === 1 ? result[featureIds[0]] : result;
    },

    getAllFeatureVisibility: function() {
      const keyProperty = this.metadata.featureInfo.idProperty;
      const result = {};

      this.features.forEach((feature) => {
        const id = feature.properties[keyProperty];
        result[id] = feature._featureVisible;
      });

      return result;
    },

    // Start editing an existing feature with visual handles
    startEditingFeature: function(featureId) {
      console.log('Starting edit for feature:', featureId);

      this.clearEditingState();

      const feature = this.features.find((f) => f.properties[this.metadata.featureInfo.idProperty] === featureId);
      if (!feature) {
        console.error('Feature not found for editing:', featureId);
        return false;
      }

      this.editingFeatureId = featureId;

      this.setFeatureOpacity(feature, 0.7);

      const handleGroup = this.createHandleGroup(feature);
      if (handleGroup) {
        feature.handles = handleGroup;
        feature.model.add(handleGroup);
      }

      return true;
    },

    clearEditingState: function() {
      this.features.forEach((feature) => {
        if (feature.handles) {
          feature.model.remove(feature.handles);
          this.disposeHandleGroup(feature.handles);
          feature.handles = null;
        }
        this.setFeatureOpacity(feature, 1.0);
      });
      this.editingFeatureId = null;
    },

    setFeatureOpacity: function(feature, opacity) {
      const targetModel = feature.modelMesh || feature.model;
      targetModel.traverse((node) => {
        if (node.isMesh && node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((mat) => {
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

    disposeHandleGroup: function(handleGroup) {
      if (!handleGroup) return;
      handleGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    },

    createHandleGroup: function(feature) {
      const geometryInfo = globalLoadedGeometries.get(feature.graphicId);
      if (!geometryInfo) {
        console.error('Geometry info not available for feature handles:', feature.graphicId);
        return null;
      }

      const handleGroup = new THREE.Group();
      handleGroup.name = 'editingHandles';

      const bbox = geometryInfo.boundingBox;
      console.log('Bounding box:', bbox);

      const pixelToMeterRatio = 0.5;

      const rings = [
        { radius: 140 * pixelToMeterRatio, color: 0x0088ff, type: 'moveHandle', opacity: 0.7 },
        { radius: 200 * pixelToMeterRatio, color: 0xff0000, type: 'rotationHandle', opacity: 0.7 },
        { radius: 260 * pixelToMeterRatio, color: 0xffaa00, type: 'scaleHandle', opacity: 0.7 }
      ];

      const ringTubeThickness = 1.5;
      const yPosition = 0;

      rings.forEach((ringConfig) => {
        const ringGeometry = new THREE.TorusGeometry(
          ringConfig.radius,
          ringTubeThickness,
          16,
          64
        );

        const ringMaterial = new THREE.MeshBasicMaterial({
          color: ringConfig.color,
          transparent: true,
          opacity: ringConfig.opacity,
          side: THREE.DoubleSide
        });

        const ring = new THREE.Mesh(ringGeometry, ringMaterial);

        ring.position.set(0, yPosition, 0);
        ring.rotation.x = Math.PI / 2;

        ring.userData = {
          type: ringConfig.type,
          isEditingHandle: true
        };

        handleGroup.add(ring);
      });

      return handleGroup;
    },

    detectHandle: function(point, e) {
      if (this.editingFeatureId) {
        const editingFeature = this.features.find((f) => f.properties[this.metadata.featureInfo.idProperty] === this.editingFeatureId);
        if (editingFeature && editingFeature.handles) {
          return this.detectHandleAtPosition(point, editingFeature, e);
        }
      }
      return null;
    },

    detectHandleAtPosition: function(point, feature, e) {
      if (!e || !e.lngLat) {
        console.warn('No lngLat available in event');
        return null;
      }

      const size = feature?.properties?.size || 1;
      const clickLngLat = e.lngLat;
      const featureCentroid = feature.centroid;

      const pixelToMeterRatio = 0.5;
      const ringRadiiInMeters = {
        move: 140 * pixelToMeterRatio * size,
        rotation: 200 * pixelToMeterRatio * size,
        scale: 260 * pixelToMeterRatio * size
      };

      const distanceInMeters = this.calculateGeographicDistance(
        clickLngLat.lng,
        clickLngLat.lat,
        featureCentroid[0],
        featureCentroid[1]
      );

      if (distanceInMeters <= ringRadiiInMeters.move) {
        return { type: 'moveHandle', index: 0, object: null, point, feature };
      } else if (distanceInMeters <= ringRadiiInMeters.rotation) {
        return { type: 'boundingBox', index: 0, object: null, point, feature };
      } else if (distanceInMeters <= ringRadiiInMeters.scale) {
        return { type: 'scaleHandle', index: 0, object: null, point, feature };
      }

      return null;
    },

    calculateGeographicDistance: function(lng1, lat1, lng2, lat2) {
      const R = 6371000;
      const normalisedLat1 = lat1 * Math.PI / 180;
      const normalisedLat2 = lat2 * Math.PI / 180;
      const deltaLat = (lat2 - lat1) * Math.PI / 180;
      const deltaLng = (lng2 - lng1) * Math.PI / 180;

      const distance = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(normalisedLat1) * Math.cos(normalisedLat2) *
        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const correction = 2 * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance));

      return R * correction;
    },

    updateCursor: function(handleInfo) {
      const canvas = this.map.getCanvas();
      if (!handleInfo) {
        canvas.style.cursor = 'default';
        return;
      }

      switch (handleInfo.type) {
        case 'moveHandle':
          canvas.style.cursor = 'move';
          break;
        case 'scaleHandle':
          canvas.style.cursor = 'nw-resize';
          break;
        case 'boundingBox':
          canvas.style.cursor = 'grab';
          break;
        default:
          canvas.style.cursor = 'pointer';
      }
    },

    createModelInstance: function(scene, cloneMaterials = false, materialOverrides = null) {
      if (materialOverrides) {
        return createThemedInstance(scene, materialOverrides);
      }
      return createOptimizedInstance(scene, cloneMaterials);
    },

    applyFeatureTheming: function(modelScene, properties) {
      if (!properties) return;

      const colorProps = ['color', 'Color', 'fill-color', 'fillColor', 'material_color'];
      const opacityProps = ['opacity', 'Opacity', 'alpha', 'transparency'];

      let color = null;
      let opacity = null;

      for (const prop of colorProps) {
        if (properties[prop]) {
          color = properties[prop];
          break;
        }
      }

      for (const prop of opacityProps) {
        if (properties[prop] !== undefined) {
          opacity = parseFloat(properties[prop]);
          break;
        }
      }

      if (color || opacity !== null) {
        applyColorToModel(modelScene, color, opacity);
      }
    },

    onAdd: function(map, gl) {
      console.log('Initializing 3D graphics layer');

      window.dispatchEvent(new CustomEvent('mmv:3d-layer-loading', {
        detail: { stateValue: 'portfolio', layerId: this.id }
        }));
        

      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();

      const directionalLight = new THREE.DirectionalLight(0xffffff);
      directionalLight.position.set(0, -70, 100).normalize();
      this.scene.add(directionalLight);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff);
      directionalLight2.position.set(0, 70, 100).normalize();
      this.scene.add(directionalLight2);

      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      this.renderer.autoClear = false;
      this.map = map;

      this.updateFeatures(features, loadedGraphics, getContext);

      console.log('3D graphics layer initialized');

      const ctxData = getContext ? getContext() : null;
        const machineCtx = ctxData?.__ctxRef || ctxData?.context || ctxData;
        machineCtx?.reduxDispatch?.(setGraphicsGateReady({ stateValue: 'portfolio' }));

      try {
        const ctxData = getContext ? getContext() : null;
        const machineCtx = ctxData?.__ctxRef || ctxData?.context || ctxData;
        signal3DInitialized(machineCtx, 'portfolio');

        const token = machineCtx?._graphicsGateToken?.portfolio;

        window.dispatchEvent(new CustomEvent('mmv:3d-layer-initialized', {
        detail: { stateValue: 'portfolio', layerId: this.id, token }
        }));
      } catch (e) {
        // ignore
      }
    },

    updateFeatures: function(newFeatures, graphics, contextGetter) {
      if (!this.scene) return;

      const keyProperty = this.metadata.featureInfo.idProperty || 'id';

      const contextData = contextGetter ? contextGetter() : {};
      const { reduxState } = contextData;
      const structures = reduxState?.pageComponentState?.structures || {};

      const incomingById = new Map();
      for (const raw of newFeatures || []) {
        const id = raw?.properties?.[keyProperty];
        if (id == null) continue;

        const centroidVal = computeCentroidFromProps(raw.properties);
        if (!centroidVal) {
          console.warn(`Feature ${id} missing longitude/latitude`, raw.properties);
          continue;
        }

        let graphicId = raw.properties?.graphicId;
        const structureName = raw.properties?.structureName;
        if (!graphicId && structureName) {
          graphicId = getGraphicIdFromStructureName(structureName, reduxState);
        }
        if (!graphicId) {
          console.warn(`No graphic for feature ${id} (structureName=${structureName})`);
          continue;
        }

        const geometryInfo = graphics.get(graphicId);
        if (!geometryInfo) {
          console.warn(`No cached geometry for graphic ${graphicId} (feature ${id})`);
          continue;
        }

        const key = placementSignature(centroidVal, raw.properties);

        incomingById.set(id, {
          raw,
          id,
          centroid: centroidVal,
          graphicId,
          structureName,
          geometryInfo,
          placementKey: key
        });
      }

      const currentById = new Map(
        (this.features || []).map((f) => [f.properties?.[keyProperty], f])
      );

      for (const [currId, currFeat] of currentById) {
        if (!incomingById.has(currId)) {
          if (currFeat.model) {
            disposeObject3D(currFeat.model);
            this.scene.remove(currFeat.model);
          }
          currentById.delete(currId);
        }
      }

      for (const [id, incoming] of incomingById) {
        const existing = currentById.get(id);

        if (!existing) {
          const ok = this.addModelInstance(incoming.graphicId, incoming.centroid, id, incoming.geometryInfo, incoming.raw.properties);
          if (ok) {
            const added = this.features[this.features.length - 1];
            if (added) {
              added.properties = {
                ...added.properties,
                ...incoming.raw.properties,
                centroid: incoming.centroid,
                structureName: incoming.structureName,
                graphicId: incoming.graphicId
              };
              added._placementKey = incoming.placementKey;
            }
          }
          continue;
        }

        const modelChanged =
          (existing.properties?.graphicId !== incoming.graphicId) ||
          (existing.properties?.structureName !== incoming.structureName);

        if (modelChanged) {
          if (existing.model) {
            disposeObject3D(existing.model);
            this.scene.remove(existing.model);
          }
          const ok = this.addModelInstance(incoming.graphicId, incoming.centroid, id, incoming.geometryInfo, incoming.raw.properties);
          if (ok) {
            const updated = this.features[this.features.length - 1];
            if (updated) {
              const wasVisible = existing._featureVisible !== undefined ? existing._featureVisible : true;
              updated._featureVisible = wasVisible;
              updated.model.visible = wasVisible;
              updated.properties = {
                ...updated.properties,
                ...incoming.raw.properties,
                centroid: incoming.centroid,
                structureName: incoming.structureName,
                graphicId: incoming.graphicId
              };
              updated._placementKey = incoming.placementKey;
            }
          }
          continue;
        }

        const prevSig = existing._placementKey || placementSignature(existing.centroid, existing.properties);
        if (prevSig !== incoming.placementKey) {
          const transform = buildModelTransform(incoming.centroid, incoming.raw.properties);
          existing.transform = transform;
          existing.centroid = incoming.centroid;
          existing.properties = { ...existing.properties, ...incoming.raw.properties, centroid: incoming.centroid };
          existing._placementKey = incoming.placementKey;
        } else {
          existing.properties = { ...existing.properties, ...incoming.raw.properties };
        }
      }

      const nextFeatures = [];
      for (const [id] of incomingById) {
        const f = this.features.find((x) => x.properties?.[keyProperty] === id);
        if (f) nextFeatures.push(f);
      }
      this.features = nextFeatures;

      this.map && this.map.triggerRepaint();
    },

    addModelInstance: function(graphicId, centroidVal, instanceId, geometryInfo, featureProperties) {
      console.log(`Adding new model instance: ${instanceId} at [${centroidVal}]`);

      if (!geometryInfo) {
        console.error('No geometry info available for graphic:', graphicId);
        return false;
      }

      const { meshCount, totalVertices, bbox } = geometryInfo;

      const featureScene = this.createModelInstance(geometryInfo.scene, true);

      if (featureProperties) {
        this.applyFeatureTheming(featureScene, featureProperties);
      }

      const modelTransform = buildModelTransform(centroidVal, featureProperties);
      const { size, rotation } = featureProperties || {};
      const keyProperty = this.metadata.featureInfo.idProperty;

      const updatedFeature = {
        model: featureScene,
        centroid: centroidVal,
        layer: this,
        transform: modelTransform,
        graphicId,
        _featureVisible: true,
        properties: {
          [keyProperty]: instanceId,
          name: 'Placed 3D Model',
          type: '3d_model',
          graphic: graphicId,
          size,
          rotation,
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

      this.features.push(updatedFeature);
      this.scene.add(featureScene);

      console.log('New model instance added successfully:', instanceId);
      return true;
    },

    render: function(gl, matrix) {
      if (!this._3dGraphicsVisible || !this.renderer || !this.features.length) return;

      this.renderer.resetState();

      const originalVisibility = new Map();
      this.features.forEach((f) => {
        originalVisibility.set(f, f.model.visible);
      });

      this.features.forEach((feature) => {
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

        feature.model.visible = true;
        this.features.forEach((f) => {
          if (f !== feature) f.model.visible = false;
        });

        this.renderer.render(this.scene, this.camera);
      });

      this.features.forEach((f) => {
        f.model.visible = originalVisibility.get(f);
      });
    },

    onRemove: function() {
      console.log('Cleaning up 3D graphics layer resources');

      if (this.features) {
        this.features.forEach((feature) => {
          if (feature.model) {
            disposeObject3D(feature.model);
          }
        });
        this.features = [];
      }

      if (this.scene) {
        this.scene.clear();
        this.scene = null;
      }

      if (this.renderer) {
        this.renderer.dispose();
        this.renderer = null;
      }

      console.log('3D graphics layer cleanup complete');
    },

    // update3DGraphicTransform + updateCubeWrapperForFeature left as-is (from your paste)
    update3DGraphicTransform(sourceId, featureId, transform = {}, updateWrapper = true) {
      console.log('Mutating 3D graphic feature transform (not map source):', { featureId, transform });
      const map = this.map;
      const layer = this;

      const keyProperty = layer.metadata?.featureInfo?.idProperty || 'buildingId';
      const feature = layer.features.find((f) => f.properties[keyProperty] === featureId);

      if (!feature) {
        console.warn(`Feature not found: ${featureId}`);
        return false;
      }

      let updated = false;

      if (transform.centroid && Array.isArray(transform.centroid) && transform.centroid.length === 2) {
        const [lng, lat] = transform.centroid;
        feature.centroid = [lng, lat];

        const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
        feature.transform.translateX = modelAsMercatorCoordinate.x;
        feature.transform.translateY = modelAsMercatorCoordinate.y;
        feature.transform.translateZ = modelAsMercatorCoordinate.z;

        feature.properties.longitude = lng;
        feature.properties.latitude = lat;

        updated = true;
      }

      if (transform.rotation !== undefined && transform.rotation !== null) {
        const rotation = parseFloat(transform.rotation);
        if (!isNaN(rotation)) {
          feature.transform.rotateY = rotation * -(Math.PI / 180);
          feature.properties.rotation = rotation;
          updated = true;
        }
      }

      if (transform.size !== undefined && transform.size !== null) {
        const size = parseFloat(transform.size);
        if (!isNaN(size) && size > 0) {
          const centroidVal = feature.centroid;
          const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(centroidVal, 0);
          const baseScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
          feature.transform.scale = baseScale * size;
          feature.properties.size = size;
          updated = true;
        }
      }

      if (updated) {
        map.triggerRepaint();

        if (updateWrapper) {
          this.updateCubeWrapperForFeature(feature, sourceId);
        }
      }

      return updated;
    },

    updateCubeWrapperForFeature(graphic3dFeature, sourceId) {
      const map = this;
      console.log('Updating cube wrapper for feature:', graphic3dFeature.properties);

      const existingSource = map.getSource(sourceId);
      if (!existingSource) {
        console.warn(`Source not found: ${sourceId}`);
        return false;
      }

      const keyProperty = graphic3dFeature.layer?.metadata?.featureInfo?.idProperty || 'buildingId';
      const featureId = graphic3dFeature.properties[keyProperty];

      if (!featureId) {
        console.warn('Feature ID not found for cube wrapper update');
        return false;
      }

      const currentData = existingSource._data || { type: 'FeatureCollection', features: [] };

      const wrapperIndex = currentData.features.findIndex((f) =>
        f.properties?.[keyProperty] === featureId || f.id === featureId
      );

      if (wrapperIndex === -1) {
        console.warn(`Cube wrapper not found for feature: ${featureId}`);
        return false;
      }

      const geometryInfo = globalLoadedGeometries.get(graphic3dFeature.graphicId);

      const defaultCubeSizeMeters = 20;
      const defaultHeightMeters = 50;

      const rotation = graphic3dFeature.properties?.rotation ?? 0;

      const currentScale = graphic3dFeature.transform.scale;
      const centroidVal = graphic3dFeature.centroid;
      const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(centroidVal, 0);
      const baseScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
      const actualSizeProportion = currentScale / baseScale;

      let height = defaultHeightMeters;
      let cubeSize = defaultCubeSizeMeters;

      if (geometryInfo && geometryInfo.sizeInMeters) {
        height = geometryInfo.sizeInMeters.height || defaultHeightMeters;
        cubeSize = Math.max(
          geometryInfo.sizeInMeters.width || defaultCubeSizeMeters,
          geometryInfo.sizeInMeters.depth || defaultCubeSizeMeters
        );
      }

      height *= actualSizeProportion;
      cubeSize *= actualSizeProportion;

      const metersToDegrees = (meters, lat) => ({
        dLat: meters / 111320,
        dLon: meters / (111320 * Math.cos((lat * Math.PI) / 180))
      });

      const lng = centroidVal[0];
      const lat = centroidVal[1];

      const { dLat, dLon } = metersToDegrees(cubeSize / 3, lat);

      const ring = [
        [lng - dLon, lat - dLat],
        [lng + dLon, lat - dLat],
        [lng + dLon, lat + dLat],
        [lng - dLon, lat + dLat],
        [lng - dLon, lat - dLat]
      ];

      const updatedWrapper = {
        type: 'Feature',
        id: featureId,
        properties: {
          ...currentData.features[wrapperIndex].properties,
          ...graphic3dFeature.properties,
          height,
          elevation: 0,
          rotation,
          size: actualSizeProportion,
          cube_wrapper: true
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring]
        }
      };

      const updatedFeatures = [...currentData.features];
      updatedFeatures[wrapperIndex] = updatedWrapper;

      existingSource.setData({
        type: 'FeatureCollection',
        features: updatedFeatures
      });

      return true;
    }
  };
}

function updateCentroidsForLevel(map, level, features) {
  if (!['polygon', 'multiPolygon', 'mesh'].includes(level.feature)) return;

  const sourceId = `${level.state}-features`;
  const centroidsSourceId = `${sourceId}-centroids`;
  const centroidsLayerId = `${centroidsSourceId}-layer-circle`;

  const centroidFeatures = features
    .map((f) => {
      try {
        const c = centroid(f.geometry);
        c.properties = { ...f.properties };
        if (f.id != null) c.id = f.id;
        return c;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const fc = featureCollection(centroidFeatures);

  const existing = map.getSource(centroidsSourceId);
  if (!existing) {
    map.addSource(centroidsSourceId, { type: 'geojson', data: fc, promoteId: level.idKey });
  } else {
    existing.setData(fc);
  }

  if (!map.getLayer(centroidsLayerId)) {
    map.addLayer({
      id: centroidsLayerId,
      type: 'circle',
      source: centroidsSourceId,
      paint: {
        'circle-radius': 0.01,
        'circle-opacity': 0
      }
    });
  }
}

export async function upsertOrUpdateAllFeatures({ map, namedPath, getContext, self, fetchedFeatures }) {
  const ctx = getContext ? getContext() : {};
  const { data, reduxState } = ctx;
  const allFeatureLayers = {};
  map.__handlerRegistry = map.__handlerRegistry || new Set();

  const levels = [];
  let parent = {};
  for (const lvl of namedPath) {
    let features;
    if (fetchedFeatures) {
      const fetched = fetchedFeatures.find((ff) => ff.state === lvl.state);
      features = fetched?.features;
    } else {
      const scoped = data?.[lvl.state];
      if (!scoped) continue;
      fixParentFeaturesUsingChildData(lvl, scoped, parent);
      features = dataToFeatures(lvl, scoped) || [];
    }
    if (!features) {
      console.warn(`No features found for level: ${lvl.state}`);
      continue;
    }
    parent = { features, level: lvl };
    levels.push({ ...lvl, features });
    allFeatureLayers[lvl.state] = features.map((f) => f.properties);
  }

  for (const level of levels) {
    const sourceId = `${level.state}-features`;
    const baseLayerId = `${sourceId}-layer`;
    const isMesh = level.feature === 'mesh';

    let src = map.getSource(sourceId);
    if (!src) {
      map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: level.idKey });
      src = map.getSource(sourceId);
    }

    if (!map.getLayer(baseLayerId)) {
      map.addLayer({
        id: baseLayerId,
        type: isMesh ? 'fill-extrusion' : (level.feature === 'point' ? 'circle' : 'fill'),
        source: sourceId,
        paint: isMesh
          ? {
            'fill-extrusion-color': '#000000',
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 10],
            'fill-extrusion-base': ['coalesce', ['get', 'elevation'], 0],
            'fill-extrusion-opacity': 0.0
          }
          : (level.feature === 'point'
            ? { 'circle-radius': 0.01, 'circle-color': '#fff' }
            : { 'fill-color': '#fff', 'fill-opacity': 0.18 })
      });
      map.on('mouseenter', baseLayerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', baseLayerId, () => { map.getCanvas().style.cursor = ''; });
    }

    if (!isMesh) {
      src.setData({ type: 'FeatureCollection', features: level.features });
      updateCentroidsForLevel(map, level, level.features);
    } else {
      const structures = reduxState?.pageComponentState?.structures || {};
      const mapGraphicRefs = reduxState?.pageComponentState?.mapGraphicReferences || [];
      const idByRef = Object.fromEntries(mapGraphicRefs.map((r) => [r._id, r.graphic]));

      const graphicIds = Array.from(new Set(
        levels
          .filter((l) => l.feature === 'mesh')
          .flatMap((l) => l.features.map((f) => f.properties?.structureName).filter(Boolean))
          .map((name) => structures[name])
          .filter(Boolean)
          .map((s) => idByRef[s.mapGraphicRefId])
          .filter(Boolean)
      ));

      loadGraphics(graphicIds).then((loadedGraphics) => {
        const wrappers = [];
        for (const f of level.features) {
          const props = f.properties || {};
          const id = f.id ?? props?.[level.idKey];
          if (!id) continue;

          const c = centroid(f.geometry)?.geometry?.coordinates;
          if (!c) continue;

          let geometryInfo = null;
          if (props.structureName) {
            const structure = structures[props.structureName];
            const gId = structure ? idByRef[structure.mapGraphicRefId] : null;
            geometryInfo = gId ? loadedGraphics?.get(gId) : null;
          }

          const wrapper = buildCubeWrapperFeature({
            level,
            id,
            centroid: c,
            geometryInfo,
            featureProperties: props
          });
          if (wrapper) wrappers.push(wrapper);
        }
        src.setData({ type: 'FeatureCollection', features: wrappers });
        updateCentroidsForLevel(map, level, level.features);

        const customId = `${sourceId}-3d-graphics`;
        if (!map.getLayer(customId)) {
          const custom = createGraphicsCustomLayer(customId, level.features, loadedGraphics, level, getContext);
          map.addLayer(custom);
        } else {
          const layerObj = map.getLayer(customId);
          if (layerObj?.updateFeatures) {
            layerObj.updateFeatures(level.features, loadedGraphics, getContext, level);
          }
        }
      });
    }

    const handlerKey = `click:${namedPath[0]?.state || 'root'}`;
    if (!map.__handlerRegistry.has(handlerKey)) {
      const handler = makeMapOnClickHandler({ map, namedPath, send: self?.send, getContext });
      map.on('click', handler);
      map.__handlerRegistry.add(handlerKey);
    }
  }

  map.triggerRepaint();
  return allFeatureLayers;
}

// Main function to add all feature layers from a namedPath
export async function addAllFeatureLayers({ map, namedPath, getContext, self }) {
  const contextData = getContext ? getContext() : {};
  window.contextData = contextData;

  let parentLevelWithFeatures = {};
  const fetchedFeatures = [];

  for (const level of namedPath) {
    if (!level.feature) continue;

    const options = level.options || {};
    const clusterOptions = options.cluster || {};
    const { sourceOptions } = clusterOptions;

    const features = await fetchFeaturesForLevel(level, parentLevelWithFeatures);
    parentLevelWithFeatures = { features, level };
    fetchedFeatures.push({ ...level, features });
  }

  const allFeatureLayers = upsertOrUpdateAllFeatures({ map, namedPath, fetchedFeatures, getContext, self });
  return allFeatureLayers;
}

// Example: Use this in your addLayersService for XState
export async function addLayers({ context, self }) {
  const { map, namedPaths, reduxStore, reduxDispatch } = context;
  if (!map || !namedPaths) return;

  let reduxState = null;
  if (reduxStore && reduxStore.getState) {
    reduxState = reduxStore.getState();
    console.log('Redux state accessible in addLayers:', reduxState);
  }

  const allFeatureLayers = await addAllFeatureLayers({
    map,
    namedPath: namedPaths[0],
    self,
    getContext: self ? () => {
      const currentContext = self.getSnapshot().context;
      return {
        __ctxRef: currentContext,
        ...currentContext,
        reduxState: currentContext.reduxStore ? currentContext.reduxStore.getState() : null,
        reduxDispatch: currentContext.reduxDispatch
      };
    } : () => context
  });

  const afterLayerSetupCommands = await ScriptCache.runScript('afterLayerSetupCommands', {
    groupedFeatures: allFeatureLayers,
    reduxState,
    reduxDispatch
  });
  context.mmvSend(afterLayerSetupCommands || []);

  return { data: allFeatureLayers };
}

export async function updateLayersFromData({ context, self }) {
  const { map, namedPaths, reduxStore, reduxDispatch } = context;
  if (!map || !namedPaths) return;

  let reduxState = null;
  if (reduxStore && reduxStore.getState) {
    reduxState = reduxStore.getState();
    console.log('Redux state accessible in updateLayers:', reduxState);
  }

  await upsertOrUpdateAllFeatures({
    map,
    namedPath: namedPaths[0],
    self,
    getContext: self ? () => {
      const currentContext = self.getSnapshot().context;
      return {
        __ctxRef: currentContext,
        ...currentContext,
        reduxState: currentContext.reduxStore ? currentContext.reduxStore.getState() : null,
        reduxDispatch: currentContext.reduxDispatch
      };
    } : () => context
  });

  return {};
}

function buildAncestryPredicate(featureDef, context, namedPath) {
  const path = featureDef.path;
  if (!Array.isArray(namedPath)) return null;

  const levelIdx = namedPath.findIndex((l) => l.state === path);
  if (levelIdx < 0) return null;

  const keyVals = [];
  for (let i = 0; i <= levelIdx; i++) {
    const lvl = namedPath[i];
    const idKey = lvl?.idKey;
    if (!idKey) continue;
    const val = context?.[idKey];
    if (val == null) continue;
    keyVals.push([idKey, val]);
  }

  if (keyVals.length === 0) return null;
  return (feat) => {
    const props = feat?.properties || {};
    for (const [k, v] of keyVals) {
      if (props[k] != v) return false;
    }
    return true;
  };
}

export function getFeatures(featureDef, context, sourceId, opts = {}) {
  const { path } = featureDef;
  const fns = getGlobalFilterFunctions(path, true);

  const idKey = featureDef.idKey || `${path}Id`;

  const useContextHierarchy = opts.useContextHierarchy ?? true;

  let features = [];
  let allFeatures = [];
  const namedPath = context?.namedPaths?.[0] || [];
  const expr = context?.filters?.[path];

  try {
    const src = context?.map?.getSource(sourceId);
    const data = src ? (src._data || src.serialize().data) : [];
    features = data?.features || [];
    allFeatures = features;

    if (expr) {
      const compiler = new FilterCompiler(fns);
      const filterFn = compiler.compileFilter(expr);
      features = features.filter(filterFn);
    }

    if (useContextHierarchy) {
      const pred = buildAncestryPredicate(featureDef, context, namedPath);
      if (pred) features = features.filter(pred);
    }
  } catch (e) {
    console.error(e);
    features = [];
  }

  return { allFeatures, features, filters: expr };
}

async function handleMarkers(stateValue, markersConfig, { context, self }) {
  let manageMarkers;

  if (context.manageMarkers[stateValue]) {
    context.map.off('moveend', context.manageMarkers[stateValue]);
    context.map.off('idle', context.manageMarkers[stateValue]);
    context.map.off('sourcedata', context.manageMarkers[stateValue]);
    context.map.off('remove', clearAllMarkers);
  }

  if (markersConfig) {
    manageMarkers = async (e) => {
      const managedPaths = markersConfig
        .map((mi) => mi?.featureDef?.path)
        .filter(Boolean);

      const currentIdsByPath = {};
      const graphicsByPath = {};
      const processedPaths = new Set();

      for (const markersInfo of markersConfig) {
        const { featureDef } = markersInfo;
        const { path } = featureDef;
        const sourceId = markersInfo.sourceId;

        if (e && e.sourceId === sourceId && e.hasOwnProperty('isSourceLoaded') && !e.isSourceLoaded) {
          continue;
        } else if (e && e.sourceId !== sourceId && e.type === 'sourcedata') {
          continue;
        }

        const {
          graphics,
          visibleFeatures,
          currentMarkerIds,
          filters
        } = await renderAllMarkers(e, markersInfo, { self, getFeatures });

        currentIdsByPath[path] = currentMarkerIds || [];
        graphicsByPath[path] = graphics || [];
        processedPaths.add(path);
      }

      if (processedPaths.size === 0) return;

      if (managedPaths.length === 0) {
        try {
          const allIds = [...getMarkers().keys()];
          if (allIds.length) {
            context.mmvSend([{
              commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
              commandRef: uuid(),
              params: { ids: allIds }
            }]);
            clearStaleMarkers(allIds);
          }
        } finally {
          // no-op
        }
        return;
      }

      try {
        const existingIds = [...getMarkers().keys()];

        const managedIds = existingIds.filter((id) =>
          managedPaths.some((path) => id.startsWith(`${path}`))
        );
        const nonManagedToRemove = existingIds.filter((id) => !managedIds.includes(id));

        const unionCurrentIds = new Set(
          Object.values(currentIdsByPath).flat()
        );

        const staleToRemove = managedIds.filter((id) => !unionCurrentIds.has(id));

        const idsToRemove = [...new Set([...nonManagedToRemove, ...staleToRemove])];
        if (idsToRemove.length) {
          context.mmvSend([{
            commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
            commandRef: uuid(),
            params: { ids: idsToRemove }
          }]);
          clearStaleMarkers(idsToRemove);
        }

        const graphicsToAdd = Object.values(graphicsByPath).flat();
        if (graphicsToAdd.length) {
          context.mmvSend([{
            commandName: MMV_COMMANDS.ADD_GRAPHICS,
            commandRef: uuid(),
            params: { graphics: graphicsToAdd }
          }]);
          graphicsToAdd.forEach(addMarkers);
        }
      } finally {
        // no-op
      }
    };

    if (context.map) {
      context.map.on('moveend', manageMarkers);
      context.map.on('idle', manageMarkers);
      context.map.on('sourcedata', manageMarkers);
      context.map.on('remove', clearAllMarkers);
    }

    await manageMarkers();

    
    setGateReady(context, stateValue);
  }

  return { manageMarkers };
}

async function handleFeatureFilters(stateValue, levels, { context, self }) {
  let manageFeatureFilters;

  if (context.manageFeatureFilters) {
    context.map.off('sourcedata', context.manageFeatureFilters);
    context.map.off('idle', context.manageFeatureFilters);
  }

  manageFeatureFilters = async (e) => {
    for (const level of levels) {
      const path = level.state;
      const featureDef = { ...level, path };

      const sourceId = path + '-features';
      if (e && e.sourceId === sourceId && e.hasOwnProperty('isSourceLoaded') && !e.isSourceLoaded) {
        continue;
      } else if (e && e.sourceId !== sourceId && e.type === 'sourcedata') {
        continue;
      }

      const { features: visibleFeatures, allFeatures, filters } = getFeatures(featureDef, context, sourceId);

      if (path === 'site') {
        if (stateValue === 'portfolio') {
          if (globalFilterKeys.get('site-features-centroids-layer-circle')) {
            context.mmvSend([{
              commandName: MMV_COMMANDS.CUSTOM,
              commandRef: uuid(),
              params: {
                commandName: 'filtermodel',
                commandRef: uuid(),
                params: {
                  clear: true,
                  extra: { layerNames: 'site-features-centroids-layer-circle' }
                }
              }
            }]);
            globalFilterKeys.delete('site-features-centroids-layer-circle');
          }

          if (globalFilterKeys.get('site-features-layer')) {
            context.mmvSend([{
              commandName: MMV_COMMANDS.CUSTOM,
              commandRef: uuid(),
              params: {
                commandName: 'filtermodel',
                commandRef: uuid(),
                params: {
                  clear: true,
                  extra: {
                    layerNames: 'site-features-layer',
                    field: 'siteId',
                    fieldType: 'string'
                  }
                }
              }
            }]);
            globalFilterKeys.delete('site-features-layer');
          }
        } else {
          const { siteId } = self.getSnapshot().context;

          const allIds = visibleFeatures
            .map((f) => f?.properties?.siteId)
            .filter((id) => id != null);

          const ids = (siteId != null)
            ? (allIds.includes(siteId) ? [siteId] : [])
            : Array.from(new Set(allIds));

          const key = makeGlobalFilterKey({
            layer: 'site-features-layer',
            field: 'siteId',
            ids,
            invert: false,
            filter: context.filters?.['site']
          });

          if (globalFilterKeys.get('site-features-layer') !== key) {
            try {
              context.mmvSend([{
                commandName: MMV_COMMANDS.CUSTOM,
                commandRef: uuid(),
                params: {
                  commandName: 'filtermodel',
                  commandRef: uuid(),
                  params: {
                    clear: false,
                    ids,
                    invert: false,
                    extra: {
                      layerNames: 'site-features-layer',
                      field: 'siteId',
                      fieldType: 'string'
                    }
                  }
                }
              }]);
              globalFilterKeys.set('site-features-layer', key);
            } catch (err) {
              console.error(err);
            }
          }

          if (globalFilterKeys.get('site-features-centroids-layer-circle') !== key) {
            try {
              context.mmvSend([{
                commandName: MMV_COMMANDS.CUSTOM,
                commandRef: uuid(),
                params: {
                  commandName: 'filtermodel',
                  commandRef: uuid(),
                  params: {
                    clear: false,
                    ids,
                    invert: false,
                    extra: {
                      layerNames: 'site-features-centroids-layer-circle',
                      field: 'siteId',
                      fieldType: 'string'
                    }
                  }
                }
              }]);
              globalFilterKeys.set('site-features-centroids-layer-circle', key);
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
    }
  };

  if (context.map) {
    context.map.on('idle', manageFeatureFilters);
    context.map.on('sourcedata', manageFeatureFilters);
  }
  manageFeatureFilters();

  return { manageFeatureFilters };
}

export async function onDataUpdatedAction({ mapMachineInput }) {
  return updateLayersFromData(mapMachineInput);
}
export async function getInitAction({ mapMachineInput }) {
  return addLayers(mapMachineInput);
}

function getMachineCtx(ctx) {
  return ctx?.__ctxRef || ctx?.context || ctx;
}

function dispatchGate(context, action) {
  const machineCtx = getMachineCtx(context);
  const reduxDispatch = machineCtx?.reduxDispatch || context?.reduxDispatch;
  if (typeof reduxDispatch === 'function') {
    reduxDispatch(action);
    return true;
  }
  console.warn('[graphicsGate] reduxDispatch not available', { machineCtx, context });
  return false;
}

function setGateLoading(context, stateValue) {
  const machineCtx = getMachineCtx(context);
  const gateToken = Date.now();

  machineCtx._graphicsGateToken = machineCtx._graphicsGateToken || {};
  machineCtx._graphicsGateToken[stateValue] = gateToken;
  machineCtx?.reduxDispatch?.(setGraphicsGateLoading({ stateValue: 'portfolio' }));
  dispatchGate(machineCtx, setGraphicsGateLoading({ stateValue, token: gateToken }));
  return gateToken;
}

function setGateReady(context, stateValue) {
  const machineCtx = getMachineCtx(context);
  const token = machineCtx?._graphicsGateToken?.[stateValue];
  dispatchGate(machineCtx, setGraphicsGateReady({ stateValue, token }));
}


export async function getEntryAction({ mapMachineInput }) {
  const { stateValue, event, self } = mapMachineInput;

  const snapshot = self.getSnapshot();
  const context = snapshot.context;
  const { suppressEntryActions } = context;

  if (suppressEntryActions) {
    return { suppressEntryActions: false };
  }

  switch (stateValue) {
    case 'portfolio': {

    const ctxData = context;
    const machineCtx = ctxData?.__ctxRef || ctxData?.context || ctxData;

if (machineCtx?.reduxDispatch) {
  setGateLoading(machineCtx, 'portfolio');

// reset the 3D gate promise for this run (on the same ctx)
if (machineCtx.__mmv3d?.portfolio) {
  machineCtx.__mmv3d.portfolio.done = false;
}
      ensure3DInitializedGate(machineCtx, 'portfolio');
}

      const { commands, theme = {}, singleMarkers, legend } =
        await ScriptCache.runScript('getEntryActionTheme', { suppressEntryActions, stateValue });

      // zoomToFeature({ map: context.map, context });

      const namedPath = context.namedPaths[0];

      for (const layerId of Object.keys(theme)) {
        const themeConfig = theme[layerId];
        const state = layerId.split('-')[0];
        const level = getLevel(state, namedPath);
        if (level) {
          const { groupsObject } = buildGroupsFromBins(context.map, layerId, level.idKey, themeConfig);

          const mmvThemeCommands = [{
            commandName: MMV_COMMANDS.THEME_ELEMENTS,
            commandRef: uuid(),
            params: {
              groups: groupsObject,
              clear: false,
              extra: {
                field: level.idKey,
                fieldType: level.idType || 'string',
                layerNames: [layerId]
              }
            }
          }];
          context.mmvSend(mmvThemeCommands);
        }
      }

      clearAllMarkers();

      const ready = await waitFor3DInitialized(machineCtx, 'portfolio', { timeoutMs: 15000 });
      if (!ready) {
        console.warn('[portfolio] 3D layer init gate timed out. Allowing markers anyway.');
      }

    zoomToFeature({ map: context.map, context });

      const markersConfig = singleMarkers;
     const { manageMarkers } = await handleMarkers(stateValue, markersConfig, { context: machineCtx, self });
const { manageFeatureFilters } = await handleFeatureFilters(stateValue, namedPath, { context: machineCtx, self });
setGateReady(machineCtx, 'portfolio');
      return {
        commands: null,
        manageMarkers: { ...context.manageMarkers, [stateValue]: manageMarkers },
        theme,
        legend,
        manageFeatureFilters
      };
    }

    case 'portfolio.site': {
      const siteId = event.siteId ?? context.siteId;
      zoomToFeature({ map: context.map, context, state: 'site', featureId: siteId });
      const namedPath = context.namedPaths[0];
      const { commands, theme = {}, singleMarkers, legend } =
        await ScriptCache.runScript('getEntryActionTheme', { suppressEntryActions, stateValue });

      const markersConfig = singleMarkers;
      const { manageMarkers } = await handleMarkers(stateValue, markersConfig, { context, self });
      const { manageFeatureFilters } = await handleFeatureFilters(stateValue, namedPath, { context, self });

      for (const layerId of Object.keys(theme)) {
        const themeConfig = theme[layerId];
        const state = layerId.split('-')[0];
        const level = getLevel(state, namedPath);
        if (level) {
          const { groupsObject } = buildGroupsFromBins(context.map, layerId, level.idKey, themeConfig);

          const mmvThemeCommands = [{
            commandName: MMV_COMMANDS.THEME_ELEMENTS,
            commandRef: uuid(),
            params: {
              groups: groupsObject,
              clear: false,
              extra: {
                field: level.idKey,
                fieldType: level.idType || 'string',
                layerNames: [layerId]
              }
            }
          }];
          context.mmvSend(mmvThemeCommands);
        }
      }

      return { commands: null, manageMarkers: { ...context.manageMarkers, [stateValue]: manageMarkers }, theme, legend, manageFeatureFilters };
    }

    case 'portfolio.site.building': {
      const siteId = event.siteId ?? context.siteId;
      const buildingId = event.buildingId ?? context.buildingId;
      const { commands, theme = {}, singleMarkers, legend } =
        await ScriptCache.runScript('getEntryActionTheme', { suppressEntryActions, stateValue });

      zoomToFeature({ map: context.map, context, state: 'building', featureId: buildingId });

      return { commands: null, legend };
    }

    default:
      return {};
  }
}

export async function getExitAction({ mapMachineInput }) {
  const { stateValue, context, event, self } = mapMachineInput;
  console.log('getExitAction', { mapMachineInput });
  if (context.suppressExitActions) {
    return { suppressExitActions: false };
  }
  switch (stateValue) {
    case 'portfolio': {
      if (context.manageMarkers[stateValue]) {
        context.map.off('moveend', context.manageMarkers[stateValue]);
        context.map.off('idle', context.manageMarkers[stateValue]);
        context.map.off('sourcedata', context.manageMarkers[stateValue]);
      }
      const markerIds = getMarkers().keys().toArray();
      if (markerIds && markerIds.length) {
        const commands = [{
          commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
          commandRef: uuid(),
          params: {
            ids: [...markerIds],
          }
        }];
        context.mmvSend(commands);
      }
      clearAllMarkers();
      return { manageMarkers: { ...context.manageMarkers, [stateValue]: null } };
    }
    case 'portfolio.site': {
      if (context.manageMarkers[stateValue]) {
        context.map.off('moveend', context.manageMarkers[stateValue]);
        context.map.off('idle', context.manageMarkers[stateValue]);
        context.map.off('sourcedata', context.manageMarkers[stateValue]);
      }
      const markerIds = getMarkers().keys().toArray();
      if (markerIds && markerIds.length) {
        const commands = [{
          commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
          commandRef: uuid(),
          params: {
            ids: [...markerIds],
          }
        }];
        context.mmvSend(commands);
      }
      clearAllMarkers();

      return { manageMarkers: { ...context.manageMarkers, [stateValue]: null } };
    }
    case 'portfolio.site.building': {
      if (context.manageMarkers[stateValue]) {
        context.map.off('moveend', context.manageMarkers[stateValue]);
        context.map.off('idle', context.manageMarkers[stateValue]);
        context.map.off('sourcedata', context.manageMarkers[stateValue]);
      }
      const markerIds = getMarkers().keys().toArray();
      if (markerIds && markerIds.length) {
        const commands = [{
          commandName: MMV_COMMANDS.REMOVE_GRAPHICS,
          commandRef: uuid(),
          params: {
            ids: [...markerIds],
          }
        }];
        context.mmvSend(commands);
      }
      clearAllMarkers();

      return { manageMarkers: { ...context.manageMarkers, [stateValue]: null } };
    }

    default:
      return {};
  }
}
