import { CarerWizard } from "@/components/forms/carer-wizard";

export default function AddCarerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Add Carer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record employment, right-to-work, DBS and references in one place.
        </p>
      </div>
      <CarerWizard />
    </div>
  );
}
