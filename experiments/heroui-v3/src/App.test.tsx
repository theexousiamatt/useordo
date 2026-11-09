import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { OrdoButton, OrdoTextField } from "./controls";
afterEach(()=>cleanup());

describe("Ordo HeroUI v3 proof",()=>{
  it("retains task identity across board/list views",()=>{
    render(<App/>);
    expect(screen.getByRole("button",{name:"Refine the visual identity"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"List"}));
    const list=screen.getByRole("region",{name:"Sample project tasks"});
    expect(within(list).getAllByRole("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button",{name:"Board"}));
    expect(document.querySelector('[data-task-id="task-identity"]')).toBeInTheDocument();
  });
  it("preserves button submission and pending semantics",()=>{
    const submit=vi.fn((event:React.FormEvent)=>event.preventDefault());
    const view=render(<form onSubmit={submit}><OrdoButton type="submit">Save</OrdoButton></form>);
    fireEvent.click(screen.getByRole("button",{name:"Save"}));expect(submit).toHaveBeenCalledTimes(1);
    view.rerender(<form onSubmit={submit}><OrdoButton type="submit" isPending>Save</OrdoButton></form>);
    expect(screen.getByRole("button",{name:"Save"})).toHaveAttribute("aria-disabled","true");
    fireEvent.click(screen.getByRole("button",{name:"Save"}));expect(submit).toHaveBeenCalledTimes(1);
  });
  it("links field labels, hints and error messages",()=>{
    render(<OrdoTextField label="Task name" value="" onChange={()=>{}} hint="Keep the name clear." error="A name is required." isRequired/>);
    const input=screen.getByRole("textbox",{name:/Task name/});
    expect(input).toHaveAttribute("aria-invalid","true");
    expect(input).toHaveAccessibleDescription(/Keep the name clear/);
    expect(input).toHaveAccessibleDescription(/A name is required/);
  });
  it("keeps a failed draft and retries once without duplicating the task",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("checkbox",{name:"Make the next save fail"}));
    fireEvent.click(screen.getByRole("button",{name:"Refine the visual identity"}));
    const name=await screen.findByRole("textbox",{name:/Task name/});
    expect(name).toHaveValue("Refine the visual identity");
    fireEvent.change(name,{target:{value:"Identity direction ready"}});
    fireEvent.click(screen.getByRole("button",{name:"Save task"}));
    expect(screen.getByRole("button",{name:"Close task details"})).toBeDisabled();
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await screen.findByText(/The preview save failed/,{}, {timeout:2500});
    expect(name).toHaveValue("Identity direction ready");
    fireEvent.click(screen.getByRole("button",{name:"Save task"}));
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),{timeout:2500});
    expect(screen.getByRole("button",{name:"Identity direction ready"})).toBeInTheDocument();
    expect(document.querySelectorAll('[data-task-id="task-identity"]')).toHaveLength(1);
    expect(document.querySelectorAll("article[data-task-id]")).toHaveLength(3);
    expect(screen.queryByRole("button",{name:"Refine the visual identity"})).not.toBeInTheDocument();
  });
  it("requires a name and preserves an unfinished new task",async()=>{
    render(<App/>);fireEvent.click(screen.getByRole("button",{name:"New task"}));
    await screen.findByRole("textbox",{name:/Task name/});
    fireEvent.click(screen.getByRole("button",{name:"Save task"}));
    expect(screen.getByRole("alert")).toHaveTextContent("Give this task a name");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("changes theme at the document boundary shared by portals",()=>{
    render(<App/>);fireEvent.click(screen.getByRole("button",{name:"Switch to dark theme"}));
    expect(document.documentElement).toHaveAttribute("data-theme","ordo-dark");
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button",{name:"Switch to light theme"}));
    expect(document.documentElement).toHaveAttribute("data-theme","ordo-light");
  });
  it("exposes an explicit reduced-motion preference for the shared portal root",()=>{
    render(<App/>);fireEvent.click(screen.getByRole("checkbox",{name:"Reduce motion"}));
    expect(document.documentElement).toHaveAttribute("data-reduce-motion","true");
  });
  it("saves a column title without changing task IDs",async()=>{
    render(<App/>);fireEvent.click(screen.getByRole("button",{name:"Configure board"}));
    fireEvent.change(await screen.findByRole("textbox",{name:/Review column name/}),{target:{value:"Quality review"}});
    fireEvent.click(screen.getByRole("button",{name:"Save configuration"}));
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading",{name:"Quality review"})).toBeInTheDocument();
    expect(document.querySelector('[data-task-id="task-site"]')).toBeInTheDocument();
  });
});
