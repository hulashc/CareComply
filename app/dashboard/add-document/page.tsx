"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";

import { documentSchema, DocumentFormValues } from "@/lib/schemas/document";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

type Carer = { id: string; full_name: string };
type DocType = { id: string; name: string };

export default function AddDocumentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [carers, setCarers] = useState<Carer[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      ownerId: "",
      documentTypeId: "",
      expiryDate: "",
    },
  });

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient();
      const { data: carersData } = await supabase
        .from("carers")
        .select("id, full_name");
      const { data: typesData } = await supabase
        .from("document_types")
        .select("id, name");
      setCarers(carersData || []);
      setDocTypes(typesData || []);
      setLoadingOptions(false);
    }
    loadOptions();
  }, []);

  async function onSubmit(values: DocumentFormValues) {
    setSubmitting(true);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      form.setError("root", { message: "Not authenticated." });
      setSubmitting(false);
      return;
    }
    const { data: admin } = await supabase
      .from("admins")
      .select("org_id")
      .eq("id", userId)
      .single();

    if (!admin) {
      form.setError("root", { message: "Could not find your organization." });
      setSubmitting(false);
      return;
    }

    let filePath: string | null = null;
    if (file) {
      const path = `documents/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("applicant-documents")
        .upload(path, file);
      if (uploadError) {
        form.setError("root", { message: uploadError.message });
        setSubmitting(false);
        return;
      }
      filePath = path;
    }

    const { data: newDoc, error } = await supabase
      .from("documents")
      .insert({
        org_id: admin.org_id,
        owner_id: values.ownerId,
        document_type_id: values.documentTypeId,
        expiry_date: values.expiryDate,
        owner_type: "carer",
        file_path: filePath,
      })
      .select("id")
      .single();

    if (error) {
      form.setError("root", { message: error.message });
      setSubmitting(false);
      return;
    }

    if (filePath) {
      fetch("/api/jobs/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ai:document_ocr",
          documentId: newDoc.id,
          bucket: "applicant-documents",
          filePath,
          mimeType: file?.type || "application/pdf",
        }),
      }).catch(() => {});
    }

    router.push("/dashboard");
    toast("Document added successfully");
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Add Document</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log a compliance document for a carer.
        </p>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <Upload className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle>Document Details</CardTitle>
              <CardDescription className="mt-0.5">Fields marked * are required.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carer *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={loadingOptions ? "Loading..." : "Select carer"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingOptions ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : (
                          carers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={loadingOptions ? "Loading..." : "Select document type"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingOptions ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : (
                          docTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date *</FormLabel>
                    <FormControl>
                      <Input type="date" className="rounded-xl" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label className="text-sm font-medium">Document File</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="rounded-xl mt-1.5 cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
                <p className="mt-1 text-xs text-muted-foreground">Upload a PDF or image of the document (optional).</p>
              </div>

              {form.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" className="rounded-xl" onClick={() => router.push("/dashboard")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="rounded-xl">
                  {submitting ? "Saving..." : "Add Document"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
