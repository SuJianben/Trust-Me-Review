import { useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

type ApiError = { error?: unknown };
export type AuthenticatedRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

function readableApiError(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  if (error && typeof error === "object" && "formErrors" in error && Array.isArray(error.formErrors) && typeof error.formErrors[0] === "string") return error.formErrors[0];
  if (error && typeof error === "object" && "fieldErrors" in error && error.fieldErrors && typeof error.fieldErrors === "object") {
    const firstFieldError = Object.values(error.fieldErrors).flat().find((value): value is string => typeof value === "string");
    if (firstFieldError) return firstFieldError;
  }
  return "Request failed. Please refresh and try again.";
}

export function useAuthenticatedApi(): AuthenticatedRequest {
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
      throw new Error(readableApiError(payload.error));
    }

    return response.json() as Promise<T>;
  }, [shopify]);
}
