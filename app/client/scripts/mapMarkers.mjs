import mapboxgl from "mapbox-gl";
import {markHandled} from "./mapEntryActions.mjs";
import {get} from "lodash";
import {FilterCompiler} from "../../ipaCore/pageComponents/utils/filters.global.js";
import {getGlobalFilterFunctions} from "../../ipaCore/pageComponents/utils/filters.global.js";
import {Mutex} from "./mutex.js";

const PIE_SIZE  = 48;
const PIE_ALPHA = 0.7; // (lower -> more transparent)

export const markersMutex = new Mutex();//we have to lock on the markers map access
const markers = new Map();

function binIndexFor(val, bins) {
    for (let i=0;i<bins.length;i++){
        const b = bins[i];
        if ((b.min === null || val >= b.min) &&
            (b.max === null || val <  b.max)) {
            return i;
        }
    }
    return -1;
}

function getLeavesCounts(map, {sourceId, clusterId, bins, property, limit=1000}){
    return new Promise(resolve=>{
        map.getSource(sourceId).getClusterLeaves(clusterId, limit, 0, (err, leaves)=>{
            const counts = new Array(bins.length).fill(0);
            if (!err && leaves) {
                for (const f of leaves) {
                    const idx = binIndexFor(f.properties[property], bins);
                    if (idx >= 0) counts[idx]++;
                }
            }
            resolve({ counts, total: leaves ? leaves.length : 0 });
        });
    });
}

function getBinCounts(map, feature, {bins, property}){
    let value;
    if (typeof property === "function") {
        value = property(feature);
    } else {
        value = property ? get(feature.properties, property, "") : undefined;
    }
    const idx = binIndexFor(value, bins);
    const counts = new Array(bins.length).fill(0);
    if (idx >= 0) counts[idx] = 1;
    return counts;
}

function getBinColorFromCounts(counts, bins) {
    const idx = counts.findIndex(c => c === 1);
    return idx >= 0 ? bins[idx].color : null;
}


export function makePieCanvas(size, counts, colors, alpha = PIE_ALPHA) {
    const total = counts.reduce((a,b)=>a+b,0);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const r = size/2;

    ctx.globalAlpha = alpha;   // << semi-transparent slices
    let start = -Math.PI/2;        // 12 o’clock
    if (total === 0) {
        ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI*2); ctx.fillStyle = '#ddd'; ctx.fill();
    } else {
        counts.forEach((count,i)=>{
            if (!count) return;
            const angle = (count/total) * Math.PI*2;
            ctx.beginPath();
            ctx.moveTo(r, r);
            ctx.arc(r, r, r, start, start+angle);
            ctx.closePath();
            ctx.fillStyle = colors[i];
            ctx.fill();
            start += angle;
        });
    }
    ctx.globalAlpha = 1; // reset
    return c;            // << no border drawn around the pie
}

export function makeMarkerShell(size, labelText, color){

    const labelWrap = document.createElement('div');
    labelWrap.className = 'count-badge-label';
    const badge = document.createElement('div');
    badge.className = 'count-badge';
    badge.textContent = labelText;
    if(color){
        badge.style.backgroundColor = color;
    }
    labelWrap.appendChild(badge);
    return {labelWrap, badge};
}

function normalizeLngLat(ll) {
    const [a, b] = ll;
    if (Math.abs(a) <= 90 && Math.abs(b) > 90) return [b, a];
    return [a, b];
}

function wrapToView(lng, centerLng) {
    // shift lng by ±360 so it’s closest to centerLng
    while (lng - centerLng > 180) lng -= 360;
    while (centerLng - lng > 180) lng += 360;
    return lng;
}

function createSingleMarker(context, feature, {
    bins,
    property,
    showLabel = true,
    pieAlpha = true,
    getCounts = getBinCounts,
    getTotalCounts,
    popupConfig,
    send,
    featureDef,
    setPopupState,
    markerId
}) {
    const { map, namedPaths } = context;
    const namedPath = namedPaths[0];
    const { path } = featureDef;

    const existing = markers.get(markerId);

    const coordinates = feature.geometry.coordinates;
    const counts = getCounts(map, feature, { bins, property });
    const totalCounts = getTotalCounts ? getTotalCounts(map, feature, { bins, property }) : counts;
    const total = Object.values(totalCounts).reduce((acc, cur) => acc + cur, 0);
    const color = total == 1 ? getBinColorFromCounts(counts, bins) : undefined;

    //  If marker already exists, just update its DOM 
    if (existing && existing.element) {
        const el = existing.element;

        // update badge text & background color
        const badge = el.querySelector('.count-badge');
        if (badge) {
            badge.textContent = showLabel ? String(total) : '';
            if (!showLabel && color) {
                badge.style.backgroundColor = color;
            }
        }

        // repaint pie canvas
        const canvas = makePieCanvas(PIE_SIZE, counts, bins.map(b => b.color), pieAlpha);
        const oldCanvas = el.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();
        el.prepend(canvas);

        // IMPORTANT: don’t return a new graphic, so handleMarkers won't try to ADD_GRAPHICS again
        return null;
    }

    //  Original creation path
    const { labelWrap, badge } = makeMarkerShell(
        PIE_SIZE,
        showLabel ? total : '',
        !showLabel ? color : undefined
    );

    const wrap = document.createElement('div');
    wrap.style.width = wrap.style.height = PIE_SIZE + 'px';
    wrap.style.position = 'relative';
    wrap.id = 'SingleMarker-' + markerId;
    wrap.setAttribute('class', 'singleMarker singleMarker-' + feature.properties.name);
    wrap.style.cursor = 'pointer';
    wrap.appendChild(labelWrap);

    wrap.addEventListener('click', (e) => {
        if (send) {
            markHandled(e);
            const targetIdx = namedPath.map(p => p.state).indexOf(path);
            const evt = { type: 'GO_TO' };
            namedPath.forEach((lvl, idx) => {
                const { idKey } = lvl;
                if (!idKey) return;
                if (idx < targetIdx) {
                    evt[idKey] = context[idKey] ?? undefined;
                } else if (idx === targetIdx) {
                    evt[idKey] = feature?.properties?.[idKey] ?? undefined;
                } else {
                    evt[idKey] = null;
                }
            });
            send(evt);
        }
    });

    function show() {
        if (!popupConfig) {
            hide();
            return;
        }
        setPopupState((s) => ({
            open: true,
            lngLat: coordinates,
            data: feature,
            config: popupConfig
        }));
    }

    function hide() {
        setPopupState((s) => ({ ...s, open: false }));
    }

    wrap.addEventListener('mouseenter', show);
    wrap.addEventListener('mouseleave', hide);
    map.on('dragstart', hide);
    map.on('zoomstart', hide);

    const element = wrap;
    const canvas = makePieCanvas(PIE_SIZE, counts, bins.map(b => b.color), pieAlpha);
    const old = element.querySelector('canvas'); if (old) old.remove();
    element.prepend(canvas);

    return {
        element,
        coordinates,
        type: 'marker',
        id: markerId
    };
}

