import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.response.use(r=>r,error=>{if(error.response?.status===401&&!error.config?.url?.includes("/auth/"))window.dispatchEvent(new Event("session-expired"));return Promise.reject(error);});
export default api;
