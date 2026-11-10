import type { ComponentProps, ReactNode } from "react";
import { Button, Description, FieldError, Input, Label, ListBox, Select, Spinner, TextArea, TextField, type ButtonProps } from "@heroui/react";
import "./styles.css";

/** Stable Ordo visual/pending contract; feature controllers own mutation guards. */
export function OrdoButton({ children, className, variant = "primary", ...props }: Omit<ButtonProps, "children" | "variant" | "className"> & { children: ReactNode; variant?: "primary" | "ghost" | "outline"; className?: string }) {
  return <Button {...props} variant={variant} className={`ordo-button ordo-button--${variant} ${className ?? ""}`}>
    {({ isPending }) => <>{isPending && <Spinner size="sm" color="current" aria-hidden="true" />}<span>{children}</span></>}
  </Button>;
}

type TextProps = Pick<ComponentProps<typeof TextField>, "value" | "onChange" | "isDisabled" | "isRequired" | "autoFocus" | "name" | "type" | "maxLength" | "onKeyDown"> & { label: string; hint?: string; error?: string; multiline?: boolean; placeholder?: string };
export function OrdoTextField({ label, hint, error, multiline, placeholder, ...props }: TextProps) {
  return <TextField {...props} validationBehavior="aria" isInvalid={!!error} className="ordo-field">
    <Label>{label}</Label>{multiline ? <TextArea rows={3} placeholder={placeholder} /> : <Input placeholder={placeholder} />}
    {hint && <Description>{hint}</Description>}{error && <FieldError>{error}</FieldError>}
  </TextField>;
}

/** Scalar IDs remain feature-owned, including the explicit empty option. */
export function OrdoSelectField({ label, hint, value, onChange, options, isDisabled, isRequired }: { label: string; hint?: string; value: string; onChange: (value: string) => void; options: { id: string; name: string; disabled?:boolean }[]; isDisabled?: boolean; isRequired?: boolean }) {
  const empty = "__ordo_empty__";
  return <Select className="ordo-field" isRequired={isRequired} validationBehavior="aria" value={value || empty} onChange={key => onChange(key === empty || key === null ? "" : String(key))} isDisabled={isDisabled}>
    <Label>{label}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>{hint && <Description>{hint}</Description>}
    <Select.Popover className="ordo-ui"><ListBox>{options.map(option => <ListBox.Item isDisabled={option.disabled} key={option.id || empty} id={option.id || empty} textValue={option.name}>{option.name}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}
