import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import ProductionWorkspace from "./ProductionWorkspace";
import { foundationApi } from "./api";
vi.mock("./api",()=>({foundationApi:{getProductionWorkspace:vi.fn()}}));
afterEach(cleanup);
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
