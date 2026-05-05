"use client";

import { useCallback } from "react";
import { toast } from "sonner";

export function useErrorHandler() {
  const handleError = useCallback((error: Error | string, context?: string) => {
    const message = typeof error === "string" ? error : error.message;

    console.error(`Error${context ? ` in ${context}` : ""}:`, error);

    // Show user-friendly error message
    toast.error(`Error${context ? ` in ${context}` : ""}`, {
      description: message,
    });
  }, []);

  const handleAsyncError = useCallback(async <T>(
    promise: Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error as Error, context);
      return null;
    }
  }, [handleError]);

  return { handleError, handleAsyncError };
}