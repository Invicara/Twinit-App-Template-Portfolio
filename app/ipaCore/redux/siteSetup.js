import {
	createEntityAdapter,
	createSelector,
	createSlice
} from '@reduxjs/toolkit'

export const SETUP_SITE_KEY = "setupSite"

// type Graph = { id: string, title: string, timestamp: Date }
export const adapter = createEntityAdapter({
    // compound key
    selectId: (row) => row?._id || row
    // Keep the "all IDs" array sorted based on timestamp
    // sortComparer: (a, b) => {return a.timestamp - b.timestamp}
})

export const initialState = adapter.getInitialState({
    draftSite: undefined,
    isSelectingPosition: false,
    selectedCoordinate: undefined,
    siteCoordinates: []
})

export const slice = createSlice({
    name: SETUP_SITE_KEY,
    initialState: initialState,
    reducers: {
        setDraftSite: (state, action) => {
            state.draftSite = action.payload
        },
        setIsSelectingPosition: (state, action) => {
            state.isSelectingPosition = action.payload
        },
        setSelectedCoordinate: (state, action) => {
            state.selectedCoordinate = action.payload
        },
        setSiteCoordinates: (state, action) => {
            state.siteCoordinates = action.payload
        },
        addSiteCoordinate: (state, action) => {
            state.siteCoordinates.push(action.payload)
        },
        removeSiteCoordinate: (state, action) => {
            state.siteCoordinates = state.siteCoordinates.filter((_, index) => index !== action.payload)
        }
    },
})
/*
 * Export reducer for store configuration.
 */
export const reducer = slice.reducer
export default reducer

export const siteSetupActions = slice.actions
export const { 
    setDraftSite, 
    setIsSelectingPosition, 
    setSelectedCoordinate, 
    setSiteCoordinates, 
    addSiteCoordinate, 
    removeSiteCoordinate 
} = siteSetupActions

const getSlice = (rootState) => rootState[SETUP_SITE_KEY];

const getSliceByProp = prop => createSelector(getSlice,
    (slice) => slice[prop]
);

export const selectDraftSite = getSliceByProp("draftSite")
export const selectIsSelectingPosition = getSliceByProp("isSelectingPosition")
export const selectSelectedCoordinate = getSliceByProp("selectedCoordinate")
export const selectSiteCoordinates = getSliceByProp("siteCoordinates")

// more info on custom selectors:
// https://redux.js.org/usage/deriving-data-selectors

