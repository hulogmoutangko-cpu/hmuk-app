"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import SignaturePad, { SignaturePadHandle } from "../../signature-pad";

export default function ReferralApplyPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const supabase = createClient();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [validCode, setValidCode] = useState<boolean | null>(null);
  const [rates, setRates] = useState<{ base: number; referral: number } | null>(
    null
  );

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [principal, setPrincipal] = useState("");
  const [termMonths, setTermMonths] = useState("3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: nameData }, { data: rateData }] = await Promise.all([
        supabase.rpc("get_referrer_name", { code }),
        supabase.rpc("get_loan_rates"),
      ]);

      if (nameData && nameData.length > 0) {
        const n = nameData[0];
        setReferrerName(
          [n.first_name, n.last_name].filter(Boolean).join(" ") || "A co-op member"
        );
        setValidCode(true);
      } else {
        setValidCode(false);
      }

      if (rateData && rateData.length > 0) {
        setRates({
          base: Number(rateData[0].base_rate),
          referral: Number(rateData[0].referral_rate),
        });
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!rates) {
      setError("Couldn't load current loan rates. Refresh and try again.");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Please sign to confirm this loan application.");
      return;
    }

    setLoading(true);

    const { data: ownerId } = await supabase.rpc("referral_code_owner", {
      code,
    });

    if (!ownerId) {
      setError("This referral link is no longer valid.");
      setLoading(false);
      return;
    }

    try {
      const blob = await sigRef.current.getBlob();
      if (!blob) throw new Error("Couldn't capture the signature.");

      const path = `referral/${code}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("loan-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("loan-signatures").getPublicUrl(path);

      const { error: insertError } = await supabase.from("loans").insert({
        borrower_type: "non_member",
        borrower_name: name,
        borrower_contact: contact,
        referred_by: ownerId,
        referral_code_used: code,
        principal_amount: Number(principal),
        term_months: Number(termMonths),
        base_interest_rate: rates.base,
        referral_fee_rate: rates.referral,
        signature_url: publicUrl,
        status: "pending",
      });

      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Calculated rate and totals
  const totalRate = rates ? rates.base + rates.referral : 0;
  const principalNum = Number(principal) || 0;
  const termNum = Number(termMonths) || 1;
  const monthlyInterest = principalNum * (totalRate / 100);
  const totalInterest = monthlyInterest * termNum;

  if (validCode === false) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          background: "var(--bg-main)",
        }}
      >
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            padding: 32,
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
            Invalid Referral Link
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: 14, margin: 0 }}>
            This referral link is invalid or has expired. Please request a new link from the member who invited you.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          background: "var(--bg-main)",
        }}
      >
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            padding: 32,
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
            Application Submitted
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Thank you, <strong>{name}</strong>! Your referral loan application has been received and queued for review. You will be contacted via <strong>{contact}</strong> once processed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "var(--bg-main)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: 16,
          padding: 28,
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
        }}
      >
        {/* Referrer Badge */}
        {referrerName && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#3b82f6",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            👤 Referred by: {referrerName}
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            Apply for a Referral Loan
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            {rates
              ? `Effective Rate: ${totalRate.toFixed(2)}% per month.`
              : "Loading current rates..."}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {/* Full Name */}
          <div>
            <label
              htmlFor="name"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-sub)",
                marginBottom: 6,
              }}
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Contact Information */}
          <div>
            <label
              htmlFor="contact"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-sub)",
                marginBottom: 6,
              }}
            >
              Contact Number or Email
            </label>
            <input
              id="contact"
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="09xx xxx xxxx / juan@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Loan Amount */}
          <div>
            <label
              htmlFor="principal"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-sub)",
                marginBottom: 6,
              }}
            >
              Loan Amount (₱)
            </label>
            <input
              id="principal"
              type="number"
              min="1"
              step="0.01"
              required
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Term Months */}
          <div>
            <label
              htmlFor="termMonths"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-sub)",
                marginBottom: 6,
              }}
            >
              Loan Term (Months)
            </label>
            <input
              id="termMonths"
              type="number"
              min="1"
              step="1"
              required
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Calculation Summary Card */}
          {rates && principalNum > 0 && termNum > 0 && (
            <div
              style={{
                background: "var(--bg-card-hover)",
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                padding: 12,
                display: "grid",
                gap: 6,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-sub)" }}>Monthly Interest ({totalRate.toFixed(2)}%):</span>
                <strong>
                  ₱
                  {monthlyInterest.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-sub)" }}>
                  Total Interest ({termNum} month{termNum === 1 ? "" : "s"}):
                </span>
                <strong style={{ color: "#10b981" }}>
                  ₱
                  {totalInterest.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
            </div>
          )}

          {/* Signature Area */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-sub)",
                marginBottom: 6,
              }}
            >
              Borrower Signature
            </label>
            <div
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              <SignaturePad ref={sigRef} width={420} height={140} />
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading || !rates}
            className="btn-approve-sm"
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 600,
              marginTop: 4,
              height: 44,
            }}
          >
            {loading ? "Submitting Application..." : "Submit Referral Application"}
          </button>
        </form>
      </div>
    </div>
  );
}