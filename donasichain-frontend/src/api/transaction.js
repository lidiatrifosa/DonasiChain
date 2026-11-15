import api from './index';

export const getMyTransactions = (params) => api.get('/api/transactions/me', { params });
export const getCampaignTransactions = (id, params) =>
  api.get(`/api/transactions/campaign/${id}`, { params });
