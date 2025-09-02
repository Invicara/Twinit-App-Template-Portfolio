import {createSelector, createSlice} from '@reduxjs/toolkit'


export const STATE_KEY = 'pageComponentState';

const initialState = {
    clickEvent: undefined,
    mapTypes: {}
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
        }
    }
})



export const { setClickEvent, setMapTypes } = pageComponentSlice.actions
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
