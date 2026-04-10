export const initialDataState = {
  cos: [],
  cts: [],
  dls: [],
  users: [],
  currency: "USD",
  stages: [],
};

export function crmReducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return { ...state, ...action.payload };
    case "SET_COS":
      return {
        ...state,
        cos: typeof action.payload === "function" ? action.payload(state.cos) : action.payload,
      };
    case "SET_CTS":
      return {
        ...state,
        cts: typeof action.payload === "function" ? action.payload(state.cts) : action.payload,
      };
    case "SET_DLS":
      return {
        ...state,
        dls: typeof action.payload === "function" ? action.payload(state.dls) : action.payload,
      };
    case "SET_USERS":
      return {
        ...state,
        users: typeof action.payload === "function" ? action.payload(state.users) : action.payload,
      };
    case "SET_CURRENCY":
      return { ...state, currency: action.payload };
    case "SET_STAGES":
      return { ...state, stages: action.payload };
    default:
      return state;
  }
}
