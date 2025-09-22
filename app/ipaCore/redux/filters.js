import { createSlice } from '@reduxjs/toolkit'
import {IafScriptEngine} from "@dtplatform/iaf-script-engine";

export const FILTERS_KEY = 'filters'

const initialState = {
}

const filtersSlice = createSlice({
  name: FILTERS_KEY,
  initialState,
  reducers: {
    setFilter: (state, action) => action.payload,
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


export class FilterCompiler {
  constructor(fns) {
    this.fns = fns
  }
  compileFilter(node) {
    if (!this.fns) {
      return true;
    }
    if ("fn" in node) {
      const factory = (this.fns)[node.fn];
      if (!factory) throw new Error(`Unknown filter fn: ${node.fn}`);
      return factory(node.args ?? {});
    }
    if (node.op === "not") {
      const inner = this.compileFilter(node.rule);
      return x => !inner(x);
    }
    if (node.op === "and") {
      const parts = node.rules.map(r => this.compileFilter(r));
      return x => parts.every(p => p(x));
    }
    if (node.op === "or") {
      const parts = node.rules.map(r => this.compileFilter(r));
      return x => parts.some(p => p(x));
    }
    // Exhaustiveness
    throw new Error("Invalid filter node");
  }
}


