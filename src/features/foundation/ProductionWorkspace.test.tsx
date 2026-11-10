import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import ProductionWorkspace from "./ProductionWorkspace";
import { foundationApi } from "./api";
vi.mock("./api",()=>({foundationApi:{getProductionWorkspace:vi.fn(),changeProductionItem:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
function show() {const query=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});return render(<QueryClientProvider client={query}><ProductionWorkspace accountId="account-a" organizationId="studio-a" projectId="project-a" /></QueryClientProvider>);}
it("shows persisted tasks only in their authoritative home board and column",async()=>{
  vi.mocked(foundationApi.getProductionWorkspace).mockResolvedValue({boards:[{id:"board-a",name:"Design"},{id:"board-b",name:"Development"}],columns:[{id:"column-a",board_id:"board-a",name:"Working"},{id:"column-b",board_id:"board-b",name:"Testing"}],tasks:[{id:"task-a",board_id:"board-a",column_id:"column-a",title:"Identity system",priority:"high",due_date:null},{id:"task-b",board_id:"board-b",column_id:"column-b",title:"Site build",priority:"normal",due_date:null}]} as Awaited<ReturnType<typeof foundationApi.getProductionWorkspace>>);
  show();expect(await screen.findByText("Identity system")).toBeInTheDocument();expect(screen.queryByText("Site build")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox",{name:"Project board"}),{target:{value:"board-b"}});
  expect(screen.getByText("Site build")).toBeInTheDocument();expect(screen.queryByText("Identity system")).not.toBeInTheDocument();
  expect(foundationApi.getProductionWorkspace).toHaveBeenCalledWith("studio-a","project-a");
});
it("reports a denied or failed read and retries without presenting empty success",async()=>{
  vi.mocked(foundationApi.getProductionWorkspace).mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce({boards:[],columns:[],tasks:[],assignments:[],permissions:{can_write:false,can_configure:false}});show();
  expect(await screen.findByRole("heading",{name:"Couldn’t load production workspace"})).toBeInTheDocument();expect(screen.queryByText("No active boards in this project.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Try again"}));expect(await screen.findByText("No active boards in this project.")).toBeInTheDocument();
});

function writableWorkspace() {
 return {boards:[{id:"board-a",name:"Design",revision:0,archived_at:null}],columns:[{id:"column-a",board_id:"board-a",name:"Working"}],tasks:[{id:"task-a",board_id:"board-a",column_id:"column-a",title:"First task",priority:"normal",revision:0,position:0,archived_at:null},{id:"task-b",board_id:"board-a",column_id:"column-a",title:"Second task",priority:"normal",revision:0,position:1,archived_at:null}],assignments:[],permissions:{can_write:true,can_configure:true}} as Awaited<ReturnType<typeof foundationApi.getProductionWorkspace>>;
}
it("retains a failed ordering command and retries with its original request identity",async()=>{
 let saved=writableWorkspace();vi.mocked(foundationApi.getProductionWorkspace).mockImplementation(async()=>saved);
 vi.mocked(foundationApi.changeProductionItem).mockRejectedValueOnce(new Error("Network interrupted")).mockImplementationOnce(async()=>{saved={...saved,tasks:[saved.tasks[1],saved.tasks[0]]};return "task-b";});show();
 fireEvent.click(await screen.findByRole("button",{name:"Move Second task up"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Network interrupted");expect(screen.getByText("First task")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Retry save"}));await screen.findByText("Changes saved.");
 const calls=vi.mocked(foundationApi.changeProductionItem).mock.calls;expect(calls).toHaveLength(2);expect(calls[0]).toEqual(calls[1]);expect(calls[0]).toEqual(["studio-a","project-a","move_task","task-b",0,"column-a","task-a",expect.any(String)]);
 await waitFor(()=>expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Second task"));
});
it("keeps archived board tasks available through explicit archive access",async()=>{
 let saved=writableWorkspace();vi.mocked(foundationApi.getProductionWorkspace).mockImplementation(async()=>saved);
 vi.mocked(foundationApi.changeProductionItem).mockImplementationOnce(async()=>{saved={...saved,boards:[{...saved.boards[0],archived_at:"2026-11-10T10:00:00Z",revision:1}]};return "board-a";});show();
 fireEvent.click(await screen.findByRole("button",{name:"Archive board"}));await screen.findByText("No active boards in this project.");
 fireEvent.click(screen.getByRole("checkbox",{name:"Include archived boards"}));expect(screen.getByText("First task")).toBeInTheDocument();expect(screen.getByText("Second task")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Restore board"})).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Edit task"})).not.toBeInTheDocument();
});
