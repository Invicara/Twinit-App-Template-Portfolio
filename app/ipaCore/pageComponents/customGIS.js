
// import Graphic from "@arcgis/core/Graphic";
// import _ from "lodash";
// import Polygon from '@arcgis/core/geometry/Polygon';
// import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
// import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

// export const graphics = {
//     bimAssetGraphics: [],
//     gltfGraphics: [],
//     sketches: {}
// }
// let scene, sceneView, centerX, centerY
// export let _userAddedGraphicsDom = {}
// export let isInitiated = false;

// /**
//  * Setting the Scene for this file to work
//  * Calling it after VIEWER_READY
//  * setScene(ev.payload)
//  */
// export const setScene = (payload, setExtraGISInitialized) => {
//     scene = payload?.scene
//     sceneView = payload?.sceneView
//     sceneView && initExtraGIS(setExtraGISInitialized)
//     isInitiated = true
// }

// export function setupZoneLayer(zones){
//     const graphics = zones.map(({rings, attributes}) => {
//         var polygon = new Polygon({
//             rings: rings.map(l => l.map(c => +c)),
//             spatialReference: sceneView.spatialReference
//         });

//         var graphic = new Graphic({
//             geometry: polygon,
//             attributes
//         });

//         return graphic;
//     });

//     const allFields = [...new Set(graphics.map(g => Object.keys(g.attributes)).flat())];

//     const fields = allFields.map(k => {
//         const foundValue = graphics.find(g => g.attributes[k])?.attributes[k]
//         return {name: k, alias: k === "objectid" ? "Object ID" : k, type: k === "objectid" ? "oid" : typeof foundValue}
//     })

//     console.log("airportZones fields", fields)

//     const foundLayer = sceneView.map.allLayers.find(function(layer) {
//         return layer.title === "airportZones";
//     });

//     foundLayer && sceneView.map.remove(foundLayer);

//     let featureLayer = new FeatureLayer({
//         title: "airportZones",
//         source: graphics,
//         fields,
//         objectIdField: "objectid",
//         geometryType: "polygon",
//         spatialReference: sceneView.spatialReference,
//     });
//     sceneView.map.add(featureLayer);
// }

// export const getScene = () => ({sceneView, scene})

// /**
//  * INTERNAL: Extra GIS functionalities
//  */
// const initExtraGIS = (setExtraGISInitialized) => {
//     sceneView.when(() => {
//         reactiveUtils.watch(
//             () => sceneView?.viewpoint,
//             () => {
//                 // Retrieve the center of the screen
//                 // var centerScreen = sceneView?.toMap(sceneView.center, sceneView.center);

//                 // Now you have the latitude and longitude of the center point
//                 centerX = sceneView?.center?.x;
//                 centerY = sceneView?.center?.y + 150;

//                 // You can then use these latitude and longitude values as needed
//             }
//         );

//         reactiveUtils.watch(
//             () => sceneView ? [sceneView.scale, sceneView.zoom, sceneView.center] : null,
//             (value) => {
//                 if (value) {
//                     refreshDomGraphic();
//                 }
//             }
//         );

//         console.log("GISAsset initialized.");
//         setExtraGISInitialized && setExtraGISInitialized(true)
//     }).catch(error => {
//         console.error("Error initializing SceneView:", error);
//     });
// }

// const refreshDomGraphic = () => {
//     for (const [key, value] of Object.entries(_userAddedGraphicsDom)) {
//         const convertedPoint = sceneView.toScreen({
//             x: value.associatedGraphic.point.x,
//             y: value.associatedGraphic.point.y,
//             z: value.associatedGraphic.point.z,
//             spatialReference: {
//                 wkid: sceneView.camera.position.spatialReference.wkid
//             }
//         })

//         const { totalHeight = 3000, distanceCorrection = 0.5 } = {}
//         const squareDifX = Math.pow(Math.abs(sceneView.camera.position.x - value.associatedGraphic.point.x), 2);
//         const squareDifY = Math.pow(Math.abs(sceneView.camera.position.y - value.associatedGraphic.point.y), 2);

//         const terrainDistance = Math.sqrt(squareDifX + squareDifY);

//         convertedPoint.y -= (((150 / (totalHeight + (terrainDistance * distanceCorrection))) * sceneView.canvas.height) * (sceneView.camera.tilt / 180))
//         value.domElement.setAttribute("style", `top: ${convertedPoint.y}px; left: ${convertedPoint.x}px; position: absolute`)
//     }

// }

// export const removeUserGraphics = () => {
//     if(!_.isEmpty(_userAddedGraphicsDom)) {
//         const currentDiv = document.getElementsByClassName("esri-view-root");
//         if(!currentDiv || !currentDiv[0]){
//             _userAddedGraphicsDom = {}
//             return;
//         }
//         for (const [key, value] of Object.entries(_userAddedGraphicsDom)) {
//             try {
//                 currentDiv[0]?.parentNode?.removeChild(value.domElement)
//             } catch (e){
//                 console.error(e);
//             }
//         }
//         _userAddedGraphicsDom = {}
//     }
// }

