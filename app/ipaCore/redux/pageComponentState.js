import {createSelector, createSlice} from '@reduxjs/toolkit'


export const STATE_KEY = 'pageComponentState';

const initialState = {
    clickEvent: undefined
}

const pageComponentSlice = createSlice({
    name: STATE_KEY,
    initialState,
    reducers: {
        setClickEvent: (state, action) => {
            state.clickEvent = action?.payload
        }
    }
})



export const { setClickEvent } = pageComponentSlice.actions
export default pageComponentSlice.reducer

export const getSlice = (rootState) => rootState[STATE_KEY];

export const getClickEvent = createSelector(
    getSlice,
    (slice) => slice.clickEvent
)
