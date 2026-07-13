import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("authenticated shell Ask Pluto integration", () => {
  it("renders Ask Pluto in the dashboard shell and top bar", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "app/components/dashboard/dashboard-shell.tsx"),
      "utf8",
    );
    const topBarSource = readFileSync(
      resolve(process.cwd(), "app/components/dashboard/top-bar.tsx"),
      "utf8",
    );

    expect(shellSource).toContain("PlutoAssistantProvider");
    expect(shellSource).toContain("PlutoAssistantDrawer");
    expect(topBarSource).toContain("AskPlutoButton");
  });

  it("does not render a duplicate full assistant on the dashboard brain section", () => {
    const brainSectionSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-brain-section.tsx"),
      "utf8",
    );

    expect(brainSectionSource).not.toContain("PlutoAssistantPanel");
    expect(brainSectionSource).toContain("Ask Pluto");
  });

  it("uses full-width panel classes on mobile", () => {
    const drawerSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-drawer.tsx"),
      "utf8",
    );

    expect(drawerSource).toContain("w-full max-w-full");
    expect(drawerSource).toContain("sm:max-w-md");
  });
});