export function getMarkers() {
    return markers;
}

export function addMarkers(graphic) {
    markers.set(graphic.id, graphic);
}

export function clearStaleMarkers(staleMarkerIds){
    for (const id of Array.from(markers.keys())){
        if (staleMarkerIds && staleMarkerIds.includes(id)){
            //markers.get(id).marker.remove();//since moving to mmv command we have no marker access
            markers.delete(id);
        }
    }
}


export function clearStaleMarkersByPath(path){
    const markerIds = new Set();
    for (const id of Array.from(markers.keys())){
        if (path && id.startsWith(path)){
            markerIds.add(id);
            //markers.get(id).marker.remove();//since moving to mmv command we have no marker access
            markers.delete(id);
        }
    }
    return [...markerIds];
}

export function clearAllMarkers(){
    markers.clear();
}

const getLevel = (stateName, namedPath) => namedPath.find(lvl => lvl.state === stateName);

export async function renderAllMarkers(e, markersInfo, {self}) {
    const context = self.getSnapshot().context;
    const {map} = context;

    let graphics = [];

    const {featureDef, config, ...restMarkerInfo} = markersInfo;
    const {path} = featureDef;

    const fns = getGlobalFilterFunctions("site", true);
    let features;
    let allFeatures = [];
    const filters = context?.filters?.[path];
    try {
        const src = context?.map?.getSource(markersInfo.sourceId);
        const data = src ? (src._data || src.serialize().data) : [];

        features = data?.features;
        allFeatures = features;

        if(filters) {
            const compiler = new FilterCompiler(fns)
            const filterFn = compiler.compileFilter(filters);
            features = features.filter(filterFn);
        }
    } catch(e){
        console.error(e);
        features = [];
    }

    const visibleFeatures  = features;

    let markerGraphics = await Promise.all(features.map(async f => {
        const {idKey, path} = featureDef;
        const id = f.id ?? f.properties._id ?? JSON.stringify(f.geometry.coordinates);
        const keyVal = f?.properties?.[idKey] ?? id;
        const markerId = `${path}-${keyVal}`;
        return {markerId, graphic: createSingleMarker(context, f,{...config, ...restMarkerInfo, markerId, featureDef, send: self.send, setPopupState: context.setPopupState})};
    }));
    graphics.push(...markerGraphics.filter(mg=>!!mg.graphic).map(mg=>mg.graphic));
    const allFeaturesMarkerIds = allFeatures.map(f=>{
        const {idKey, path} = featureDef;
        const id = f.id ?? f.properties._id ?? JSON.stringify(f.geometry.coordinates);
        const keyVal = f?.properties?.[idKey] ?? id;
        const markerId = `${path}-${keyVal}`;
        return markerId;
    })
    const currentMarkerIds = markerGraphics.map(mg => mg.markerId);
    return {allFeatures, graphics, visibleFeatures, allFeaturesMarkerIds, currentMarkerIds, filters};
}


export function zoomIntoClusterByExpansion(map, sourceId, clusterId, fallbackLngLat) {
    const src = map.getSource(sourceId);
    if (!src || !src.getClusterExpansionZoom) return;

    src.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        // center on the cluster and zoom one level where it breaks up
        map.easeTo({
            center: fallbackLngLat,
            zoom: zoom,
            duration: 500
        });
    });
}

export function zoomIntoClusterByBounds(map, sourceId, clusterId, limit = 5000, padding = 60) {
    const src = map.getSource(sourceId);
    if (!src || !src.getClusterLeaves) return;

    src.getClusterLeaves(clusterId, limit, 0, (err, leaves) => {
        if (err || !leaves || leaves.length === 0) return;

        const bounds = new mapboxgl.LngLatBounds();
        for (const f of leaves) {
            const [lng, lat] = f.geometry.coordinates;
            bounds.extend([lng, lat]);
        }

        map.fitBounds(bounds, { padding, duration: 600 });
    });
}
