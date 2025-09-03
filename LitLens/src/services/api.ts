import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

const getSampleData = async () => {
  try {
    // This is a placeholder. In a real scenario, you might call a specific endpoint.
    // Since the root of our FastAPI app doesn't have a GET endpoint,
    // this will likely result in a 404, which is fine for this placeholder.
    const response = await apiClient.get('/');
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    return { message: 'This is a mock response because the endpoint does not exist yet.' };
  }
};

export default {
  getSampleData,
};