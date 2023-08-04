export const selectBlankState = state => state.Blank;
export const selectBlankStatusLoad = state => selectBlankState(state).statusLoad;
export const selectBlankStatusSend = state => selectBlankState(state).statusSend;
export const selectBlank = state => selectBlankState(state).value;
export const selectBlankIsLoaded = state => selectBlankState(state).value !== null;
