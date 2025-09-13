import mapboxgl from "mapbox-gl";
import {markHandled} from "./mapEntryActions.mjs";
import {get} from "lodash";

const PIE_SIZE  = 48;
const PIE_ALPHA = 0.7; // (lower -> more transparent)

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

function createSingleMarker(context, feature, {bins, property, showLabel = true, pieAlpha=true, getCounts = getBinCounts, popupConfig, send, featureDef, setPopupState}){
    const {map, namedPaths} = context;
    const namedPath = namedPaths[0]
    const {idKey, path} = featureDef;
    const id = feature.id ?? feature.properties._id ?? JSON.stringify(feature.geometry.coordinates);
    const keyVal = feature?.properties?.[idKey] ?? id;
    const markerId = `${path}-${keyVal}`;
    let entry = markers.get(markerId);
    if(entry){
        return null;
    }
    const coordinates = feature.geometry.coordinates;

    const counts = getCounts(map, feature, { bins, property});
    const total = Object.values(counts).reduce((acc, cur) => acc+cur, 0);
    const color = total == 1 ? getBinColorFromCounts(counts, bins) : undefined;
    const { labelWrap, badge } = makeMarkerShell(PIE_SIZE, showLabel ? total : "", !showLabel ? color : undefined);
    const wrap = document.createElement('div');
    wrap.style.width = wrap.style.height = PIE_SIZE+'px';
    wrap.style.position = 'relative';
    wrap.id = "SingleMarker-"+id;
    wrap.setAttribute('class', 'singleMarker singleMarker-'+feature.properties.name);
    wrap.style.cursor = 'pointer';   // makes mouse turn to hand
    wrap.appendChild(labelWrap);
    wrap.addEventListener('click', (e) => {
        if (send) {
            // Payload carries the actual property name as a key
            // e.g. if idKey === 'siteId' -> { type:'GO_TO', siteId: 'ABC123', path }
            markHandled(e);
            const targetIdx = namedPath.map(p=>p.state).indexOf(path);
            const evt = { type: 'GO_TO' };
            namedPath.forEach((lvl, idx) => {
                // debugger;
                const { idKey } = lvl;
                if (!idKey) return; // top-most usually has no idKey
                if (idx < targetIdx) {
                    // Keep current value if present; if you want to force re-entry, you can set it explicitly
                    evt[idKey] = context[idKey] ?? undefined;
                } else if (idx == targetIdx) {
                    // Keep current value if present; if you want to force re-entry, you can set it explicitly
                    evt[idKey] = feature?.properties?.[idKey] ?? undefined;
                } else {
                    // Null deeper ids to bubble up
                    evt[idKey] = null;
                }
            });
            console.log("evt",evt)
            send(evt);
        }
    });
    function show() {
        if(!popupConfig){
            hide()
            return;
        }
        setPopupState((s) => ({ open: true, lngLat: coordinates, data: feature, config: popupConfig }));
    }

    function hide() {
        setPopupState((s) => ({ ...s, open: false }));
    }

    // Show on hover, hide when leaving the marker element
    wrap.addEventListener('mouseenter', show);
    wrap.addEventListener('mouseleave', hide);

    // also hide when the map is dragged/zoomed
    map.on('dragstart', ()=>{hide()});
    map.on('zoomstart', ()=>{hide()});

    const element = wrap;

    const canvas = makePieCanvas(PIE_SIZE, counts, bins.map(b=>b.color), pieAlpha);
    const old = element.querySelector('canvas'); if (old) old.remove();
    element.prepend(canvas);

    return {
        element,
        coordinates,
        type: "marker",
        id: markerId
    }
}

function clearStaleMarkers(visibleMarkerIds){
    for (const id of Array.from(markers.keys())){
        if (visibleMarkerIds && !visibleMarkerIds.has(id)){
            //markers.get(id).marker.remove();//since moving to mmv command we have no marker access
            markers.delete(id);
        }
    }
}

export function clearAllMarkers() {
   for (const [id, markerEntry] of markers.entries()) {
    // if you have Mapbox marker instances:
    if (markerEntry.marker) {
      markerEntry.marker.remove();
    }
    // if you only have DOM elements:
    if (markerEntry.element && markerEntry.element.parentNode) {
      markerEntry.element.parentNode.removeChild(markerEntry.element);
    }
  }
  markers.clear();
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
    return markerIds;
}

const getLevel = (stateName, namedPath) => namedPath.find(lvl => lvl.state === stateName);

export async function renderAllMarkers(e, {context, self}, singleMarkers) {
    const {map} = context;

    let graphics = [];



    for(const markersInfo of singleMarkers){
        const {featureDef, config, ...restMarkerInfo} = markersInfo;

        const {path} = featureDef;
        console.log('markersInfo', markersInfo);
        console.log('singleMarkers', singleMarkers);

        try {
            const src = context.map.getSource(markersInfo.sourceId);
            const data = src._data || src.serialize().data; // raw GeoJSON
            //TOCHECK: FILTERS
            let features = data?.features;
            
              // Only overwrite if markersInfo.features wasn't already set
            if (!markersInfo.features || !markersInfo.features.length) {
                markersInfo.features = features;
            }

            // if(markersInfo.features.length !== data?.features?.length) {
            //     features = markersInfo.features
            // }
        } catch(e){
            console.error(e);
            markersInfo.features = [];
        }

        const sourceId = path+"-features";
        if (e && e.sourceId === sourceId && e.hasOwnProperty("isSourceLoaded") && !e.isSourceLoaded){
            continue;
        }
        else if (e && e.sourceId !== sourceId && e.type == "sourcedata"){
            continue;
        }

        clearAllMarkers();
       
        let markerGraphics = await Promise.all(markersInfo.features.map(async f => {
            return  createSingleMarker(context, f,{...config, ...restMarkerInfo, featureDef, send: self.send, setPopupState: context.setPopupState});
        }));
        graphics.push(...markerGraphics.filter(m=>!!m));
    }
    graphics.forEach(graphic => {
        markers.set(graphic.id,graphic);//track markers internally
    })
    return {graphics};
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
