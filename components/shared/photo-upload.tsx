"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera, Loader2 } from "lucide-react";

type PhotoUploadProps = {
  clientId: string;
  currentPhotoUrl?: string | null;
  clientName: string;
};

export function PhotoUpload({ clientId, currentPhotoUrl, clientName }: PhotoUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const supabase = createClient();
    const path = `client-photos/${clientId}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("applicant-documents").upload(path, file);
    if (uploadError) { setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("applicant-documents").getPublicUrl(path);
    await supabase.from("clients").update({ photo_url: urlData.publicUrl }).eq("id", clientId);
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {currentPhotoUrl ? (
        <img src={currentPhotoUrl} alt={clientName} className="h-14 w-14 rounded-2xl object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-xl font-bold text-primary">{clientName.charAt(0)}</span>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/0 group-hover:bg-black/20 transition-colors">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : (
          <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}
