"use client";

import React, { useState, useCallback } from "react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

let toastQueue: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener([...toastQueue]));
}

export function toast({ title, description, variant = "default" }: ToastProps) {
  const id = Date.now().toString();
  const newToast: Toast = { id, title, description, variant };

  toastQueue.push(newToast);
  notifyListeners();

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    notifyListeners();
  }, 5000);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addListener = useCallback((listener: (toasts: Toast[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    notifyListeners();
  }, []);

  // Set up listener when component mounts
  React.useEffect(() => {
    const unsubscribe = addListener(setToasts);
    return unsubscribe;
  }, [addListener]);

  return { toasts, removeToast };
}

// Legacy function for backward compatibility
export function toastInfo(message: string) {
  toast({ title: "Info", description: message });
}
