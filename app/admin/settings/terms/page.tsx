"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AdminTermsManager() {
  const supabase = createClient();
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadTerms() {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "loan_terms_pdf_url")
        .single();

      if (data?.value) setPdfUrl(data.value);
    }
    loadTerms();
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setStatus("Please upload a PDF file.");
      return;
    }

    setUploading(true);
    setStatus("Uploading terms PDF...");

    try {
      const filePath = `terms/loan_terms_${Date.now()}.pdf`;

      // 1. Upload file to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { contentType: "application/pdf", upsert: true });

      if (uploadErr) throw uploadErr;

      // 2. Obtain Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // 3. Upsert into system_settings
      const { error: dbErr } = await supabase
        .from("system_settings")
        .upsert({ key: "loan_terms_pdf_url", value: publicUrl, updated_at: new Date().toISOString() });

      if (dbErr) throw dbErr;

      setPdfUrl(publicUrl);
      setStatus("Terms and conditions successfully updated!");
    } catch (err: any) {
      setStatus(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, padding: 24, background: "var(--bg-card)", borderRadius: 12 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        Loan Terms & Conditions Manager
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
          Upload New Loan Terms (PDF):
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          disabled={uploading}
        />
      </div>

      {status && <p style={{ fontSize: 13, color: "var(--text-sub)" }}>{status}</p>}

      {pdfUrl && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 14, marginBottom: 8 }}>Current Active Document:</h4>
          <iframe
            src={pdfUrl}
            style={{ width: "100%", height: "400px", border: "1px solid var(--border-color)", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}