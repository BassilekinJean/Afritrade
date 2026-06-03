import { apiClient } from "../lib/apiClient";
import type { AuthResponse, User } from "../types";

export function signup(email: string, password: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>("/auth/signup", { email, password }, false);
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>("/auth/login", { email, password }, false);
}

export function me(): Promise<User> {
  return apiClient.get<User>("/auth/me");
}
