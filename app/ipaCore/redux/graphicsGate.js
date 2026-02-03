import { createSlice } from '@reduxjs/toolkit';

export const GRAPHICS_GATE_KEY = 'graphicsGate';

const initialState = {
  byState: {}
};

const graphicsGateSlice = createSlice({
  name: GRAPHICS_GATE_KEY,
  initialState,
  reducers: {
    setGraphicsGateLoading: (state, action) => {
        const { stateValue } = action.payload;

        state.byState[stateValue] = {
            ready: false,
            loading: true
        };
    },
    setGraphicsGateReady: (state, action) => {
        const { stateValue } = action.payload;

        state.byState[stateValue] = {
            ...(state.byState[stateValue] || {}),
            ready: true,
            loading: false
        };
    },
    clearGraphicsGate: (state, action) => {
      const { stateValue } = action.payload || {};
      if (!stateValue) {
        state.byState = {};
        return;
      }
      delete state.byState[stateValue];
    }
  }
});

export const { setGraphicsGateLoading, setGraphicsGateReady, clearGraphicsGate } =
  graphicsGateSlice.actions;

export default graphicsGateSlice.reducer;

export const getSlice = (rootState) => rootState[GRAPHICS_GATE_KEY] ?? initialState;

export const getGraphicsGate = (rootState, stateValue) =>
  getSlice(rootState)?.byState?.[stateValue] ?? { loading: false, ready: false, token: 0 };
