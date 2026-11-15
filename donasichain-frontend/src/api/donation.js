import api from './index';

export const createDonation = (data) => api.post('/api/donations', data);
export const getDonationStatus = (orderId) => api.get(`/api/donations/status/${orderId}`);
export const getDonationById = (id) => api.get(`/api/donations/${id}`);
