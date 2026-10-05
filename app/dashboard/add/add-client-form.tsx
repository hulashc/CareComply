"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useToast } from "@/components/shared/toast";

import { clientSchema, ClientFormValues } from "@/lib/schemas/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

export default function AddClientForm() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: "", dob: "", address: "",
      emergencyContactName: "", emergencyContactPhone: "", careNotes: "",
    },
  });

  async function onSubmit(values: ClientFormValues) {
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

    if (!admin?.org_id) {
      form.setError("root", { message: "Could not find your organization." });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("clients").insert({
      org_id: admin.org_id,
      full_name: values.fullName,
      dob: values.dob || null,
      address: values.address || null,
      emergency_contact_name: values.emergencyContactName || null,
      emergency_contact_phone: values.emergencyContactPhone || null,
      care_notes: values.careNotes || null,
    });

    if (error) {
      form.setError("root", { message: error.message });
      setSubmitting(false);
      return;
    }

    form.reset();
    toast("Client added successfully");
    setSubmitting(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name *</FormLabel>
              <FormControl>
                <Input placeholder="John Smith" className="rounded-xl" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dob"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input type="date" className="rounded-xl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 High Street, London" className="rounded-xl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="emergencyContactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency Contact</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Smith" className="rounded-xl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergencyContactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+44 7700 900000" className="rounded-xl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="careNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Care Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Special requirements, allergies, preferences..." className="rounded-xl" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={submitting} className="rounded-xl">
            {submitting ? "Saving..." : "Add Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
