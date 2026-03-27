import { Platform } from "react-native";

export const API_BASE_URL =
  Platform.OS === "web"
    ? ""
    : process.env.EXPO_PUBLIC_API_URL || "https://localhost:3000";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // React Native's fetch will automatically store and send standard cookies
  // coming from the Set-Cookie headers on this host.
  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    // Required to send and receive cookies from Next.js Iron Session backend
    credentials: "include", // Required for cross-origin web requests to send cookies
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(url, { ...config, signal: controller.signal });
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error || `HTTP ${response.status}: ${response.statusText}`,
    );
  }

  return { response, data };
}
