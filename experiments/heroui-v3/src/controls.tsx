import { members, priorities } from "./options";
import type { ReactNode } from "react";
import { Button, Description, FieldError, Input, Label, ListBox, Select, Spinner, TextArea, TextField, type ButtonProps } from "@heroui/react";

/** Only a shared Ordo visual/pending contract; no business state lives here. */
export function OrdoButton({ children, className = "", ...props }: Omit<ButtonProps, "children"> & {children: ReactNode}) {
  return <Button {...props} className={`ordo-button ${className}`}>
    {({isPending}) => <>{isPending && <Spinner size="sm" color="current" className="ordo-button-spinner" aria-hidden="true" />}<span>{children}</span></>}
  </Button>;
}

export function OrdoTextField({label, hint, error, multiline = false, ...props}: {
  label: string; hint?: string; error?: string; multiline?: boolean; value: string; onChange: (value: string) => void;
  name?: string; type?: string; isRequired?: boolean; isDisabled?: boolean; autoFocus?: boolean;
}) {
  return <TextField {...props} isInvalid={!!error} validationBehavior="aria" className="ordo-field">
    <Label>{label}</Label>{multiline ? <TextArea rows={3}/> : <Input />}{hint && <Description>{hint}</Description>}{error && <FieldError>{error}</FieldError>}
  </TextField>;
}


export function PriorityPicker({value,onChange,disabled=false,portalContainer}: {
  value: string; onChange: (value:string)=>void; disabled?:boolean; portalContainer?:HTMLElement;
}) {
  return <Select value={value} onChange={key=>onChange(key === null ? "normal" : String(key))} isDisabled={disabled} className="ordo-field">
    <Label>Priority</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover UNSTABLE_portalContainer={portalContainer} className="ordo-popover">
      <ListBox>{priorities.map(option=><ListBox.Item key={option.id} id={option.id} textValue={option.name}>{option.name}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox>
    </Select.Popover>
  </Select>;
}

export function OrdoMemberPicker({value,onChange,disabled=false}: {value:string[];onChange:(value:string[])=>void;disabled?:boolean}) {
  return <Select selectionMode="multiple" value={value} onChange={keys=>onChange((keys ?? []).map(String))} isDisabled={disabled} className="ordo-field" placeholder="Choose team members">
    <Label>Assignees</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Description>One task can have more than one assignee.</Description>
    <Select.Popover className="ordo-popover"><ListBox selectionMode="multiple">
      {members.map(member=><ListBox.Item key={member.id} id={member.id} textValue={member.name}>
        <span className="avatar" aria-hidden="true">{member.initials}</span><span><Label>{member.name}</Label><Description>{member.role}</Description></span><ListBox.ItemIndicator />
      </ListBox.Item>)}
    </ListBox></Select.Popover>
  </Select>;
}
