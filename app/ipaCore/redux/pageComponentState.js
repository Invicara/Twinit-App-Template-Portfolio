import {createSelector, createSlice} from '@reduxjs/toolkit'


export const STATE_KEY = 'pageComponentState';

const initialState = {
    clickEvent: undefined,
    mapTypes: {},
    structures: {},
    mapGraphicReferences: [],
    selectedGraphicReference: undefined,
    selectedStructure: undefined
}

const pageComponentSlice = createSlice({
    name: STATE_KEY,
    initialState,
    reducers: {
        setClickEvent: (state, action) => {
            state.clickEvent = action?.payload
        },
        setMapTypes: (state, action) => {
            state.mapTypes = action?.payload
        },
        setStructures: (state, action) => {
            state.structures = action?.payload
        },
        setMapGraphicReferences: (state, action) => {
            state.mapGraphicReferences = action?.payload
        },
        setSelectedGraphicReference: (state, action) => {
            state.selectedGraphicReference = action?.payload
        },
        setSelectedStructure: (state, action) => {
            state.selectedStructure = action?.payload
        }
    }
})



export const { setClickEvent, setMapTypes, setStructures, setMapGraphicReferences, setSelectedStructure, setSelectedGraphicReference } = pageComponentSlice.actions
export default pageComponentSlice.reducer

export const getSlice = (rootState) => rootState[STATE_KEY];

export const getClickEvent = createSelector(
    getSlice,
    (slice) => slice.clickEvent
)

export const getMapTypes = createSelector(
    getSlice,
    (slice) => slice.mapTypes
)

export const getStructures = createSelector(
    getSlice,
    (slice) => slice.structures
)

export const getMapGraphicReferences = createSelector(
    getSlice,
    (slice) => slice.mapGraphicReferences
)

export const getSelectedGraphicReference = createSelector(
    getSlice,
    (slice) => slice.selectedGraphicReference
)

export const getSelectedStructure = createSelector(
    getSlice,
    (slice) => slice.selectedStructure
)