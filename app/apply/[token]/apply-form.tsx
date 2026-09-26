"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicationSchema, ApplicationFormValues } from "@/lib/schemas/application";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Personal", "Right to Work", "Documents", "Bank & Next of Kin", "Declaration"];

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <nav aria-label="Application progress" className="mb-8">
      <ol className="flex items-center gap-1">
        {steps.map((_, i) => (
          <li key={i} className="flex items-center gap-1 flex-1">
            <div
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        Step {currentStep + 1} of {steps.length} &mdash; {steps[currentStep]}
      </p>
    </nav>
  );
}

function FileUpload({ token, category, label }: { token: string; category: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [fileName, setFileName] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    const res = await fetch(`/api/applications/${token}/upload`, { method: "POST", body: formData });
    setStatus(res.ok ? "done" : "error");
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        className="rounded-xl cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
      />
      {status === "uploading" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading {fileName}...
        </p>
      )}
      {status === "done" && (
        <p className="text-xs text-green-600 flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          Uploaded: {fileName}
        </p>
      )}
      {status === "error" && <p className="text-xs text-destructive">Upload failed &mdash; try again.</p>}
    </div>
  );
}

export default function ApplyForm() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      fullName: "", address: "", postcode: "", phone: "", email: "",
      dateOfBirth: "", nationalInsuranceNumber: "",
      rightToWorkUk: "yes", isUkEeaCitizen: "yes",
      isSponsoredVisa: "no", visaStatus: "", visaNumber: "", sharecode: "",
      countryOfOrigin: "", studentVisaTermDates: "",
      bankAccountName: "", bankAccountNumber: "", bankSortCode: "",
      hasDrivingLicence: "no", drivingLicenceExpiry: "",
      nextOfKinName: "", nextOfKinPhone: "", nextOfKinRelationship: "",
      referee1Name: "", referee1Relationship: "", referee1Contact: "",
      referee2Name: "", referee2Relationship: "", referee2Contact: "",
      hasConvictionsToDisclose: "no", convictionDetails: "",
      consentsToDbsCheck: false,
      signatureTypedName: "", declarationAccepted: false,
    },
  });

  useEffect(() => {
    async function loadApplication() {
      const res = await fetch(`/api/applications/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      form.setValue("fullName", data.application.full_name || "");
      form.setValue("email", data.application.email || "");
      setLoading(false);
    }
    loadApplication();
  }, [token]);

  const isUkEeaCitizen = form.watch("isUkEeaCitizen");

  async function onSubmit(values: ApplicationFormValues) {
    setSubmitting(true);
    setSubmitError("");

    const res = await fetch(`/api/applications/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json();
      setSubmitError(data.error || "Something went wrong");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading application...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader>
            <CardTitle className="text-destructive">Link Not Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{loadError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card className="rounded-2xl shadow-card border-0 text-center">
          <CardContent className="flex flex-col items-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mt-6 text-xl font-bold tracking-tight">Application Submitted</h2>
            <p className="mt-2 text-muted-foreground">
              Thank you. Your application is now pending review.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader>
          <StepIndicator currentStep={step} steps={STEPS} />
          <CardTitle className="text-xl font-bold tracking-tight">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {step === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem className="sm:col-span-2"><FormLabel>Full Name *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                    <FormItem><FormLabel>Date of Birth *</FormLabel>
                      <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nationalInsuranceNumber" render={({ field }) => (
                    <FormItem><FormLabel>NI Number *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="sm:col-span-2"><FormLabel>Address *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="postcode" render={({ field }) => (
                    <FormItem><FormLabel>Postcode *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem className="sm:col-span-2"><FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <FormField control={form.control} name="rightToWorkUk" render={({ field }) => (
                    <FormItem><FormLabel>Do you have the right to work in the UK? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="isUkEeaCitizen" render={({ field }) => (
                    <FormItem><FormLabel>Are you a UK/EEA citizen? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />

                  {isUkEeaCitizen === "no" && (
                    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                      <p className="text-sm font-medium text-amber-800">
                        Since you&apos;re not a UK/EEA citizen, please provide visa details:
                      </p>
                      <FormField control={form.control} name="visaStatus" render={({ field }) => (
                        <FormItem><FormLabel>Visa Status</FormLabel>
                          <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="visaNumber" render={({ field }) => (
                        <FormItem><FormLabel>Visa Number</FormLabel>
                          <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="sharecode" render={({ field }) => (
                        <FormItem><FormLabel>Sharecode</FormLabel>
                          <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="countryOfOrigin" render={({ field }) => (
                        <FormItem><FormLabel>Country of Origin</FormLabel>
                          <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="studentVisaTermDates" render={({ field }) => (
                        <FormItem><FormLabel>Student Visa Term Dates (if applicable)</FormLabel>
                          <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  )}

                  <FormField control={form.control} name="hasDrivingLicence" render={({ field }) => (
                    <FormItem><FormLabel>Do you hold a driving licence?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  {form.watch("hasDrivingLicence") === "yes" && (
                    <FormField control={form.control} name="drivingLicenceExpiry" render={({ field }) => (
                      <FormItem><FormLabel>Licence Expiry Date</FormLabel>
                        <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <FileUpload token={token} category="passport" label="Passport / Photo ID *" />
                  <FileUpload token={token} category="address_proof" label="Proof of Address *" />
                  {isUkEeaCitizen === "no" && (
                    <>
                      <FileUpload token={token} category="visa_brp" label="Visa / BRP Copy" />
                      <FileUpload token={token} category="other" label="Evidence of English Language" />
                      <FileUpload token={token} category="other" label="Academic Qualifications" />
                    </>
                  )}
                  <FileUpload token={token} category="driving_licence" label="Driving Licence (if applicable)" />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <FormField control={form.control} name="bankAccountName" render={({ field }) => (
                    <FormItem><FormLabel>Bank Account Name *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="bankAccountNumber" render={({ field }) => (
                    <FormItem><FormLabel>Account Number *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="bankSortCode" render={({ field }) => (
                    <FormItem><FormLabel>Sort Code *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nextOfKinName" render={({ field }) => (
                    <FormItem><FormLabel>Next of Kin Name *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nextOfKinPhone" render={({ field }) => (
                    <FormItem><FormLabel>Next of Kin Phone *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nextOfKinRelationship" render={({ field }) => (
                    <FormItem><FormLabel>Relationship *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
                    <p className="text-sm font-medium">Referee 1 (last/current employer) *</p>
                    <FormField control={form.control} name="referee1Name" render={({ field }) => (
                      <FormItem><FormLabel>Name</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="referee1Relationship" render={({ field }) => (
                      <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="referee1Contact" render={({ field }) => (
                      <FormItem><FormLabel>Contact</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
                    <p className="text-sm font-medium">Referee 2 *</p>
                    <FormField control={form.control} name="referee2Name" render={({ field }) => (
                      <FormItem><FormLabel>Name</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="referee2Relationship" render={({ field }) => (
                      <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="referee2Contact" render={({ field }) => (
                      <FormItem><FormLabel>Contact</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="hasConvictionsToDisclose" render={({ field }) => (
                    <FormItem><FormLabel>Do you have any convictions to disclose? *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  {form.watch("hasConvictionsToDisclose") === "yes" && (
                    <FormField control={form.control} name="convictionDetails" render={({ field }) => (
                      <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="consentsToDbsCheck" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 rounded-xl border p-4">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel>I consent to an enhanced DBS check *</FormLabel><FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="signatureTypedName" render={({ field }) => (
                    <FormItem><FormLabel>Type your full name as signature *</FormLabel>
                      <FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="declarationAccepted" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 rounded-xl border p-4">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel>I declare the information given is true and accurate *</FormLabel><FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              {submitError && <p className="text-sm text-destructive">{submitError}</p>}

              <div className="flex justify-between pt-4">
                <Button type="button" variant="ghost" disabled={step === 0} className="rounded-xl gap-2"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button type="button" className="rounded-xl gap-2" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={submitting} className="rounded-xl">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
