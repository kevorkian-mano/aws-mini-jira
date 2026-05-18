import axios from 'axios';
import { Auth } from 'aws-amplify';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use(async (config) => {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.log('No session:', e.message);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || err.response?.data?.message || 'Something went wrong';
    return Promise.reject(new Error(msg));
  }
);

export default api;