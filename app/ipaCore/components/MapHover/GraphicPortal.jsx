// import React, { memo, useCallback, useEffect, useMemo } from 'react'
// import { useDispatch, useSelector } from 'react-redux'
// import { createPortal } from 'react-dom'
// import { mapPortals } from '@invicara/ipa-core-ct'
// import { getIsDomCreated } from '../../redux/mapFiltersDTX'
// import { isInitiated } from '../../pageComponents/customGIS'

// const MMV_GRAPHIC_NODE_CLASS = 'graphic-html'
// const {updateManyPortals} = mapPortals;


// const GraphicPortal = ({targetSelector = "div.esri-view"}) => {


// 	const initialized = isInitiated;
// 	const isDomCreated = useSelector(getIsDomCreated);
// 	const fullState = useSelector((state) => state?.mapPortals?.entities);

// 	const dispatch = useDispatch()

// 	useEffect(() => {

// 		if(!initialized || !isDomCreated){
// 			return;
// 		}
// 		const target = document.querySelector(targetSelector);
// 		if (!target) {
// 			console.warn("MutationObserver target not found:", targetSelector);
// 			return;
// 		  }

// 		const observer = new MutationObserver((mutations) => {
// 			mutations?.forEach(function (mutation) {
// 				const elementsAdded = Array.from(mutation.addedNodes)
// 					.filter((element) => {
// 						if (
// 							element.classList &&
// 							element.classList.contains(MMV_GRAPHIC_NODE_CLASS)
// 						) {
// 							return element.id
// 						} else {
// 							return false
// 						}
// 					})
// 					.map((element) => element.id)

// 				const elementsRemoved = Array.from(mutation.removedNodes)
// 					.filter((element) => {
// 						if (
// 							element.classList &&
// 							element.classList.contains(MMV_GRAPHIC_NODE_CLASS)
// 						) {
// 							return element.id
// 						} else {
// 							return false
// 						}
// 					})
// 					.map((element) => element.id)

// 				if (elementsAdded && elementsAdded.length > 0) {
// 					console.log(
// 						'The portal was added to the DOM',
// 						elementsAdded
// 					)
// 					dispatch(
// 						updateManyPortals(
// 							elementsAdded.map((id) => ({
// 								id: id,
// 								changes: {
// 									inDOM: true
// 								}
// 							}))
// 						)
// 					)
// 				}

// 				if (elementsRemoved && elementsRemoved.length > 0) {
// 					console.log(
// 						'The portal was removed from the DOM',
// 						elementsRemoved
// 					)
// 					dispatch(
// 						updateManyPortals(
// 							elementsRemoved.map((id) => ({
// 								id: id,
// 								changes: {
// 									inDOM: false
// 								}
// 							}))
// 						)
// 					)
// 				}
// 			})
// 		})

// 		observer?.observe(target, {
// 			attributes: false,
// 			childList: true,
// 			characterData: false,
// 			subtree: false
// 		})

// 		return () => {
// 			if (observer) {
// 				observer.disconnect()
// 			}
// 		}
// 	}, [initialized, isDomCreated])

// 	const createGraphicPortal = useCallback((portal) => {
// 		const portalContainer = document.getElementById(portal.id)
//     	if (portalContainer && portal.component) {
// 			return createPortal(portal.component, portalContainer, portal.id)
// 		}

// 		return null
// 	}, [])


// 	const portalsToRender = useMemo(() => {
//         const portals  =  Object.values(fullState)
//         return initialized && isDomCreated && portals ? portals : null;

// 	}, [fullState, initialized, isDomCreated])

// 	return (
// 		<div>
// 			{portalsToRender?.map((portal) => createGraphicPortal(portal))}
// 		</div>
// 	)
// }

// export default memo(GraphicPortal)
