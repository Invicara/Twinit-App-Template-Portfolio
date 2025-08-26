// import React, { useEffect, useState } from 'react';
// //import {Buildings, FormatSquare, Home, LocationAdd} from "iconsax-react";
// import { useSelector } from "react-redux";
// import InfoInteractiveClosableCard from "./InfoInteractiveClosableCard";
// import { BUILDING, CLUSTER, selectClusterName } from "../../redux/mapFiltersDTX";
// import { MetricsLongInfo } from "./info/MetricsLongInfo";
// import { buildingEntitySelectors } from "../../redux/buildingEntities";
// import { clusterEntitySelectors } from "../../redux/clusterEntities";

// function HoverInfo({ payload, syncWithHits }) {
//     const [building, setBuilding] = useState(undefined);
//     const [cluster, setCluster] = useState(undefined)

//     const clusters = useSelector(clusterEntitySelectors.selectEntities);
//     const buildings = useSelector(buildingEntitySelectors.selectEntities);
//     const hits = payload
//     const clusterName = useSelector(selectClusterName);


//     //decide if building or plot is hovered
//     useEffect(() => {
//         if (!syncWithHits) {
//             return;
//         }
//         //check if plot I am interested in is hovered over
//         const __buildingName = hits?.elements?.find(el => el.elementType == BUILDING)?.id;
//         const __clusterName = hits?.elements?.find(el => el.elementType == CLUSTER)?.id;
        
//         if(__clusterName) {
//             const cluster = clusters[__clusterName];
//             setCluster(cluster);
//             setBuilding(undefined);
//         }
//         if(__buildingName) {
//             const building = buildings[__buildingName];
//             setBuilding(building);
//         }
//     }, [hits]);

//     const positionStyle = syncWithHits ? { position: "fixed", left: (hits?.screen?.x || 0) + 16, top: (hits?.screen?.y || 0) + 8 } : {};

//     // if (plotLoading == "loading" || buildingLoading == "loading" || clusterLoading == "loading" || zoneLoading == "loading") {
//     //     console.log("FabricHoverInfo loading", plotLoading, buildingLoading, clusterLoading, zoneLoading);
//     //     return <Box style={{ display: 'flex', ...positionStyle }}>
//     //         <CircularProgress />
//     //     </Box>
//     // }
//     if (clusterName && building && Object.keys(building).length !== 0) {
//         return <div style={{ position: "fixed", ...positionStyle }}>
//             <InfoInteractiveClosableCard
//                 title={`Building ${building.building_id} - ${building.properties?.cluster_id_1?.val || ""}`}
//                 subheader={null}
//                 mediaComponent={null}
//                 contentComponent={<MetricsLongInfo entity={building} entityType={BUILDING} buildingLoading></MetricsLongInfo>}
//                 expandedContentComponent={null}
//                 onClose={false} /></div>

//     } 
//     else if (cluster) {
//         return <div style={{ position: "fixed", ...positionStyle }}>
//             <InfoInteractiveClosableCard
//                 title={`Cluster ${cluster?.descripton} ${cluster?.cluster_id}`}
//                 subheader={null}
//                 mediaComponent={null}
//                 contentComponent={<MetricsLongInfo entity={cluster} entityType={CLUSTER} clusterLoading></MetricsLongInfo>}
//                 expandedContentComponent={null}
//                 onClose={false} /></div>
//     }

//     return <div style={{ position: "fixed", ...positionStyle }}>
//         <InfoInteractiveClosableCard
//             title={`Hover area is neither cluster nor building`} /></div>;
// }

// export default HoverInfo;
