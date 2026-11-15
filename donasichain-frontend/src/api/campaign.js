import api from './index';

export const getCampaigns = (params) => api.get('/api/campaigns', { params });
export const getCampaignById = (id) => api.get(`/api/campaigns/${id}`);
export const getMyCampaigns = () => api.get('/api/campaigns/mine');
export const createCampaign = (data) => api.post('/api/campaigns', data);
export const updateCampaign = (id, data) => api.put(`/api/campaigns/${id}`, data);
