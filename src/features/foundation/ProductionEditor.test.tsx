import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import ProductionEditor from "./ProductionEditor";
import { foundationApi } from "./api";
vi.mock("./api",()=>({foundationApi:{saveProductionItem:vi.fn(),listProductionAssignees:vi.fn(),saveOperationalTask:vi.fn(),listContextAssignees:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
function show() {
 vi.mocked(foundationApi.listProductionAssignees).mockResolvedValue([{id:"person-a",name:"Designer"},{id:"person-b",name:"Writer"}]);
 const onSaved=vi.fn(),onClose=vi.fn();
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><ProductionEditor accountId="account-a" organizationId="studio-a" projectId="project-a" edit={{kind:"task",boardId:"board-a",columnId:"column-a"}} boards={[{id:"board-a",name:"Design"} as never]} columns={[{id:"column-a",board_id:"board-a",name:"Doing"} as never]} onSaved={onSaved} onClose={onClose}/></QueryClientProvider>);
 return {onSaved,onClose};
}
it("retains a failed task draft and retries with the same command ID and multiple assignments",async()=>{
 vi.mocked(foundationApi.saveProductionItem).mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce("saved-task");const {onSaved}=show();
 fireEvent.change(screen.getByRole("textbox",{name:/Task title/}),{target:{value:"Brand narrative"}});
 fireEvent.change(screen.getByRole("textbox",{name:"Description"}),{target:{value:"Write the positioning."}});
 fireEvent.click(await screen.findByRole("checkbox",{name:"Designer"}));fireEvent.click(screen.getByRole("checkbox",{name:"Writer"}));
 fireEvent.click(screen.getByRole("button",{name:"Save task"}));expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
 expect(screen.getByRole("textbox",{name:/Task title/})).toHaveValue("Brand narrative");
 expect(screen.getByRole("textbox",{name:/Task title/})).toBeDisabled();
 await waitFor(()=>expect(screen.getByRole("button",{name:"Save task"})).not.toHaveAttribute("aria-disabled","true"));
 fireEvent.click(screen.getByRole("button",{name:"Save task"}));await waitFor(()=>expect(onSaved).toHaveBeenCalledWith("saved-task","board-a"));
 const calls=vi.mocked(foundationApi.saveProductionItem).mock.calls;expect(calls).toHaveLength(2);expect(calls[0][6]).toBe(calls[1][6]);
 expect(calls[0][5]).toMatchObject({description:"Write the positioning.",assignees:["person-a","person-b"],column_id:"column-a"});
});
it("blocks pending dismissal and duplicate saves",async()=>{
 let finish!:(id:string)=>void;vi.mocked(foundationApi.saveProductionItem).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const {onClose,onSaved}=show();
 await screen.findByRole("checkbox",{name:"Designer"});fireEvent.change(screen.getByRole("textbox",{name:/Task title/}),{target:{value:"Draft"}});
 fireEvent.click(screen.getByRole("button",{name:"Save task"}));fireEvent.click(screen.getByRole("button",{name:"Save task"}));fireEvent.click(screen.getByRole("button",{name:"Close"}));
 expect(foundationApi.saveProductionItem).toHaveBeenCalledOnce();expect(onClose).not.toHaveBeenCalled();await act(async()=>{finish("task");});expect(onSaved).toHaveBeenCalledWith("task","board-a");
});

it("edits an unboarded operational task through its context command without a fake project",async()=>{
 vi.mocked(foundationApi.listContextAssignees).mockResolvedValue([{id:"me",name:"Designer"}]);vi.mocked(foundationApi.saveOperationalTask).mockResolvedValue("ops-task");const saved=vi.fn();
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><ProductionEditor accountId="me" organizationId="studio" projectId="" workContextId="ops-context" edit={{kind:"task",boardId:"",item:{id:"ops-task",title:"Publish content",category:"in_progress",revision:0,board_id:null,column_id:null} as never,assignees:["me"]}} boards={[]} columns={[]} onSaved={saved} onClose={vi.fn()}/></QueryClientProvider>);
 await screen.findByRole("checkbox",{name:"Designer"});fireEvent.change(screen.getByLabelText("Due date"),{target:{value:"2026-12-01"}});fireEvent.click(screen.getByRole("button",{name:"Save task"}));
 await waitFor(()=>expect(saved).toHaveBeenCalled());expect(foundationApi.saveOperationalTask).toHaveBeenCalledWith("studio","ops-context","ops-task",0,expect.objectContaining({column_id:null,category:"in_progress",due_date:"2026-12-01",assignees:["me"]}),expect.any(String));expect(foundationApi.saveProductionItem).not.toHaveBeenCalled();
});
