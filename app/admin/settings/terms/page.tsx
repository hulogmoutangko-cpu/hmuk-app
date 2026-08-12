"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  FileUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";

export default function AdminTermsManager() {
  const supabase = createClient();
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info" | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    async function loadTerms() {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "loan_terms_pdf_url")
          .maybeSingle();

        if (data?.value) setPdfUrl(data.value);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadTerms();
  }, [supabase]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setStatus({
        type: "error",
        message: "Invalid file format. Please upload a PDF file.",
      });
      return;
    }

    setUploading(true);
    setStatus({ type: "info", message: "Uploading document to storage..." });

    try {
      const filePath = `terms/loan_terms_${Date.now()}.pdf`;

      // 1. Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { contentType: "application/pdf", upsert: true });

      if (uploadErr) throw uploadErr;

      // 2. Get Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);

      // 3. Save reference in system_settings
      const { error: dbErr } = await supabase.from("system_settings").upsert(
        {
          key: "loan_terms_pdf_url",
          value: publicUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

      if (dbErr) throw dbErr;

      setPdfUrl(publicUrl);
      setStatus({
        type: "success",
        message: "Loan Terms & Conditions updated successfully!",
      });
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message || "Failed to update loan terms document.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        {/* Navigation Bar */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-sub)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={16} /> Back to Admin
          </Link>
        </div>

        {/* Header Block */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              margin: "0 0 6px",
              color: "var(--text-main)",
            }}
          >
            Loan Terms & Conditions Management
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 14 }}>
            Upload and update the official PDF document presented to borrowers upon application submission.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* File Upload Card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: "0 0 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FileUp size={20} color="#3b82f6" /> Upload Document
            </h2>

            {/* Custom Dropzone / Upload Box */}
            <label
              htmlFor="pdf-upload"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "32px 16px",
                border: "2px dashed var(--border-color)",
                borderRadius: 12,
                background: "var(--bg-card-hover)",
                cursor: uploading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                textAlign: "center",
              }}
            >
              {uploading ? (
                <Loader2 size={32} className="animate-spin" color="#3b82f6" />
              ) : (
                <FileText size={36} color="var(--text-sub)" />
              )}
              <div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-main)",
                    display: "block",
                  }}
                >
                  {uploading ? "Processing PDF..." : "Click to select new PDF"}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-sub)",
                    marginTop: 2,
                    display: "block",
                  }}
                >
                  Supports PDF files up to 10MB
                </span>
              </div>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>

            {/* Status Feedback Message */}
            {status.type && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background:
                    status.type === "success"
                      ? "rgba(16, 185, 129, 0.1)"
                      : status.type === "error"
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(59, 130, 246, 0.1)",
                  border: `1px solid ${
                    status.type === "success"
                      ? "rgba(16, 185, 129, 0.3)"
                      : status.type === "error"
                      ? "rgba(239, 68, 68, 0.3)"
                      : "rgba(59, 130, 246, 0.3)"
                  }`,
                  color:
                    status.type === "success"
                      ? "#10b981"
                      : status.type === "error"
                      ? "#ef4444"
                      : "#3b82f6",
                }}
              >
                {status.type === "success" && <CheckCircle2 size={16} />}
                {status.type === "error" && <AlertCircle size={16} />}
                {status.type === "info" && <Loader2 size={16} className="animate-spin" />}
                <span>{status.message}</span>
              </div>
            )}
          </div>

          {/* Active Preview Card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <FileText size={20} color="#f59e0b" /> Active Terms Document
              </h2>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#3b82f6",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    textDecoration: "none",
                  }}
                >
                  Open Full File <ExternalLink size={12} />
                </a>
              )}
            </div>

            {loading ? (
              <div
                style={{
                  height: 380,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-sub)",
                  fontSize: 13,
                }}
              >
                Loading current configuration...
              </div>
            ) : pdfUrl ? (
              <div
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--border-color)",
                  background: "#1e293b",
                }}
              >
                <iframe
                  src={`${pdfUrl}#toolbar=0`}
                  style={{ width: "100%", height: 380, border: "none" }}
                  title="Current Active Terms"
                />
              </div>
            ) : (
              <div
                style={{
                  height: 200,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "var(--text-sub)",
                  fontSize: 13,
                  border: "1px dashed var(--border-color)",
                  borderRadius: 8,
                }}
              >
                <AlertCircle size={24} />
                <span>No active PDF document uploaded yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}