import { describe, expect, it } from "vitest";
import { mentionToken, mentionUserIds, displayMentions } from "./mentions";

const id="11998877-2233-4455-8899-aabbccddeeff";
describe("structured task mentions",()=>{
  it("inserts an immutable user reference but displays a readable name",()=>{
    const content=`Please check ${mentionToken("Ada Obi",id)} today.`;
    expect(content).toContain(id);
    expect(displayMentions(content)).toBe("Please check @Ada Obi today.");
    expect(mentionUserIds(content)).toEqual([id]);
  });
  it("de-duplicates mentions and ignores unlinked @names",()=>{
    const content=`${mentionToken("Ada Obi",id)} @Ada ${mentionToken("Ada Obi",id)}`;
    expect(mentionUserIds(content)).toEqual([id]);
    expect(mentionUserIds("Just @Ada please")).toEqual([]);
  });
});
