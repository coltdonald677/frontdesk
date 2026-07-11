"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildProposedActionFromRecommendation,
  executePlutoAction,
  getPlutoActionById,
  getPlutoActions,
  getProposedActionCount,
  notifyActionCompleted,
  notifyActionFailed,
  notifyActionProposed,
  proposeAction,
  rejectPlutoAction,
  type ActionTab,
  type PlutoAction,
} from "@/lib/actions";
import { notifyInvoiceCreated } from "@/lib/notifications/invoice-events";
import { getInvoiceById } from "@/lib/invoices";
import { getBusinessProfile } from "@/lib/business-profile";

export type PlutoActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  action?: PlutoAction;
};

async function getBusinessContext() {
  const profile = await getBusinessProfile();
  if (!profile) {
    redirect("/onboarding");
  }
  return profile;
}

function revalidateActionPaths() {
  revalidatePath("/dashboard/actions");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

export async function loadActionsForTabAction(
  tab: ActionTab,
): Promise<{ actions: PlutoAction[]; error?: string }> {
  try {
    const profile = await getBusinessContext();
    const actions = await getPlutoActions(profile.id, tab);
    return { actions };
  } catch (err) {
    return {
      actions: [],
      error: err instanceof Error ? err.message : "Failed to load actions.",
    };
  }
}

export async function loadProposedActionCountAction(): Promise<number> {
  try {
    const profile = await getBusinessContext();
    return getProposedActionCount(profile.id);
  } catch {
    return 0;
  }
}

export async function proposeActionFromRecommendationAction(
  recommendationId: string,
): Promise<PlutoActionState> {
  try {
    const profile = await getBusinessContext();
    const proposed = await buildProposedActionFromRecommendation(
      profile.id,
      recommendationId,
    );

    if (!proposed) {
      return {
        error: "Pluto could not build an action for this recommendation yet.",
      };
    }

    const action = await proposeAction(proposed);

    if (!action) {
      return {
        success: true,
        message: "This action is already proposed and waiting for approval.",
      };
    }

    await notifyActionProposed(action);
    revalidateActionPaths();

    return {
      success: true,
      message: "Action proposed. Review it in Action Center.",
      action,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to propose action.",
    };
  }
}

export async function approveAndExecuteActionAction(
  actionId: string,
): Promise<PlutoActionState> {
  try {
    const profile = await getBusinessContext();
    const action = await getPlutoActionById(profile.id, actionId);

    if (!action) {
      return { error: "Action not found." };
    }

    if (action.status !== "proposed") {
      return { error: "This action is no longer waiting for approval." };
    }

    const result = await executePlutoAction(profile.id, action);
    const updated = await getPlutoActionById(profile.id, actionId);

    if (result.success) {
      if (updated) {
        await notifyActionCompleted(updated, result.message);
        if (updated.action_type === "create_invoice" && result.createdEntityId) {
          const invoice = await getInvoiceById(profile.id, result.createdEntityId);
          if (invoice) {
            await notifyInvoiceCreated(profile.id, invoice);
          }
        }
      }
      revalidateActionPaths();
      revalidatePath("/dashboard/tasks");
      revalidatePath("/dashboard/schedule");
      revalidatePath("/dashboard/customers");
      revalidatePath("/dashboard/employees");
      revalidatePath("/dashboard/invoices");
      return { success: true, message: result.message, action: updated ?? undefined };
    }

    if (updated) {
      await notifyActionFailed(updated, result.message);
    }
    revalidateActionPaths();
    return { error: result.message, action: updated ?? undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to execute action.",
    };
  }
}

export async function rejectActionAction(actionId: string): Promise<PlutoActionState> {
  try {
    const profile = await getBusinessContext();
    const action = await rejectPlutoAction(profile.id, actionId);
    revalidateActionPaths();
    return { success: true, message: "Action rejected.", action };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to reject action.",
    };
  }
}
