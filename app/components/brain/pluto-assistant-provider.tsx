"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { askPlutoBrainAction } from "@/app/dashboard/brain/actions";
import { loadProposedActionCountAction } from "@/app/dashboard/actions/actions";
import {
  applyPlutoAskError,
  applyPlutoAskSuccess,
  computePlutoAssistantBadge,
  createInitialPlutoAssistantState,
  type PlutoAssistantConversationState,
} from "@/lib/brain/pluto-assistant-state";
import {
  parsePageContextFromPathname,
  type BrainPageContextHint,
} from "@/lib/brain/page-context";
import type { BrainResponse, CreateAppointmentPendingIntent } from "@/lib/brain/types";

type PlutoAssistantContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  question: string;
  setQuestion: (value: string) => void;
  response: BrainResponse | null;
  pendingCreateAppointment: CreateAppointmentPendingIntent | null;
  error: string | null;
  isPending: boolean;
  ask: (preset?: string) => void;
  showBadge: boolean;
  proposedActionCount: number;
  refreshBadge: () => void;
  pageContextHint: BrainPageContextHint;
  confirmDialogOpen: boolean;
  setConfirmDialogOpen: (open: boolean) => void;
};

const PlutoAssistantContext = createContext<PlutoAssistantContextValue | null>(null);

export function usePlutoAssistant(): PlutoAssistantContextValue {
  const context = useContext(PlutoAssistantContext);
  if (!context) {
    throw new Error("usePlutoAssistant must be used within PlutoAssistantProvider");
  }
  return context;
}

type PlutoAssistantProviderProps = {
  children: ReactNode;
};

export function PlutoAssistantProvider({ children }: PlutoAssistantProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [conversation, setConversation] = useState<PlutoAssistantConversationState>(
    createInitialPlutoAssistantState,
  );
  const [proposedActionCount, setProposedActionCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const pageContextHint = useMemo(
    () => parsePageContextFromPathname(pathname, searchParams),
    [pathname, searchParams],
  );

  const refreshBadge = useCallback(() => {
    startTransition(async () => {
      const count = await loadProposedActionCountAction();
      setProposedActionCount(count);
    });
  }, []);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge, pathname]);

  const showBadge = computePlutoAssistantBadge({
    pendingCreateAppointment: conversation.pendingCreateAppointment,
    response: conversation.response,
    proposedActionCount,
  });

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    if (!confirmDialogOpen) {
      setIsOpen(false);
    }
  }, [confirmDialogOpen]);
  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const setQuestion = useCallback((value: string) => {
    setConversation((current) => ({ ...current, question: value }));
  }, []);

  const ask = useCallback(
    (preset?: string) => {
      const nextQuestion = (preset ?? conversation.question).trim();
      if (!nextQuestion) return;

      setConversation((current) => ({ ...current, error: null }));
      startTransition(async () => {
        const result = await askPlutoBrainAction({
          question: nextQuestion,
          pendingCreateAppointment: conversation.pendingCreateAppointment ?? undefined,
          pageContextHint,
        });

        if (result.error && !result.response) {
          setConversation((current) => applyPlutoAskError(current, result.error!));
          return;
        }

        if (result.response) {
          setConversation((current) =>
            applyPlutoAskSuccess(current, result.response!, preset ?? undefined),
          );
        }

        if (result.error) {
          setConversation((current) => ({ ...current, error: result.error ?? null }));
        }

        refreshBadge();
      });
    },
    [conversation.pendingCreateAppointment, conversation.question, pageContextHint, refreshBadge],
  );

  const value = useMemo<PlutoAssistantContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      question: conversation.question,
      setQuestion,
      response: conversation.response,
      pendingCreateAppointment: conversation.pendingCreateAppointment,
      error: conversation.error,
      isPending,
      ask,
      showBadge,
      proposedActionCount,
      refreshBadge,
      pageContextHint,
      confirmDialogOpen,
      setConfirmDialogOpen,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      conversation,
      isPending,
      ask,
      showBadge,
      proposedActionCount,
      refreshBadge,
      pageContextHint,
      confirmDialogOpen,
    ],
  );

  return (
    <PlutoAssistantContext.Provider value={value}>{children}</PlutoAssistantContext.Provider>
  );
}
