import { createSlice } from '@reduxjs/toolkit'

export const FILTERS_KEY = 'filters'

const initialState = {
  site: null,
  building: null,
  status: null
}

const filtersSlice = createSlice({
  name: FILTERS_KEY,
  initialState,
  reducers: {
    setSiteFilter: (state, action) => {
      state.site = action.payload
    },
    setBuildingFilter: (state, action) => {
      state.building = action.payload
    },
    setStatusFilter: (state, action) => {
      state.status = action.payload
    },
    clearFilters: () => initialState
  }
})

export const {
  setSiteFilter,
  setBuildingFilter,
  setStatusFilter,
  clearFilters
} = filtersSlice.actions

export default filtersSlice.reducer

export const getSlice = rootState => rootState[FILTERS_KEY] ?? initialState

export const getSiteFilter = rootState => getSlice(rootState)?.site
export const getBuildingFilter = rootState => getSlice(rootState)?.building
export const getStatusFilter = rootState => getSlice(rootState)?.status
