import { UpdatePasswordForm } from "@/components/update-password-form";
import { AuthRightPanel } from "@/components/shared/auth-right-panel";

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-4xl flex-col items-center gap-10">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">CareComply</h1>
          <p className="mt-2 text-lg text-muted-foreground">Clinical-grade compliance for care homes</p>
        </div>

        <div className="flex w-full overflow-hidden rounded-2xl border border-border/50 shadow-2xl bg-card">
          <div className="flex flex-1 items-center justify-center px-10 py-16">
            <div className="w-full max-w-xs">
              <UpdatePasswordForm />
            </div>
          </div>
          <AuthRightPanel />
        </div>
      </div>
    </div>
  );
}
