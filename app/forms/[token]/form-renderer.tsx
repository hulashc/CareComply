"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface FieldUpload {
  uploading: boolean;
  filePath: string | null;
  fileName: string | null;
  error: string | null;
}

export default function FormRenderer({ schema, token }: { schema: any; token: string }) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [uploads, setUploads] = useState<Record<string, FieldUpload>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFileChange(fieldName: string, file: File | null) {
    if (!file) {
      setUploads((prev) => ({ ...prev, [fieldName]: { uploading: false, filePath: null, fileName: null, error: null } }));
      return;
    }

    setUploads((prev) => ({
      ...prev,
      [fieldName]: { uploading: true, filePath: null, fileName: file.name, error: null },
    }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fieldName", fieldName);

    try {
      const res = await fetch(`/api/forms/${token}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploads((prev) => ({
          ...prev,
          [fieldName]: { uploading: false, filePath: null, fileName: file.name, error: data.error || "Upload failed" },
        }));
        return;
      }
      setUploads((prev) => ({
        ...prev,
        [fieldName]: { uploading: false, filePath: data.filePath, fileName: data.fileName, error: null },
      }));
      setValues((prev) => ({ ...prev, [fieldName]: data.filePath }));
    } catch {
      setUploads((prev) => ({
        ...prev,
        [fieldName]: { uploading: false, filePath: null, fileName: file.name, error: "Network error" },
      }));
    }
  }

  function handleChange(name: string, value: any) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/forms/${token}/submit`, {
      method: "POST",
      body: JSON.stringify(values),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
        </div>
        <h3 className="text-lg font-semibold">Submitted</h3>
        <p className="text-sm text-muted-foreground">Your document has been submitted for review.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.fields.map((field: any) => {
        const fUpload = uploads[field.name];

        return (
          <div key={field.name} className="grid gap-1.5">
            <Label>{field.label}</Label>
            {field.type === "file" ? (
              <div className="space-y-2">
                <Input
                  type="file"
                  required={field.required}
                  onChange={(e) => handleFileChange(field.name, e.target.files?.[0] || null)}
                  className="rounded-lg"
                  disabled={fUpload?.uploading}
                />
                {fUpload?.uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading {fUpload.fileName}...
                  </div>
                )}
                {fUpload?.filePath && !fUpload.uploading && (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Uploaded: {fUpload.fileName}
                  </div>
                )}
                {fUpload?.error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {fUpload.error}
                  </div>
                )}
              </div>
            ) : (
              <Input
                type={field.type}
                required={field.required}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="rounded-lg"
              />
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" className="w-full rounded-lg" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
      </Button>
    </form>
  );
}
