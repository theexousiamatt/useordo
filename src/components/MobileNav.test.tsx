import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MobileNav } from "./MobileNav";

vi.mock("@/hooks/useClientDashboard", () => ({
  useActionItems: () => ({
    data: [
      { id: "a1" },
      { id: "a2" },
    ],
  }),
}));

afterEach(cleanup);

describe("mobile footer navigation", () => {
  it("shows only the three primary staff destinations and highlights nested projects", () => {
    render(
      <MemoryRouter initialEntries={["/projects/project-1?task=task-2"]}>
        <MobileNav audience="studio" />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Studio mobile navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Projects", "Tasks"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/projects", "/tasks"]);
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: "Activity" })).toBeNull();
  });

  it("shows Home / Projects / Approvals for clients, including pending approvals", () => {
    render(
      <MemoryRouter initialEntries={["/client/approvals"]}>
        <MobileNav audience="client" />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Client mobile navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/client",
      "/client/projects",
      "/client/approvals",
    ]);
    expect(within(nav).getByRole("link", { name: /Approvals/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByLabelText("2 pending approvals")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Tasks" })).toBeNull();
  });

  it("keeps the exact Home route active only on the workspace home screen", () => {
    render(
      <MemoryRouter initialEntries={["/client/projects/website"]}>
        <MobileNav audience="client" />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Client mobile navigation" });
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});
