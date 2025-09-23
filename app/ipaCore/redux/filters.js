import { createSlice } from '@reduxjs/toolkit'

export const FILTERS_KEY = 'filters'

const initialState = {
}

const filtersSlice = createSlice({
  name: FILTERS_KEY,
  initialState,
  reducers: {
    setFilter: (state, action) => {
      //console.log("filtersSlice", state, action.payload)
      return action.payload
    },
    clearFilter: () => initialState
  }
})

export const {
  setFilter,
  clearFilter
} = filtersSlice.actions

export default filtersSlice.reducer

export const getSlice = rootState => rootState[FILTERS_KEY] ?? initialState

export const getFilter = rootState => getSlice(rootState)


