import { describe, expect, it } from "vitest";
import { handleDrawerKeydown } from "@/lib/brain/drawer-focus";

describe("handleDrawerKeydown", () => {
  it("closes the drawer on Escape when no confirmation dialog is open", () => {
    expect(
      handleDrawerKeydown({ key: "Escape", drawerOpen: true, confirmDialogOpen: false }),
    ).toEqual({ action: "close_drawer" });
  });

  it("does not close the drawer on Escape when confirmation is open", () => {
    expect(
      handleDrawerKeydown({ key: "Escape", drawerOpen: true, confirmDialogOpen: true }),
    ).toEqual({ action: "none" });
  });

  it("does not close the drawer when it is already closed", () => {
    expect(
      handleDrawerKeydown({ key: "Escape", drawerOpen: false, confirmDialogOpen: false }),
    ).toEqual({ action: "none" });
  });

  it("traps tab navigation while the drawer is open", () => {
    expect(
      handleDrawerKeydown({
        key: "Tab",
        drawerOpen: true,
        confirmDialogOpen: false,
        shiftKey: true,
      }),
    ).toEqual({ action: "trap_tab", shiftKey: true });
  });
});
