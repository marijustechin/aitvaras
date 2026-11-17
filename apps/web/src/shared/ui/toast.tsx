"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib/utils";

export type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATIONS: Record<ToastTone, number> = {
  info: 4500,
  success: 4000,
  error: 9000,
};

const TONE_STYLES: Record<ToastTone, string> = {
  info: "border-amber-200 bg-amber-50 text-amber-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
};

const TONE_LABELS: Record<ToastTone, string> = {
  info: "Informacija",
  success: "Sėkmė",
  error: "Klaida",
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
        tone === "info" && "border-amber-300 bg-amber-100",
        tone === "success" && "border-emerald-300 bg-emerald-100",
        tone === "error" && "border-rose-300 bg-rose-100",
      )}
    >
      {tone === "info" ? "i" : tone === "success" ? "✓" : "!"}
    </span>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/**
 * One global toast system, mounted once in the root layout.
 *
 * Toasts are top-right, dismissible and tone-labelled. Identical tone+message
 * pairs are de-duplicated while visible, so one operation cannot announce itself
 * twice. Errors stay longer than success/info.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());
  const activeKeys = useRef<Set<string>>(new Set());
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => {
      const toast = current.find((item) => item.id === id);
      if (toast) {
        activeKeys.current.delete(`${toast.tone}:${toast.message}`);
      }
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const key = `${tone}:${message}`;
      if (activeKeys.current.has(key)) {
        return;
      }
      activeKeys.current.add(key);
      const id = (nextId.current += 1);
      setToasts((current) => [...current, { id, tone, message }]);
      const timer = window.setTimeout(() => remove(id), DURATIONS[tone]);
      timers.current.set(id, timer);
    },
    [remove],
  );

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      for (const timer of currentTimers.values()) {
        window.clearTimeout(timer);
      }
      currentTimers.clear();
    };
  }, []);

  const api: ToastApi = useMemo(
    () => ({
      info: (message) => push("info", message),
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      dismiss: remove,
    }),
    [push, remove],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed top-4 right-3 z-[70] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-md",
              TONE_STYLES[toast.tone],
            )}
          >
            <ToneIcon tone={toast.tone} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] uppercase opacity-70">
                {TONE_LABELS[toast.tone]}
              </p>
              <p className="mt-0.5 text-sm">{toast.message}</p>
            </div>
            <button
              type="button"
              aria-label="Uždaryti pranešimą"
              onClick={() => remove(toast.id)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
