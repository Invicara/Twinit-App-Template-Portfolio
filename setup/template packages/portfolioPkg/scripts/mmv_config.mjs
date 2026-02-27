function randomGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

/** Safely read a dot-path from an object. */
function get(obj, path, defaultValue = "") {
    if (!obj || !path) return defaultValue;
    return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj) ?? defaultValue;
}


function countsForSiteBuildings(map, feature, config) {
     const { bins, property } = config;
    const counts = new Array(bins.length).fill(0);
    const buildings = feature.properties?.buildings || [];

    for (const b of buildings) {
        const val = String(b?.[property] ?? 'unknown');

        for (let i = 0; i < bins.length; i++) {
            const bin = bins[i];

            const hasRange = bin.min != null || bin.max != null;

            if (hasRange) {
                // numeric / capacity-style
                const minOk = bin.min == null || val >= bin.min;
                const maxOk = bin.max == null || val <  bin.max;
                if (minOk && maxOk) {
                    counts[i] += 1;
                    break;
                }
            } else {
                // categorical / type-style
                if (
                    String(bin.id) === val ||
                    bin.id === val ||
                    (bin.value !== undefined && bin.value === val) ||
                    bin.label === val // optional convenience
                ) {
                    counts[i] += 1;
                    break;
                }
            }
        }
    }

    return counts;
}

const statusConfig = {
    colorMap: {
        "1": "#d3d3d3",// Planned
        "2": "#f4b740", // Construction
        "3": "#66bb6a", // Operating
        "4": "#e53935", // Suspended
        "5": "#6B7280", // Permanent Shutdown (gray-ish)
        "unknown": "#CCCCCC",
    },
    labelMap: {
        "1": "Planned",
        "2": "Construction",
        "3": "Operating",
        "4": "Suspended Operation",
        "5": "Permanent Shutdown",
        "unknown": "Other",
    },
}


const THEMES = {
    BY_TYPE: {
        property: "Type",//this is used to as a property to match agains the bin (unless getCounts is overwritten)
        bins: [
            { id: "typeA", color: "#8ecbff", label: "Type A" },
            { id: "typeB", color: "#1DC0F7", label: "Type B" },
            { id: "typeC", color: "#0072BC", label: "Type C" },
            { id: "typeD", color: "#1D1D1D", label: "Type D" }
        ],
        "circle-radius": 7
    },
       BY_STATUS: {
        property: "StatusId",
        bins: [
            { id: "1", color: "#d3d3d3", label: "Planned" },
            { id: "2", color: "#f4b740", label: "Construction" },
            { id: "3", color: "#66bb6a", label: "Operating" },
            { id: "4", color: "#e53935", label: "Suspended Operation"},
            { id: "5", color: "#6B7280", label: "Permanent Shutdown" },
            { id: "unknown", color: "#CCCCCC", label: "Other" }
        ],
        "circle-radius": 7
    },
}



