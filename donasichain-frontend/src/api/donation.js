import api from './index';

export const createDonation = (data) => api.post('/api/donations', data);
export const getDonationStatus = (orderId) => api.get(`/api/donations/status/${orderId}`);
export const getDonationById = (id) => api.get(`/api/donations/${id}`);

// Donasi Sukarela
export const createVoluntaryDonation = (data) => api.post('/api/voluntary', data);
export const getVoluntaryStatus = (orderId) => api.get(`/api/voluntary/status/${orderId}`);
export const getMyVoluntaryDonations = (params) => api.get('/api/voluntary/my', { params });
