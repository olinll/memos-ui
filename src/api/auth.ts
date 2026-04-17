import client from './client';
import type { AuthResponse, User } from '../types';

export async function signIn(username: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/signin', {
    passwordCredentials: { username, password },
  });
  return data;
}

export async function signOut(): Promise<void> {
  try {
    await client.post('/auth/signout');
  } catch { /* ignore */ }
}

export async function getCurrentUser(): Promise<User> {
  // Decode user ID from JWT token to get user profile
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No token');

  const payload = JSON.parse(atob(token.split('.')[1]));
  const userId = payload.sub;
  const { data } = await client.get(`/users/${userId}`);
  return data;
}
