import axios from "axios";

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, "");
    if (!clean.endsWith("/api")) {
      clean = `${clean}/api`;
    }
    return clean;
  }
  return "http://localhost:5001/api";
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
});

// Request interceptor: Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor: Enhanced error formatting for live deployments
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error(
        `[API Network Error] Could not connect to API at ${getApiBaseUrl()}. Check CORS settings or VITE_API_URL environment variable.`
      );
    }
    return Promise.reject(error);
  }
);

export default api;
