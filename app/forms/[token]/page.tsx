import { Suspense } from "react";
import FormPageContent from "./form-page-content";

export default function FormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          Loading...
        </div>
      }
    >
      <FormPageContentWrapper params={params} />
    </Suspense>
  );
}

async function FormPageContentWrapper({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <FormPageContent token={token} />;
}
