import { createClient } from "@/lib/supabase/client";

/**
 * Uploads a wash photo (before/after) to the `wash-photos` storage bucket
 * and returns its public URL, or null if the upload failed.
 */
export async function uploadWashPhoto(file: File, kind: "before" | "after", plate: string): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const safePlate = plate.replace(/[^a-zA-Z0-9-]/g, "_") || "unknown";
  const path = `${kind}/${safePlate}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("wash-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("Photo upload failed:", error.message);
    return null;
  }
  const { data } = supabase.storage.from("wash-photos").getPublicUrl(path);
  return data.publicUrl;
}
