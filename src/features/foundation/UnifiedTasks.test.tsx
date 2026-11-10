import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {MemoryRouter,useLocation} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import UnifiedTasks from "./UnifiedTasks";
import {foundationApi,type UnifiedTask} from "./api";
vi.mock("@/hooks/useLocalDateKey",()=>({useLocalDateKey:()=>"2026-11-10"}));
vi.mock("./api",()=>({foundationApi:{listUnifiedTasks:vi.fn(),getTaskContext:vi.fn(),listProductionAssignees:vi.fn(),saveProductionItem:vi.fn(),listContextAssignees:vi.fn()}}));
const task=(extra:Partial<UnifiedTask>)=>({id:"task-a",organization_id:"studio",work_context_id:"context-a",board_id:"board-a",column_id:"column-a",title:"Client identity",description:"Brief",category:"todo",priority:"high",due_date:"2026-11-10",revision:0,archived_at:null,context_kind:"project",context_name:"Client launch",project_id:"project-a",ownership:"client",initiative_name:null,board_name:"Design",board_archived:false,can_write:true,assignees:[{id:"me",name:"Designer"}],...extra}) as UnifiedTask;
let tasks:UnifiedTask[];
function Location(){return <output aria-label="Filter URL">{useLocation().search}</output>;}
function show(url="/tasks",accountId="me") {const client=new QueryClient({defaultOptions:{queries:{retry:false,retryDelay:0,gcTime:0}}});return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}><UnifiedTasks accountId={accountId} organizationId="studio"/><Location/></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{tasks=[task({}),task({id:"ops",title:"Publish studio post",context_kind:"operational",context_name:"Studio content",project_id:null,ownership:null,board_id:null,column_id:null,due_date:null}),task({id:"archived-board",title:"Outstanding review",board_archived:true,due_date:"2026-11-09"}),task({id:"complete",title:"Finished work",category:"done"}),task({id:"other",title:"Writer work",assignees:[{id:"writer",name:"Writer"}]})];vi.mocked(foundationApi.listUnifiedTasks).mockImplementation(async()=>tasks);});
afterEach(()=>{cleanup();vi.resetAllMocks();});
it("shows own open tasks across projects and operations with truthful deadline counts",async()=>{
 show();expect(await screen.findByRole("button",{name:"Open task: Client identity"})).toBeInTheDocument();expect(screen.getByRole("button",{name:"Open task: Publish studio post"})).toBeInTheDocument();expect(screen.getByText(/Archived board/)).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Open task: Finished work"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Open task: Writer work"})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Due Today (1)"})).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"No Due Date (1)"}));expect(screen.queryByRole("button",{name:"Open task: Client identity"})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Open task: Publish studio post"})).toBeInTheDocument();
});
it("persists filters in the URL and scopes a fresh account to its own assignments",async()=>{
 const view=show();await screen.findByRole("heading",{name:"My Tasks"});fireEvent.change(screen.getByRole("combobox",{name:"Priority"}),{target:{value:"high"}});fireEvent.click(screen.getByRole("button",{name:"Due Today (1)"}));const query=screen.getByLabelText("Filter URL").textContent;view.unmount();show(`/tasks${query}`);expect(await screen.findByRole("button",{name:"Open task: Client identity"})).toBeInTheDocument();expect(screen.getByRole("button",{name:"Due Today (1)"})).toHaveAttribute("aria-pressed","true");cleanup();show("/tasks","writer");expect(await screen.findByRole("button",{name:"Open task: Writer work"})).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Open task: Client identity"})).not.toBeInTheDocument();
});
it("opens authorized read-only details without enabling a write command",async()=>{
 tasks=[task({can_write:false})];vi.mocked(foundationApi.getTaskContext).mockResolvedValue({boards:[],columns:[]});show();fireEvent.click(await screen.findByRole("button",{name:"Open task: Client identity"}));expect(await screen.findByRole("heading",{name:"Task details"})).toBeInTheDocument();expect(screen.getByRole("textbox",{name:/Task title/})).toBeDisabled();expect(screen.queryByRole("button",{name:"Save task"})).not.toBeInTheDocument();expect(foundationApi.listProductionAssignees).not.toHaveBeenCalled();
});
it("recovers from a load failure instead of presenting an empty success",async()=>{
 vi.mocked(foundationApi.listUnifiedTasks).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));show();expect(await screen.findByRole("heading",{name:"Couldn’t load your tasks"})).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Try again"}));await waitFor(()=>expect(screen.getByRole("button",{name:"Open task: Client identity"})).toBeInTheDocument());
});

it("updates assignment counts immediately after an edit and retains one canonical task",async()=>{
 vi.mocked(foundationApi.getTaskContext).mockResolvedValue({boards:[{id:"board-a",name:"Design",archived_at:null} as never],columns:[{id:"column-a",board_id:"board-a",name:"Doing"} as never]});vi.mocked(foundationApi.listProductionAssignees).mockResolvedValue([{id:"me",name:"Designer"},{id:"writer",name:"Writer"}]);
 vi.mocked(foundationApi.saveProductionItem).mockImplementationOnce(async(_org,_project,_kind,id,_revision,values)=>{tasks=tasks.map(t=>t.id===id ? {...t,title:String(values.title),assignees:[{id:"writer",name:"Writer"}],revision:1} : t);return id!;});
 show();fireEvent.click(await screen.findByRole("button",{name:"Open task: Client identity"}));await screen.findByRole("checkbox",{name:"Designer"});fireEvent.change(screen.getByRole("textbox",{name:/Task title/}),{target:{value:"Refined identity"}});fireEvent.click(screen.getByRole("checkbox",{name:"Designer"}));fireEvent.click(screen.getByRole("checkbox",{name:"Writer"}));fireEvent.click(screen.getByRole("button",{name:"Save task"}));
 await waitFor(()=>expect(screen.queryByRole("textbox",{name:/Task title/})).not.toBeInTheDocument());await waitFor(()=>expect(screen.getByText(/Task saved. 2 tasks shown./)).toBeInTheDocument());expect(screen.queryByRole("button",{name:"Open task: Refined identity"})).not.toBeInTheDocument();
 fireEvent.change(screen.getByRole("combobox",{name:"Assignee"}),{target:{value:"all"}});expect(screen.getAllByRole("button",{name:"Open task: Refined identity"})).toHaveLength(1);expect(foundationApi.saveProductionItem).toHaveBeenCalledWith("studio","project-a","task","task-a",0,expect.objectContaining({assignees:["writer"]}),expect.any(String));
});
