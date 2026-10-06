import { UpdatePasswordForm } from "@/components/update-password-form";
import { AuthRightPanel } from "@/components/shared/auth-right-panel";

export default function UpdatePasswordPage() {
  return (
    <div className="hero-bg flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-4xl flex-col items-center gap-10">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white">CareComply</h1>
          <p className="mt-2 font-serif text-lg font-light text-white/85">Clinical-grade compliance for care homes</p>
        </div>

        <div className="flex w-full overflow-hidden rounded-md shadow-elevated bg-card">
          <div className="flex flex-1 items-center justify-center px-10 py-16">
            <div className="w-full max-w-xs">
              <UpdatePasswordForm />
            </div>
          </div>
          <AuthRightPanel image="/images/auth-hands.jpg" />
        </div>
      </div>
    </div>
  );
}
