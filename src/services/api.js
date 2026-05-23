// src/services/api.js
import axios from 'axios';

const BASE_URL = 'https://dar-backend-test.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (username, password, captchaToken) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  formData.append('captcha_token', captchaToken);

  const resp = await api.post('/token', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // Guardar user_id para detectar mensajes propios en el chat
  try {
    const me = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${resp.data.access_token}` },
    });
    localStorage.setItem('user_id', me.data.id);
  } catch (e) {
    console.error('No se pudo obtener user_id:', e);
  }

  return resp.data;
};

export const getEmergencies = async () => {
  const resp = await api.get('/admin/emergencies/');
  return resp.data;
};

export const getEmergencyResponses = async (id) => {
  const resp = await api.get(`/emergencies/${id}/responses`);
  return resp.data;
};

export const getMe = async () => {
  const resp = await api.get('/users/me');
  return resp.data;
};

export default api;