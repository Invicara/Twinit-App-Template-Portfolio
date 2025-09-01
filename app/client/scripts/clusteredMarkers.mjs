import mapboxgl from "mapbox-gl";
import {markHandled} from "./mapEntryActions.mjs";

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
    const idx = binIndexFor(feature.properties[property], bins);
    const counts = new Array(bins.length).fill(0);
    if (idx >= 0) counts[idx] = 1;
    return counts;
}


export function makePieCanvas(size, counts, colors) {
    const total = counts.reduce((a,b)=>a+b,0);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const r = size/2;

    ctx.globalAlpha = PIE_ALPHA;   // << semi-transparent slices
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

export function makeMarkerShell(size, labelText){

    const labelWrap = document.createElement('div');
    labelWrap.className = 'count-badge-label';
    const badge = document.createElement('div');
    badge.className = 'count-badge';
    badge.textContent = labelText;
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

async function ensureClusterMarker(map, feature, {sourceId, bins, property, getCounts}){
    const id = feature.properties.cluster_id;
    const coords = feature.geometry.coordinates;
    const pointCount = feature.properties.point_count;
    let entry = markers.get("cluster"+id);
    if (!entry){

        const { labelWrap, badge } = makeMarkerShell(PIE_SIZE, pointCount);

        const wrap = document.createElement('div');
        wrap.style.width = wrap.style.height = PIE_SIZE+'px';
        wrap.style.position = 'relative';
        wrap.style.cursor = 'pointer';   // makes mouse turn to hand
        // stash cluster_id so click handler can find it
        wrap.dataset.clusterId = String(id);
        //wrap.addEventListener('click', () => zoomIntoClusterByExpansion(map, sourceId, id, coords));
        //or
        wrap.addEventListener('click', () => zoomIntoClusterByBounds(map, sourceId, id, coords));
        wrap.appendChild(labelWrap);

        const marker = new mapboxgl.Marker({ element: wrap, anchor:'center' })
            .setLngLat(coords).addTo(map);
        entry = { marker, el: wrap, badge };
        markers.set("cluster"+id, entry);
    } else {
        entry.marker.setLngLat(coords);
        entry.badge.textContent = pointCount;
    }

    const { counts } = await getCounts(map, {sourceId, clusterId: id, bins, property});

    const canvas = makePieCanvas(PIE_SIZE, counts, bins.map(b=>b.color));
    const old = entry.el.querySelector('canvas'); if (old) old.remove();
    entry.el.prepend(canvas);
}

function ensureSingleMarker(map, feature, {bins, property, getCounts = getBinCounts, send, path, idKey}){
    const id = feature.id ?? feature.properties._id ?? JSON.stringify(feature.geometry.coordinates);
    // --- coords -------------------------------------------------------------
    const centerLng = map.getCenter().lng;
    const [lng, lat] = normalizeLngLat(feature.geometry.coordinates);
    const coords = [wrapToView(lng, centerLng), lat];
    const keyVal = feature?.properties?.[idKey] ?? feature.id;// value from feature

    // --- marker id -------------------
    const markerId = `${path}-${keyVal}`;
    let entry = markers.get(markerId);
    if (!entry){
        const buildings = feature.properties.buildings.length;
        const { labelWrap, badge } = makeMarkerShell(PIE_SIZE, buildings);
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
                send({ type: 'GO_TO', [idKey]: keyVal, path });
            }
        });
        const marker = new mapboxgl.Marker({ element: wrap, anchor:'center' })
            .setLngLat(coords).addTo(map);
        entry = { marker, el: wrap, badge };
        markers.set(markerId, entry);
        //console.log('singleMarker add', markerId);
    } else {
        entry.marker.setLngLat(coords);
    }

    const counts = getCounts(map, feature, { bins, property});

    const canvas = makePieCanvas(PIE_SIZE, counts, bins.map(b=>b.color));
    const old = entry.el.querySelector('canvas'); if (old) old.remove();
    entry.el.prepend(canvas);
}

function clearStaleMarkers(visibleMarkerIds){
    for (const id of Array.from(markers.keys())){
        if (visibleMarkerIds && !visibleMarkerIds.has(id)){
            markers.get(id).marker.remove();
            markers.delete(id);
            //console.log('singleMarker delete', id);
        }
    }
}


export function clearStaleMarkersByPath(path){
    for (const id of Array.from(markers.keys())){
        if (path && id.startsWith(path)){
            markers.get(id).marker.remove();
            markers.delete(id);
            //console.log('singleMarker delete', id);
        }
    }
}

const getLevel = (stateName, namedPath) => namedPath.find(lvl => lvl.state === stateName);

export async function renderAllMarkers(e, {context, self}, clustersMarkersMap = {}, singleMarkersMap = {}) {
    const {map} = context;
    const markerIds = new Set();
    for(const path of Object.keys(clustersMarkersMap)){
        const sourceId = path+"-features";
        if (e && e.sourceId === sourceId && e.hasOwnProperty("isSourceLoaded") && !e.isSourceLoaded){
            return;
        }
        if (e && e.sourceId !== sourceId && e.hasOwnProperty("isSourceLoaded") && e.isSourceLoaded){
            return;
        }
        const namedPath = context.namedPaths[0];//TODO, select correct namedPath index
        const stateCfg = getLevel(path, namedPath);
        const idKey = stateCfg.idKey || '_id';
        const clustersMarkers = clustersMarkersMap[path]
        for(const cluster of clustersMarkers){
            const layer = sourceId+"-layer-clustered"
            const {config, getCounts = getLeavesCounts} = cluster;

            let features = map.queryRenderedFeatures({ layers: [layer] });
            await Promise.all(features.map(async f => {
                markerIds.add("cluster"+f.properties.cluster_id);
                await ensureClusterMarker(map,f,{...config, sourceId: sourceId, getCounts});
            }));
        }
    }

    for(const path of Object.keys(singleMarkersMap)){
        const sourceId = path+"-features";
        if (e && e.sourceId === sourceId && e.hasOwnProperty("isSourceLoaded") && !e.isSourceLoaded){
            return;
        }
        if (e && e.sourceId !== sourceId && e.hasOwnProperty("isSourceLoaded") && e.isSourceLoaded){
            return;
        }
        const namedPath = context.namedPaths[0];//TODO, select correct namedPath index
        const stateCfg = getLevel(path, namedPath);
        const idKey = stateCfg.idKey || '_id';
        const singleMarkers = singleMarkersMap[path];
        for(const singlePoint of singleMarkers){
            const {features, config, getCounts = getBinCounts} = singlePoint;
            await Promise.all(features.map(async f => {
                markerIds.add(path+"-"+f.properties[idKey]);
                await ensureSingleMarker(map, f, {...config, getCounts, send: self.send, path, idKey})
            }));
        }
    }
    clearStaleMarkers(markerIds);
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
