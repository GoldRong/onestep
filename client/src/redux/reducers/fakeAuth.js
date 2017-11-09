import isEmpty from 'lodash/fp/isEmpty'

const initialState = {
  isAuthenticated: false,
  currentUser: {},
  showLogoutNotification: false,
  showLoginNotification: false,
  showSignupNotification: false,
  showUnhandledErrNotification: false,
  showInvalidTokenNotification: false
}

export default (state = initialState, action = {}) => {
  switch (action.type) {
    case 'AUTH_USER':
      return {
        isAuthenticated: !isEmpty(action.userInfo),
        currentUser: action.userInfo,
        showLoginNotification: true
      }
    case 'SIGN_UP':
      return {
        isAuthenticated: !isEmpty(action.userInfo),
        currentUser: action.userInfo,
        showSignupNotification: true
      }
    case 'LOG_OUT':
      return {
        isAuthenticated: false,
        currentUser: {},
        showLogoutNotification: true
      }
    case 'FAKE_WECHATCODE_LOGIN':
      return {
        isAuthenticated: !isEmpty(action.userInfo),
        currentUser: action.userInfo,
        showLoginNotification: true
      }
    case 'RM_LOGOUT_NOTIFICATION':
      return {
        ...state,
        showLogoutNotification: false
      }
    case 'RM_LOGIN_NOTIFICATION':
      return {
        ...state,
        showLoginNotification: false
      }
    case 'RM_SIGNUP_NOTIFICATION':
      return {
        ...state,
        showSignupNotification: false
      }
    case 'TOKEN_IS_VALID':
      return {
        ...state,
        isAuthenticated: action.success
      }
    case 'TOKEN_IS_INVALID':
      return {
        ...state,
        isAuthenticated: false,
        showInvalidTokenNotification: true
      }
    case 'RM_INVALID_TOKEN_NOTIFICATION':
      return {
        ...state,
        showInvalidTokenNotification: false
      }
    case 'UNHANDLED_ERROR':
      return {
        ...state,
        showUnhandledErrNotification: true
      }
    case 'RM_UNHANDLED_ERR_NOTIFICATION':
      return {
        ...state,
        showUnhandledErrNotification: false
      }
    default:
      return state
  }
}
