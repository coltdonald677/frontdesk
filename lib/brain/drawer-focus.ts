const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

export type DrawerKeydownInput = {
  key: string;
  confirmDialogOpen: boolean;
  drawerOpen: boolean;
};

export type DrawerKeydownResult =
  | { action: "none" }
  | { action: "close_drawer" }
  | { action: "trap_tab"; shiftKey: boolean };

export function handleDrawerKeydown(input: DrawerKeydownInput & { shiftKey?: boolean }): DrawerKeydownResult {
  if (!input.drawerOpen) {
    return { action: "none" };
  }

  if (input.key === "Escape" && !input.confirmDialogOpen) {
    return { action: "close_drawer" };
  }

  if (input.key === "Tab") {
    return { action: "trap_tab", shiftKey: Boolean(input.shiftKey) };
  }

  return { action: "none" };
}

export function getNextFocusTarget(
  focusable: HTMLElement[],
  activeElement: HTMLElement | null,
  shiftKey: boolean,
): HTMLElement | null {
  if (focusable.length === 0) return null;

  const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1;

  if (shiftKey) {
    if (currentIndex <= 0) {
      return focusable[focusable.length - 1] ?? null;
    }
    return focusable[currentIndex - 1] ?? null;
  }

  if (currentIndex === -1 || currentIndex >= focusable.length - 1) {
    return focusable[0] ?? null;
  }
  return focusable[currentIndex + 1] ?? null;
}
