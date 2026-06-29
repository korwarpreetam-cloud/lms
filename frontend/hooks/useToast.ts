"use client";

import { useToast as useToastFromContext } from '../context/ToastContext';

export function useToast() {
  return useToastFromContext();
}
