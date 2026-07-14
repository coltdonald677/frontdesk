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
import { usePathname } from "next/navigation";
import { askPlutoBrainAction, cancelPendingClarificationAction, dismissEntitySuggestionAction, selectEntitySuggestionAction } from "@/app/dashboard/brain/actions";
import { loadProposedActionCountAction } from "@/app/dashboard/actions/actions";
import {
  applyPlutoAskError,
  applyPlutoAskSuccess,
  computePlutoAssistantBadge,
  createInitialPlutoAssistantState,
  normalizeAssistantQuestion,
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
  isHydrated: boolean;
  ask: (preset?: string) => void;
  selectEntitySuggestion: (suggestion: import("@/lib/brain/pending-entity-clarification").EntitySuggestion) => void;
  dismissEntitySuggestions: () => void;
  cancelPendingClarification: () => void;
  showBadge: boolean;
  proposedActionCount: number;
  refreshBadge: () => void;
  pageContextHint: BrainPageContextHint;
  syncPageContextHint: (hint: BrainPageContextHint) => void;
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
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [conversation, setConversation] = useState<PlutoAssistantConversationState>(
    createInitialPlutoAssistantState,
  );
  const [proposedActionCount, setProposedActionCount] = useState(0);
  const [isAskPending, startAskTransition] = useTransition();
  const [isHydrated, setIsHydrated] = useState(false);
  const [pageContextHint, setPageContextHint] = useState<BrainPageContextHint>(() =>
    parsePageContextFromPathname(pathname, null),
  );

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setPageContextHint(parsePageContextFromPathname(pathname, null));
  }, [pathname]);

  const syncPageContextHint = useCallback((hint: BrainPageContextHint) => {
    setPageContextHint(hint);
  }, []);

  const refreshBadge = useCallback(() => {
    void loadProposedActionCountAction().then((count) => {
      setProposedActionCount(count);
    });
  }, []);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge, pathname]);

  const showBadge = isHydrated
    ? computePlutoAssistantBadge({
        pendingCreateAppointment: conversation.pendingCreateAppointment,
        pendingMultiDayAssignment: conversation.pendingMultiDayAssignment,
        pendingEntityClarification: conversation.pendingEntityClarification,
        response: conversation.response,
        proposedActionCount,
      })
    : false;

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
      startAskTransition(async () => {
        const result = await askPlutoBrainAction({
          question: nextQuestion,
          pendingCreateAppointment: conversation.pendingCreateAppointment ?? undefined,
          pendingMultiDayAssignment: conversation.pendingMultiDayAssignment ?? undefined,
          pendingEntityClarification: conversation.pendingEntityClarification ?? undefined,
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
    [conversation.pendingCreateAppointment, conversation.pendingMultiDayAssignment, conversation.pendingEntityClarification, conversation.question, pageContextHint, refreshBadge],
  );

  const dismissEntitySuggestions = useCallback(() => {
    const pending = conversation.pendingEntityClarification ?? conversation.response?.pendingEntityClarification;
    if (!pending) return;

    setConversation((current) => ({ ...current, error: null }));
    startAskTransition(async () => {
      const result = await dismissEntitySuggestionAction({ pending });
      if (result.error && !result.response) {
        setConversation((current) => applyPlutoAskError(current, result.error!));
        return;
      }
      if (result.response) {
        setConversation((current) => applyPlutoAskSuccess(current, result.response!));
      }
      refreshBadge();
    });
  }, [conversation.pendingEntityClarification, conversation.response?.pendingEntityClarification, refreshBadge]);

  const cancelPendingClarification = useCallback(() => {
    setConversation((current) => ({ ...current, error: null }));
    startAskTransition(async () => {
      const result = await cancelPendingClarificationAction();
      if (result.error && !result.response) {
        setConversation((current) => applyPlutoAskError(current, result.error!));
        return;
      }
      if (result.response) {
        setConversation((current) => applyPlutoAskSuccess(current, result.response!));
      }
      refreshBadge();
    });
  }, [refreshBadge]);

  const selectEntitySuggestion = useCallback(
    (suggestion: import("@/lib/brain/pending-entity-clarification").EntitySuggestion) => {
      const pending = conversation.pendingEntityClarification ?? conversation.response?.pendingEntityClarification;
      if (!pending) return;

      setConversation((current) => ({ ...current, error: null }));
      startAskTransition(async () => {
        const result = await selectEntitySuggestionAction({ pending, suggestion });
        if (result.error && !result.response) {
          setConversation((current) => applyPlutoAskError(current, result.error!));
          return;
        }
        if (result.response) {
          setConversation((current) => applyPlutoAskSuccess(current, result.response!));
        }
        refreshBadge();
      });
    },
    [conversation.pendingEntityClarification, conversation.response?.pendingEntityClarification, refreshBadge],
  );

  const value = useMemo<PlutoAssistantContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      question: isHydrated
        ? normalizeAssistantQuestion(conversation.question)
        : "",
      setQuestion,
      response: isHydrated ? conversation.response : null,
      pendingCreateAppointment: isHydrated ? conversation.pendingCreateAppointment : null,
      error: isHydrated ? conversation.error : null,
      isPending: isHydrated ? Boolean(isAskPending) : false,
      isHydrated,
      ask,
      selectEntitySuggestion,
      dismissEntitySuggestions,
      cancelPendingClarification,
      showBadge,
      proposedActionCount,
      refreshBadge,
      pageContextHint,
      syncPageContextHint,
      confirmDialogOpen,
      setConfirmDialogOpen,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      conversation,
      isAskPending,
      isHydrated,
      ask,
      selectEntitySuggestion,
      dismissEntitySuggestions,
      cancelPendingClarification,
      showBadge,
      proposedActionCount,
      refreshBadge,
      pageContextHint,
      syncPageContextHint,
      confirmDialogOpen,
    ],
  );

  return (
    <PlutoAssistantContext.Provider value={value}>{children}</PlutoAssistantContext.Provider>
  );
}
