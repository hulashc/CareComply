import { createClient } from "@/lib/supabase/server";
import FormRenderer from "./form-renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default async function FormPageContent({ token }: { token: string }) {
  const supabase = await createClient();

  const { data: link, error: linkError } = await supabase
    .from("form_links")
    .select("*, form_templates(*)")
    .eq("token", token)
    .single();

  if (linkError || !link || !link.form_templates) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm rounded-xl border border-border/50 shadow-card text-center">
          <CardContent className="py-10">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Invalid or expired link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.used) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm rounded-xl border border-border/50 shadow-card text-center">
          <CardContent className="py-10">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">This form has already been submitted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (new Date(link.expires_at) < new Date()) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm rounded-xl border border-border/50 shadow-card text-center">
          <CardContent className="py-10">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">This link has expired. Please request a new one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg rounded-xl border border-border/50 shadow-card">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-bold tracking-tight">{link.form_templates.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormRenderer schema={link.form_templates.schema} token={token} />
        </CardContent>
      </Card>
    </div>
  );
}
