"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/shared/toast";

export type WizardStep = {
  title: string;
  description: string;
  /** Form field names validated before moving past this step. */
  fields: string[];
  content: ReactNode;
};

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  steps: WizardStep[];
  /** POSTs/PATCHes the values. Resolve with an error message (or issues) on failure. */
  submit: (values: T) => Promise<{ ok: true; redirectTo: string } | { ok: false; error: string; issues?: { path: string; message: string }[] }>;
  submitLabel: string;
  cancelHref: string;
  successMessage: string;
  /** localStorage key for the unsaved-draft; omit to disable (edit mode). */
  draftKey?: string;
  /** Field names never written to the draft (sensitive data). */
  draftExclude?: string[];
  /** Field names whose value is masked on the review step. */
  maskedKeys?: string[];
};

const words = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function display(value: unknown, masked: boolean): string {
  if (value === true) return "Yes";
  if (value === false || value === "" || value == null) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    return value.every((v) => typeof v === "string") ? value.join(", ") : `${value.length} added`;
  }
  if (typeof value === "object") {
    const on = Object.entries(value as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k.replace(/_/g, " "));
    return on.join(", ");
  }
  const s = String(value);
  return masked ? `••••${s.slice(-2)}` : s.replace(/_/g, " ");
}

export function Wizard<T extends FieldValues>({
  form, steps, submit, submitLabel, cancelHref, successMessage, draftKey, draftExclude = [], maskedKeys = [],
}: Props<T>) {
  const router = useRouter();
  const { toast } = useToast();
  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [submitting, setSubmitting] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const submitted = useRef(false);

  const goTo = (i: number) => {
    setVisited((v) => new Set(v).add(i));
    setCurrent(i);
  };
  const errorKeys = Object.keys(form.formState.errors);
  const stepHasError = (i: number) => i < steps.length && steps[i].fields.some((f) => errorKeys.includes(f));

  const total = steps.length + 1; // + review
  const isReview = current === steps.length;

  // Restore draft once on mount.
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        form.reset({ ...form.getValues(), ...JSON.parse(raw) });
        setDraftRestored(true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Autosave draft (minus sensitive fields).
  useEffect(() => {
    if (!draftKey) return;
    const sub = form.watch((values) => {
      if (submitted.current) return;
      try {
        const copy: Record<string, unknown> = { ...values };
        draftExclude.forEach((k) => delete copy[k]);
        localStorage.setItem(draftKey, JSON.stringify(copy));
      } catch {}
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, form]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty && !submitted.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  const discardDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    form.reset();
    setDraftRestored(false);
    setCurrent(0);
  };

  async function next() {
    if (isReview) return;
    const ok = await form.trigger(steps[current].fields as never);
    if (ok) goTo(current + 1);
  }

  async function onFinalSubmit(values: T) {
    setSubmitting(true);
    setRootError(null);
    const result = await submit(values);
    if (!result.ok) {
      result.issues?.forEach((i) => form.setError(i.path.split(".")[0] as never, { message: i.message }));
      setRootError(result.error);
      // Jump back to the first step that has an error.
      const errs = Object.keys(form.formState.errors);
      const idx = steps.findIndex((s) => s.fields.some((f) => errs.includes(f) || result.issues?.some((i) => i.path.split(".")[0] === f)));
      if (idx >= 0) goTo(idx);
      setSubmitting(false);
      return;
    }
    submitted.current = true;
    if (draftKey) localStorage.removeItem(draftKey);
    toast(successMessage);
    router.push(result.redirectTo);
    router.refresh();
  }

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReview) return next(); // Enter key advances; never submits early.
    // Validate everything on final submit; the schema has cross-field rules.
    await form.handleSubmit(onFinalSubmit, (errors) => {
      const keys = Object.keys(errors);
      const idx = steps.findIndex((s) => s.fields.some((f) => keys.includes(f)));
      if (idx >= 0) goTo(idx);
    })(e);
  }

  const values = form.getValues() as Record<string, unknown>;

  return (
    <div className="max-w-3xl">
      <ol className="mb-6 flex items-center gap-1 overflow-x-auto pb-1" aria-label="Progress">
        {[...steps.map((s) => s.title), "Review"].map((title, i) => {
          const active = i === current;
          const hasError = stepHasError(i);
          const done = !active && !hasError && visited.has(i) && i < steps.length;
          return (
            <li key={title} className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-accent text-accent-foreground",
                  hasError && !active && "bg-destructive/10 text-destructive",
                  !active && !done && !hasError && "text-muted-foreground hover:bg-muted",
                )}
              >
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px]", active ? "bg-primary-foreground/20" : "bg-muted")}>
                  {done ? <Check className="h-3 w-3" /> : hasError ? "!" : i + 1}
                </span>
                {title}
              </button>
              {i < total - 1 && <span className="h-px w-4 bg-border" />}
            </li>
          );
        })}
      </ol>

      {draftRestored && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border/50 bg-accent/40 px-4 py-2 text-sm">
          <span>Restored your unsaved draft.</span>
          <button type="button" onClick={discardDraft} className="text-xs font-medium underline">Discard draft</button>
        </div>
      )}

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader>
          <CardTitle>{isReview ? "Review and confirm" : steps[current].title}</CardTitle>
          <CardDescription>
            {isReview ? "Check the details below. Click any step above to correct anything." : steps[current].description}
            {" "}Fields marked * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onFormSubmit} className="space-y-5" noValidate>
              {steps.map((s, i) => (
                // Keep inactive steps mounted (hidden) so values and errors persist.
                <div key={s.title} hidden={i !== current} className="space-y-5">{s.content}</div>
              ))}

              {isReview && (
                <dl className="divide-y divide-border/50 rounded-xl border border-border/50 text-sm">
                  {Object.entries(values).map(([k, v]) => {
                    const text = display(v, maskedKeys.includes(k));
                    if (!text) return null;
                    return (
                      <div key={k} className="grid grid-cols-3 gap-3 px-4 py-2">
                        <dt className="text-muted-foreground">{words(k)}</dt>
                        <dd className="col-span-2 break-words">{text}</dd>
                      </div>
                    );
                  })}
                </dl>
              )}

              {rootError && <p role="alert" className="text-sm text-destructive">{rootError}</p>}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" className="rounded-xl" onClick={() => router.push(cancelHref)}>
                  Cancel
                </Button>
                <div className="flex gap-3">
                  {current > 0 && (
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => goTo(current - 1)}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                  )}
                  {!isReview ? (
                    <Button type="button" className="rounded-xl" onClick={next}>
                      Next <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting} className="rounded-xl">
                      {submitting ? "Saving..." : submitLabel}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
