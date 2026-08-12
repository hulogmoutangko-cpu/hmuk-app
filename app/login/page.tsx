"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Shared state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signup-only state
  const [inviteCode, setInviteCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Signature Pad state & refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Initialize Signature Canvas context
  useEffect(() => {
    if (mode === "signup" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [mode]);

  // Handle Photo Capture from Phone Camera
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  // Canvas Mouse & Touch Drawing Handlers
  function getCoordinates(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDrawing(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    setIsDrawing(true);
    setHasSignature(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      const { x, y } = getCoordinates(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }

  function draw(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      const { x, y } = getCoordinates(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  }

  // Convert Canvas Signature Drawing to File Blob
  function getSignatureFile(): Promise<File | null> {
    return new Promise((resolve) => {
      if (!canvasRef.current || !hasSignature) {
        resolve(null);
        return;
      }
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `signature-${Date.now()}.png`, {
            type: "image/png",
          });
          resolve(file);
        } else {
          resolve(null);
        }
      }, "image/png");
    });
  }

  async function uploadFile(
    bucket: "avatars" | "signatures",
    userId: string,
    file: File
  ) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${bucket === "avatars" ? "avatar" : "signature"}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let signatureFileToUpload: File | null = null;

    if (mode === "signup") {
      if (!inviteCode.trim()) {
        setError("An invite code is required to sign up.");
        return;
      }
      if (!firstName || !lastName) {
        setError("First and last name are required.");
        return;
      }
      if (!avatarFile) {
        setError("A photo is required. Please take a picture.");
        return;
      }

      signatureFileToUpload = await getSignatureFile();
      if (!signatureFileToUpload) {
        setError("Please provide a signature on the signature pad.");
        return;
      }
    }

    setLoading(true);

    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        setError(error?.message ?? "Sign in failed.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      router.push(profile?.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
      return;
    }

    // ---- Signup Flow ----

    // 1. Validate Invite Code
    const { data: invite, error: inviteError } = await supabase
      .from("invitations")
      .select("id, is_used, expires_at")
      .eq("code", inviteCode.trim().toUpperCase())
      .single();

    if (inviteError || !invite) {
      setError("Invalid invitation code.");
      setLoading(false);
      return;
    }

    if (invite.is_used) {
      setError("This invite code has already been used.");
      setLoading(false);
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      setError("This invite code has expired.");
      setLoading(false);
      return;
    }

    // 2. Perform Supabase Sign Up
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Sign up failed.");
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError(
        "Account created, but email confirmation is enabled in Supabase so files couldn't be uploaded."
      );
      setLoading(false);
      return;
    }

    try {
      // 3. Mark Invite Code as Used
      await supabase
        .from("invitations")
        .update({ is_used: true })
        .eq("id", invite.id);

      // 4. Upload Files & Update Profile
      const [avatarUrl, signatureUrl] = await Promise.all([
        uploadFile("avatars", data.user.id, avatarFile as File),
        uploadFile("signatures", data.user.id, signatureFileToUpload as File),
      ]);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          profile_picture_url: avatarUrl,
          signature_url: signatureUrl,
        })
        .eq("id", data.user.id);

      if (profileError) throw profileError;
    } catch (err: any) {
      setError(
        `Account created, but saving photo/signature failed: ${err.message}`
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const pageContainerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    background: "var(--bg-main)",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    borderRadius: 16,
    padding: 28,
    maxWidth: 440,
    width: "100%",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border-color)",
    background: "var(--bg-card-hover)",
    color: "var(--text-main)",
    fontSize: 14,
    outline: "none",
  };

  return (
    <div style={pageContainerStyle}>
      <div style={cardStyle}>
        {/* Header with Logo */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Image
              src="/icons/logo.png"
              alt="HMUK Logo"
              width={80}
              height={80}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <span className="badge user" style={{ marginBottom: 8 }}>
            HMUK PORTAL
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>
            {mode === "signin" ? "Welcome Back" : "Create an Account"}
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            {mode === "signin"
              ? "Sign in to access your member dashboard."
              : "Complete your profile information to join."}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            padding: 4,
            background: "var(--bg-card-hover)",
            borderRadius: 10,
            marginBottom: 20,
            border: "1px solid var(--border-color)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            style={{
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              background: mode === "signin" ? "var(--bg-card)" : "transparent",
              color: mode === "signin" ? "var(--text-main)" : "var(--text-sub)",
              boxShadow: mode === "signin" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            style={{
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              background: mode === "signup" ? "var(--bg-card)" : "transparent",
              color: mode === "signup" ? "var(--text-main)" : "var(--text-sub)",
              boxShadow: mode === "signup" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {mode === "signup" && (
            <>
              <div>
                <label
                  htmlFor="inviteCode"
                  style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}
                >
                  Invite Code
                </label>
                <input
                  id="inviteCode"
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HMUK-8F2A9B"
                  style={{ ...inputStyle, textTransform: "uppercase" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label
                    htmlFor="firstName"
                    style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}
                  >
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Juan"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}
                  >
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dela Cruz"
                    style={inputStyle}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="email"
              style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {mode === "signup" && (
            <>
              {/* Direct Camera Capture Input */}
              <div>
                <label
                  htmlFor="avatar"
                  style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}
                >
                  Take Profile Photo (Camera)
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "var(--bg-card-hover)",
                    border: "1px solid var(--border-color)",
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                      }}
                    >
                      📷
                    </div>
                  )}
                  <input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    capture="user"
                    required
                    onChange={handleAvatarChange}
                    style={{ fontSize: 12, width: "100%" }}
                  />
                </div>
              </div>

              {/* Touch & Mouse Interactive Signature Pad */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    Draw Signature Below
                  </label>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: 8,
                    background: "#ffffff",
                    touchAction: "none",
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={120}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      width: "100%",
                      height: 120,
                      borderRadius: 8,
                      cursor: "crosshair",
                      display: "block",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-approve-sm"
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 600,
              marginTop: 6,
            }}
          >
            {loading
              ? "Processing..."
              : mode === "signin"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}