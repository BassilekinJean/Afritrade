import { apiClient } from "../lib/apiClient";
import type { AuthResponse, Role, User } from "../types";

export function login(
  username: string,
  password: string,
  asRole?: Role,
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>("/auth/login", { username, password, as_role: asRole }, false);
}

export function logout(): Promise<void> {
  return apiClient.post<void>("/auth/logout");
}

export function me(): Promise<User> {
  return apiClient.get<User>("/auth/me");
}

export function changePassword(current_password: string, new_password: string): Promise<User> {
  return apiClient.post<User>("/auth/change-password", { current_password, new_password });
}
