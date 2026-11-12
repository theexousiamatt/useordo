import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectTeamPanel } from "./ProjectTeamPanel";
import { foundationApi } from "./api";

vi.mock("./api",()=>({foundationApi:{
  listProjectTeam:vi.fn(),setProjectTeamMember:vi.fn(),
}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});

const roster=[
  {user_id:"owner-a",member_name:"Studio Owner",studio_role:"owner",project_role:"owner"},
  {user_id:"person-a",member_name:"Ada",studio_role:"member",project_role:null},
  {user_id:"person-b",member_name:"Bayo",studio_role:"member",project_role:null},
];
function show(){
  const query=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  return render(<QueryClientProvider client={query}>
    <ProjectTeamPanel accountId="owner-a" organizationId="studio-a" projectId="project-a"/>
  </QueryClientProvider>);
}

it("adds multiple studio members to one project without creating accounts",async()=>{
  vi.mocked(foundationApi.listProjectTeam).mockResolvedValue(roster as Awaited<ReturnType<typeof foundationApi.listProjectTeam>>);
  vi.mocked(foundationApi.setProjectTeamMember).mockResolvedValue("saved");
  show();
  fireEvent.click(await screen.findByRole("button",{name:"Manage team"}));
  fireEvent.click(await screen.findByRole("checkbox",{name:/Ada/}));
  fireEvent.click(screen.getByRole("checkbox",{name:/Bayo/}));
  fireEvent.click(screen.getByRole("button",{name:"Add 2 selected"}));
  await waitFor(()=>expect(foundationApi.setProjectTeamMember).toHaveBeenCalledTimes(2));
  const calls=vi.mocked(foundationApi.setProjectTeamMember).mock.calls;
  expect(calls[0]).toEqual(["studio-a","project-a","person-a","contributor",expect.any(String)]);
  expect(calls[1]).toEqual(["studio-a","project-a","person-b","contributor",expect.any(String)]);
  expect(calls[0][4]).not.toEqual(calls[1][4]);
});

it("keeps owner protected and changes an existing contributor role",async()=>{
  vi.mocked(foundationApi.listProjectTeam).mockResolvedValue([
    roster[0],{user_id:"person-a",member_name:"Ada",studio_role:"member",project_role:"contributor"},
  ] as Awaited<ReturnType<typeof foundationApi.listProjectTeam>>);
  vi.mocked(foundationApi.setProjectTeamMember).mockResolvedValue("person-a");
  show();
  fireEvent.click(await screen.findByRole("button",{name:"Manage team"}));
  expect(screen.getByText("Studio Owner")).toBeInTheDocument();
  expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button",{name:"Remove"})).toHaveLength(1);
  fireEvent.change(screen.getByRole("combobox",{name:"Role for Ada"}),{target:{value:"viewer"}});
  fireEvent.click(screen.getByRole("button",{name:"Save role"}));
  await waitFor(()=>expect(foundationApi.setProjectTeamMember).toHaveBeenCalledWith(
    "studio-a","project-a","person-a","viewer",expect.any(String),
  ));
});

it("requires confirmation for removing a member",async()=>{
  vi.mocked(foundationApi.listProjectTeam).mockResolvedValue([
    roster[0],{user_id:"person-a",member_name:"Ada",studio_role:"member",project_role:"contributor"},
  ] as Awaited<ReturnType<typeof foundationApi.listProjectTeam>>);
  vi.mocked(foundationApi.setProjectTeamMember).mockResolvedValue("person-a");
  show();
  fireEvent.click(await screen.findByRole("button",{name:"Manage team"}));
  fireEvent.click(screen.getByRole("button",{name:"Remove"}));
  expect(foundationApi.setProjectTeamMember).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirm remove"}));
  await waitFor(()=>expect(foundationApi.setProjectTeamMember).toHaveBeenCalledWith(
    "studio-a","project-a","person-a",null,expect.any(String),
  ));
});
