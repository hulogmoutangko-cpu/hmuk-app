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
        padding: "40px 60px",
        borderRadius: "24px",
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
      }}>
        
        {/* GIF Loader */}
        <img 
          src="/loading.gif" 
          alt="Loading..." 
          style={{ width: "80px", height: "80px", objectFit: "contain" }} 
        />

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
    </div>
  );
}