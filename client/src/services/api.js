import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem('admin_token');
  const authToken = localStorage.getItem('auth_token');
  if (adminToken) config.headers.Authorization = `Bearer ${adminToken}`;
  else if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

export const adminLogin = (password) =>
  api.post('/knowledge/login', { password }).then((r) => r.data);

export const fetchKnowledge = () =>
  api.get('/knowledge').then((r) => r.data);

export const addKnowledge = (formData) =>
  api.post('/knowledge', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const deleteKnowledge = (id) =>
  api.delete(`/knowledge/${id}`).then((r) => r.data);

// Bulk ingest many entries/passages at once (used by Import Document)
export const bulkAddKnowledge = (entries) =>
  api.post('/knowledge/bulk', { entries }).then((r) => r.data);

// Imported documents (grouped by source file)
export const listDocuments = () =>
  api.get('/knowledge/documents').then((r) => r.data);

export const deleteDocument = (source, customer) =>
  api.delete('/knowledge/documents', { data: { source, customer } }).then((r) => r.data);

export const updateKnowledge = (id, data) =>
  api.put(`/knowledge/${id}`, data).then((r) => r.data);

export const fetchGaps = () =>
  api.get('/knowledge/gaps').then((r) => r.data);

export async function analyzeDoc(file) {
  const token = localStorage.getItem('admin_token');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/knowledge/analyze-doc', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to analyze document');
  }
  return res.json();
}

// Search the KB and return top matches with full solution data
export const findInKB = (message) =>
  fetch('/api/chat/find', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then((r) => r.json());

export const fetchServiceHealth = () => {
  const token = localStorage.getItem('admin_token');
  return fetch('/api/health/services', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
};

export const fetchLogs = () => {
  const token = localStorage.getItem('admin_token');
  return fetch('/api/logs', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
};

export const submitThumbsUp = (question, sourceIds = []) =>
  fetch('/api/feedback/thumbsup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, sourceIds }),
  }).then((r) => r.json());

export const submitThumbsDown = (question, answer) =>
  fetch('/api/feedback/thumbsdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer }),
  }).then((r) => r.json());

// ── Conversations (ChatGPT-style multi-chat history) ───────────────────────
export const listConversations = () =>
  api.get('/conversations').then((r) => r.data);

export const getConversation = (id) =>
  api.get(`/conversations/${id}`).then((r) => r.data);

export const createConversation = () =>
  api.post('/conversations').then((r) => r.data);

export const saveConversation = (id, messages) =>
  api.put(`/conversations/${id}`, { messages }).then((r) => r.data);

export const deleteConversation = (id) =>
  api.delete(`/conversations/${id}`).then((r) => r.data);

export async function* streamChat(message, files = [], history = [], signal, mode = 'full') {
  let body;
  const headers = {};
  const token = localStorage.getItem('auth_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  if (files.length > 0) {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('history', JSON.stringify(history));
    formData.append('mode', mode);
    files.forEach((f) => formData.append('files', f));
    body = formData;
  } else {
    body = JSON.stringify({ message, history, mode });
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers,
    body,
    signal,
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data);
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}
