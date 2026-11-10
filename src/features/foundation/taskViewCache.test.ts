import {expect,it} from "vitest";
import {QueryClient} from "@tanstack/react-query";
import {invalidateTaskViews} from "./taskViewCache";
it("invalidates every canonical task view while keeping other accounts and studios separate",async()=>{
 const client=new QueryClient();const keys=[["foundation","a","studio","production","project"],["foundation","a","studio","my-tasks"],["foundation","a","studio","task-context","context"],["foundation","b","studio","my-tasks"],["foundation","a","other-studio","my-tasks"]];keys.forEach(key=>client.setQueryData(key,{}));await invalidateTaskViews(client,"a","studio");expect(keys.map(key=>client.getQueryState(key)?.isInvalidated)).toEqual([true,true,true,false,false]);client.clear();
});