// export const removeUserGraphicsByIds = (ids = []) => {
//     console.log("removeUserGraphicsByIds", {ids, _userAddedGraphicsDom})
//     if(!_.isEmpty(_userAddedGraphicsDom)) {
//         const currentDiv = document.getElementsByClassName("esri-view-root");
//         if(!currentDiv || !currentDiv[0]){
//             _userAddedGraphicsDom = {}
//             return;
//         }
//         for (const [id, value] of Object.entries(_userAddedGraphicsDom)) {
//             if(!ids.includes(id)){
//                 continue;
//             }
//             try {
//                 currentDiv[0]?.parentNode?.removeChild(value.domElement);
//                 delete _userAddedGraphicsDom[id]
//             } catch (e){
//                 console.error(e);
//             }
//         }
//     }
//     console.log("removeUserGraphicsByIds after", {ids, _userAddedGraphicsDom})
// }
// /**
//  *
//  * Add a GLTF as a graphic
//  *
//  * @param {string} url: The URL of the object
//  * @param {number} x: X coordinate of the object
//  * @param {number} y: Y coordinate of the object
//  * @param {number} z: Z coordinate of the object
//  * @param {number=} depth: (Optional) diameter of the object from north to south in meters
//  * @param {number=} height: (Optional) height of the object in meters
//  * @param {number=} heading: (Optional) clockwise rotation of the symbol in the horizontal plane
//  * @param {number=} width: (Optional) diameter of the object from east to west in meters
//  * @param {number=} roll: (Optional) The rotation of the symbol in the lateral vertical plane (i.e., around the y axis)
//  * @param {number=} tilt: (Optional) The rotation of the symbol in the longitudinal vertical plane (i.e., around the x axis)
//  *
//  */
// export const addHTMLGraphic = (commands, styles, options) => {
//     for(let command of commands) {
//         for (let htmlDef of command.params.graphics) {
//             let div
//             if (_userAddedGraphicsDom[htmlDef.id]) {
//                 // Graphic already exist
//                 div = _userAddedGraphicsDom[htmlDef.id].domElement
//             } else {
//                 // Create a new HTML Graphic
//                 div = document.createElement("div");
//                 div.id = htmlDef.id
//                 div.className = "graphic-html"

//                 const currentDiv = document.getElementsByClassName("esri-view-root");
//                 currentDiv[0]?.parentNode?.insertBefore(div, currentDiv[0])
//             }

//             div.innerHTML = htmlDef.html
//             // console.log('sceneview-->', sceneView.spatialReference.wkid);
//             const translatedPoint = {
//                 x: htmlDef.point.x,
//                 y: htmlDef.point.y,
//                 z: htmlDef.point.z,
//                 spatialReference: {wkid: sceneView?.spatialReference?.wkid}
//             }

//             //if (htmlDef.centered) {
//             //     translatedPoint.x -= (div.offsetWidth / 2)
//             //     translatedPoint.y -= (div.offsetHeight / 2)
//             //}
//             if (sceneView?.camera) {
//                 const convertedPoint = sceneView.toScreen(translatedPoint)
//                 const {totalHeight = 3000, distanceCorrection = 0.5} = htmlDef.correctors || {}
//                 const squareDifX = Math.pow(Math.abs(sceneView?.camera?.position?.x - htmlDef?.point?.x), 2);
//                 const squareDifY = Math.pow(Math.abs(sceneView?.camera?.position?.y - htmlDef.point.y), 2);

//                 const terrainDistance = Math.sqrt(squareDifX + squareDifY);

//                 convertedPoint.y -= (((150 / (totalHeight + (terrainDistance * distanceCorrection)))
//                 * sceneView?.canvas?.height) * (sceneView?.camera?.tilt / 180))
//                 div.setAttribute("style",
//                     `top: ${convertedPoint.y}px; 
//                     left: ${convertedPoint.x}px; 
//                     position: ${styles?.position || 'absolute'}`)
//                     _userAddedGraphicsDom[htmlDef.id] = {
//                     domElement: div,
//                     associatedGraphic: htmlDef
//                 }
//             }
//         }
//     }
// }

// let eventattached = false;
// let assetHover = false;
// export const updateMousePointer = (ev) => {
//     if(!eventattached) {
//         var ele = document.getElementsByClassName("esri-view-root")[0];
//         ele.addEventListener('mouseup', (event) => {
//             if(assetHover === false)
//                 event.currentTarget.style.cursor = 'unset';
//         });
//         ele.addEventListener('mousedown', (event) => {
//             if(assetHover === false)
//                 event.currentTarget.style.cursor = 'move';
//         });
//         eventattached = true;
//     }
//     if(assetHover && (!Array.isArray(ev.payload.elements) || (Array.isArray(ev.payload.elements) && ev.payload.elements.length == 1))) {
//         var ele = document.getElementsByClassName("esri-view-root")[0];
//         ele.style.cursor = 'unset';
//         assetHover = false;
//     }
//     if(Array.isArray(ev.payload.elements) && ev.payload.elements.length > 1) {
//         var ele = document.getElementsByClassName("esri-view-root")[0];
//         ele.style.cursor = 'pointer';
//         assetHover = true;
//     }
// }


// /**
//  *
//  * Tilt the camera.
//  *
//  * @param {number} tilt: tilt angle value
//  *
//  */
// export const tiltCamera = async (tilt = 40) => {
//     if (!sceneView) return;
//     await sceneView.goTo({tilt});
// }

// /**
//  * Change visibility of Graphics
//  */
// export const filterGraphics = (gisAssetLocations, selectedStructure, selectedZone) => {
//     let toHide = gisAssetLocations.map(e => e._id)
//     let toShow = gisAssetLocations.map(e => e._id)

//     if (selectedStructure) {
//         // Hide all assets except one
//         toShow = selectedStructure
//         toHide = toHide.filter(e => e != selectedStructure)
//     } else if (selectedZone) {
//         // Hide all assets expect many
//         toShow = gisAssetLocations.filter(e => e.zone_id === selectedZone).map(el => el._id);
//         toHide = gisAssetLocations.filter(e => e.zone_id !== selectedZone).map(el => el._id);
//     } else {
//         // Show all assets
//         toHide = []
//     }

//     sceneView?.graphics?.items.map(e => {
//         if (toShow.includes(e.attributes.uagId)) e.visible = true
//         if (toHide.includes(e.attributes.uagId)) e.visible = false
//     })
// }