let scriptModule = {
    async getGISConfig(input, libraries, ctx, callback) {
        return {
            style: 'mapbox://styles/mapbox/standard',
            //style: 'mapbox://styles/mapbox/light-v10',
            mapOptions: {
                config: {
                    basemap: {
                        theme: "custom",
                        "theme-data": "data:image/png;base64,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"
                    }
                },
            },
            mapControlsConfig: [{
                type: "navigation",
                position: "bottom-right"
            }, {
                type: "2d3d",
                position: "bottom-right",
                options: {
                    position: 'bottom-right',
                    pitch: 70,
                    bearing: -20,
                    minpitchzoom: 11
                }
            }],
            // Layer information for event handling
            layerInfo: {
                'site-features-layer': {
                    idField: 'siteId',
                    elementType: '2d_site',
                    extraAttributes: ['name'],
                    fromMapboxID: (id, attrs) => id,
                    toMapboxID: (id) => id
                },
                'building-features-layer': {
                    idField: 'buildingId',
                    elementType: 'building_represetation',
                    extraAttributes: ["latitude", "longitude"],
                    fromMapboxID: (id, attrs) => id,
                    toMapboxID: (id) => id
                }
            },
            initialCameraPosition: {
                position: [-8, 53.4],
                zoom: 5,
                rotation: {
                    pitch: 0,
                    yaw: 0
                }
            },
        }
    },
    async getEntryActionTheme(input) {
        const {stateValue, suppressEntryActions} = input;

        if (suppressEntryActions) {
            return { suppressEntryActions: false };
        }

        switch (stateValue) {
            case 'portfolio': {

                const legend = THEMES.BY_STATUS;

                const theme = {
                    ////we will kepp site invisible by default and only show marker instead
                    /*
                    "building-features-layer": THEMES.BY_CAPACITY,
                    */
                    //we will kepp site invisible by default and only show marker instead
                    /*"site-features-layer": {
                        property: "buildings_count",
                        bins: [
                            { id: "few",   min: 0,   max: 5,  color: "#8ecbff", label: "1–4 buildings" },
                            { id: "mid",   min: 5,   max: 10, color: "#3aa7ff", label: "5–9 buildings" },
                            { id: "large", min: 10,  max: 20, color: "#7fb2c8", label: "10–19 buildings" },
                            { id: "mega",  min: 20,  max: null, color: "#2b2b2b", label: "20+" }
                        ]
                    }*/
                }


                const singleMarkers = [{
                    featureDef: {
                        //this is used to generate graphic ID
                        path: "site",
                        idKey: "siteId"
                    },
                    sourceId: "site-features-centroids",
                    getCounts: countsForSiteBuildings,//this will overwrite the default bin assignment to feature
                    config: THEMES.BY_STATUS,
                    "popupConfig": {
                        "statusPopup": {
                            titleProp: "properties.name",
                            descriptionProp: "properties.region",
                            statusProp: (feature, ctx) => {
                                // feature.properties.buildings is an array of building features or plain objects
                                const buildings = get(feature, "properties.buildings", []) || [];
                                // Extract each building's StatusId (stringify for map keys)
                                const ids = buildings
                                    .map(b => String(get(b, "StatusId", "unknown")))
                                    .filter(Boolean);

                                if (!ids.length) return "unknown";

                                const mode = ctx.aggregation?.mode ?? "priority";
                                const order = ctx.aggregation?.priorityOrder ?? ["4","2","1","3","5"];

                                if (mode === "multi") {
                                    // return counts for multi-status rendering
                                    const counts = ids.reduce((acc, id) => {
                                        acc[id] = (acc[id] || 0) + 1;
                                        return acc;
                                    }, {});
                                    return { mode: "multi", counts };
                                }

                                // "mostActive": if at least one OP (4) → 4, else if at least one UC (2) → 2, else fallback...
                                // "priority": walk the order and pick the first present
                                for (const id of order) {
                                    if (ids.includes(id)) return id;
                                }
                                // if we got here, pick the first concrete id or 'unknown'
                                return ids[0] ?? "unknown";
                            },
                            statusAggregation: {
                                //mode: "priority",
                                mode: "multi",                  // "mostActive" | "priority" | "multi"
                                priorityOrder: ["3","2","1","4","5"]
                            },
                            statusConfig: statusConfig,
                            maxWidth: 280,
                        }
                    }
                }]


                return { commands: null, theme, singleMarkers, legend };
            }
            case 'portfolio.site': {

                const legend = THEMES.BY_STATUS;

                const theme = {
                    //theme building features by Type property
                    "building-features-layer": THEMES.BY_TYPE,
                }
                const singleMarkers = [{
                    featureDef: {
                        path: "building",
                        idKey: "buildingId"
                    },
                    sourceId: "building-features" ,
                    config: theme["building-features-layer"],
                    showLabel: false,
                    pieAlpha: 0.3,
                    "popupConfig": {
                        statusPopup: {
                            titleProp: "properties.name",
                            descriptionProp: "properties.region",
                            statusProp: "properties.StatusId",
                            statusConfig: statusConfig,
                            maxWidth: 280,
                        }
                    }
                }]


                return { commands: null, theme, singleMarkers, legend };
            }
            case 'portfolio.site.building': {
                const legend = THEMES.BY_STATUS;
                return {legend}
            }


            default:
                return {};
        }
    },

    async afterLayerSetupCommands(input){

        const {groupedFeatures} = input;
        const commandRef = randomGuid();

        const commands  = [
            {
                "commandName": "custom",
                commandRef,
                "params": {
                    commandName: "passlayerdefaults",
                    commandRef,
                    params: {
                        "site-features-layer": {
                            defaults: [
                                { property: "fill-color", value: "#DF158C" },
                            ]
                        }
                    }
                }
            }
        ]

        return commands;
    },
    filterRuleFns(input) {
          return {
            statusIn:
            ({ values }) =>
            (building) => {
                if (building.StatusId == null) return false;
                return values.map(String).includes(String(building.StatusId));
            },
            searchQuery: ({ q }) => (e) => {
                if (!q) return true;

                const entity = e.properties || e;
                const query = q.toLowerCase();

                // List the fields you want to check
                const fields = [
                    entity?.name,
                    entity?.siteId,
                    entity?.buildingId
                ];

                return fields.filter(f=>!!f).some(field => field?.toLowerCase().includes(query));
            },
        };
    },
}

export default scriptModule