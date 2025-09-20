import {createSelector, createSlice} from '@reduxjs/toolkit'


export const STATE_KEY = 'pageComponentState';

const initialState = {
    clickEvent: undefined,
    mapTypes: {},
    mapGraphicReferences: [],
    selectedGraphicReference: undefined
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
        setMapGraphicReferences: (state, action) => {
            state.mapGraphicReferences = action?.payload
        },
        setSelectedGraphicReference: (state, action) => {
            state.selectedGraphicReference = action?.payload
        }
    }
})



export const { setClickEvent, setMapTypes, setMapGraphicReferences, setSelectedGraphicReference } = pageComponentSlice.actions
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

export const getMapGraphicReferences = createSelector(
    getSlice,
    (slice) => slice.mapGraphicReferences
)

export const getSelectedGraphicReference = createSelector(
    getSlice,
    (slice) => slice.selectedGraphicReference
)
