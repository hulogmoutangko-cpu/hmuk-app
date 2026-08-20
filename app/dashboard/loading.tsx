export default function DashboardLoading() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
      color: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Glassmorphism Card Container */}
      <div style={{
        position: "relative",
        padding: "40px 60px",
        borderRadius: "24px",
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
      }}>
        
        {/* Outer Glowing Ring & Spinner */}
        <div style={{ position: "relative", width: "64px", height: "64px" }}>
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent, #3b82f6, #10b981)",
            animation: "spin 1.2s linear infinite",
            filter: "blur(4px)",
            opacity: 0.7,
          }} />
          <div style={{
            position: "absolute",
            inset: "4px",
            borderRadius: "50%",
            background: "#0f172a",
          }} />
          <div style={{
            position: "absolute",
            inset: "4px",
            borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#3b82f6",
            borderRightColor: "#10b981",
            animation: "spin 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite",
          }} />
        </div>

        {/* Text and Branding */}
        <div style={{ textAlign: "center" }}>
          <h2 style={{
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "0.5px",
            margin: "0 0 6px 0",
            background: "linear-gradient(135deg, #60a5fa 0%, #34d399 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "pulse 2s ease-in-out infinite",
          }}>
            Cooperative Portal
          </h2>
          <p style={{
            fontSize: "13px",
            color: "#94a3b8",
            margin: 0,
            fontWeight: 400,
          }}>
            Securely syncing your accounts...
          </p>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}