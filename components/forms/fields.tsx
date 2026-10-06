"use client";

import { useState, type KeyboardEvent } from "react";
import { useFormContext } from "react-hook-form";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Base = { name: string; label: string; required?: boolean; description?: string; className?: string };

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="pt-2">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

export function TextField({
  name, label, required, description, className, type = "text", placeholder, autoComplete,
}: Base & { type?: string; placeholder?: string; autoComplete?: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}{required && " *"}</FormLabel>
          <FormControl>
            <Input type={type} placeholder={placeholder} autoComplete={autoComplete} className="rounded-xl" {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function AreaField({ name, label, required, description, className, placeholder }: Base & { placeholder?: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}{required && " *"}</FormLabel>
          <FormControl>
            <Textarea placeholder={placeholder} className="rounded-xl" {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField({
  name, label, required, description, className, options, placeholder = "Select",
}: Base & { options: readonly (readonly [string, string])[]; placeholder?: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}{required && " *"}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map(([value, text]) => (
                <SelectItem key={value} value={value}>{text}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CheckField({ name, label, description, className }: Omit<Base, "required">) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <div className="flex items-start gap-3 rounded-xl border border-border/50 p-3">
            <FormControl>
              <Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5" />
            </FormControl>
            <div className="space-y-0.5">
              <FormLabel className="cursor-pointer">{label}</FormLabel>
              {description && <FormDescription>{description}</FormDescription>}
            </div>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Free-text tag list (allergies, conditions). Enter or comma adds a tag. */
export function TagField({ name, label, description, placeholder, className }: Omit<Base, "required"> & { placeholder?: string }) {
  const { control } = useFormContext();
  const [draft, setDraft] = useState("");
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const tags: string[] = field.value ?? [];
        const add = () => {
          const v = draft.trim();
          if (v && !tags.some((t) => t.toLowerCase() === v.toLowerCase())) field.onChange([...tags, v]);
          setDraft("");
        };
        const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            field.onChange(tags.slice(0, -1));
          }
        };
        return (
          <FormItem className={className}>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={add}
                placeholder={placeholder ?? "Type and press Enter"}
                className="rounded-xl"
              />
            </FormControl>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 rounded-lg">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => field.onChange(tags.filter((x) => x !== t))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
