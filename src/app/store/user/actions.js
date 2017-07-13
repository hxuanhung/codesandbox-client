// @flow
import { signInUrl } from 'app/utils/url-generator';
import { identify } from 'app/utils/analytics';

import { createAPIActions, doRequest } from '../api/actions';
import notifActions from '../notifications/actions';

import openPopup from './utils/popup';
import { jwtSelector } from './selectors';

export const SIGN_IN = 'SIGN_IN';
export const SIGN_IN_SUCCESFULL = 'SIGN_IN_SUCCESFULL';
export const SET_CURRENT_USER = 'SET_CURRENT_USER';
export const SIGN_OUT = 'SIGN_OUT';
export const SET_USER_SANDBOXES = 'SET_USER_SANDBOXES';

export const GET_CURRENT_USER_API = createAPIActions('CURRENT_USER', 'FETCH');
export const UPDATE_CURRENT_USER_API = createAPIActions(
  'CURRENT_USER',
  'UPDATE',
);
export const LOAD_USER_SANDBOXES = createAPIActions(
  'CURRENT_USER',
  'FETCH_SANDBOXES',
);
export const SEND_FEEDBACK_API = createAPIActions('FEEDBACK', 'SEND');
export const GET_AUTH_TOKEN_API = createAPIActions('AUTH_TOKEN', 'FETCH');

export const CREATE_SUBSCRIPTION_API = createAPIActions(
  'SUBSCRIPTION',
  'CREATE',
);
export const UPDATE_SUBSCRIPTION_API = createAPIActions(
  'SUBSCRIPTION',
  'UPDATE',
);
export const CANCEL_SUBSCRIPTION_API = createAPIActions(
  'SUBSCRIPTION',
  'CANCEL',
);

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; Path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
};

const signOut = () => async (dispatch: Function) => {
  deleteCookie('jwt');

  dispatch({
    type: SIGN_OUT,
  });
};

const getCurrentUser = () => async (dispatch: Function, getState: Function) => {
  const jwt = jwtSelector(getState());
  if (jwt) {
    try {
      const { data } = await dispatch(
        doRequest(GET_CURRENT_USER_API, `users/current`),
      );

      identify(data);

      dispatch({ type: SET_CURRENT_USER, data });
      return data;
    } catch (e) {
      dispatch(signOut());
    }
  }
};

const signIn = () => (dispatch: Function) =>
  new Promise((resolve, reject) => {
    dispatch({
      type: SIGN_IN,
    });
    const popup = openPopup(signInUrl(), 'sign in');

    window.addEventListener('message', function(e) {
      if (e.data.type === 'signin') {
        const jwt = e.data.data.jwt;
        window.removeEventListener('message', this);
        popup.close();

        if (jwt) {
          dispatch({
            type: SIGN_IN_SUCCESFULL,
            jwt,
          });
          resolve(dispatch(getCurrentUser()));
        } else {
          reject();
        }
      }
    });
  });

const getAuthToken = () => async (dispatch: Function): string => {
  const { data } = await dispatch(
    doRequest(GET_AUTH_TOKEN_API, 'auth/auth-token'),
  );

  return data.token;
};

const loadUserSandboxes = () => async (dispatch: Function) => {
  const { data } = await dispatch(doRequest(LOAD_USER_SANDBOXES, `sandboxes`));

  dispatch({
    type: SET_USER_SANDBOXES,
    data,
  });
};

const sendFeedback = (message: string) => async (dispatch: Function) => {
  await dispatch(
    doRequest(SEND_FEEDBACK_API, 'feedbacks', {
      method: 'POST',
      body: {
        feedback: {
          feedback: message,
          url: window.location.href,
        },
      },
    }),
  );

  dispatch(
    notifActions.addNotification('Thanks a lot for your feedback!', 'success'),
  );
};

const createSubscription = (token: string, amount: number) => async (
  dispatch: Function,
) => {
  await dispatch(
    doRequest(CREATE_SUBSCRIPTION_API, 'users/current_user/subscription', {
      method: 'POST',
      body: {
        subscription: {
          amount,
          token,
        },
      },
    }),
  );

  dispatch(
    notifActions.addNotification(
      'Thank you very much for your support!',
      'success',
    ),
  );
};

const updateSubscription = (amount: number) => async (dispatch: Function) => {
  await dispatch(
    doRequest(UPDATE_SUBSCRIPTION_API, 'users/current_user/subscription', {
      method: 'PATCH',
      body: {
        subscription: {
          amount,
        },
      },
    }),
  );

  dispatch(
    notifActions.addNotification('Succesfully updated subscription', 'success'),
  );
};

const cancelSubscription = () => async (dispatch: Function) => {
  await dispatch(
    doRequest(CANCEL_SUBSCRIPTION_API, 'users/current_user/subscription', {
      method: 'DELETE',
    }),
  );
};

export default {
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getAuthToken,
  signOut,
  signIn,
  getCurrentUser,
  loadUserSandboxes,
  sendFeedback,
};
