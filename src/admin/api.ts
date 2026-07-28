import { useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

type ApiError = { error?: string };

export function useAuthenticatedApi() {
  const shopify = useAppBridge();

  return useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const token = await shopify.idToken();
    const response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Request failed" })) as ApiError;
      throw new Error(payload.error ?? "Request failed");
    }

    return response.json() as Promise<T>;
  }, [shopify]);
}
