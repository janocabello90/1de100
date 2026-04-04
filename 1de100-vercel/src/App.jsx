import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, signUp, signIn, signOut, getProfile, updateProfile as updateProfileDB, uploadAvatar, logActivity, getTodayActivities as fetchTodayActivities, getActivitiesForRange, uploadDailyPhoto, getDailyPhotos, inviteFriend, respondFriendRequest, getFriends, getPendingRequests, createChallenge, getMyChallenges, getChallengeLeaderboard, savePushSubscription } from "./supabase";
import { requestNotificationPermission, subscribeToPush, isPushSubscribed, scheduleLocalReminder } from "./pushNotifications";

// ─── Design Tokens ───
const COLORS = {
  surface: "#0e0e0e",
  surfaceContainerLow: "#131313",
  surfaceContainer: "#1a1a1a",
  surfaceContainerHigh: "#20201f",
  surfaceContainerHighest: "#262626",
  primary: "#f3ffca",
  primaryContainer: "#cafd00",
  onPrimary: "#516700",
  onPrimaryContainer: "#4a5e00",
  secondary: "#ff7524",
  secondaryContainer: "#a04100",
  tertiary: "#ffeea5",
  tertiaryContainer: "#fce047",
  onTertiaryContainer: "#5d5000",
  onSurface: "#ffffff",
  onSurfaceVariant: "#adaaaa",
  outline: "#767575",
  outlineVariant: "#484847",
  error: "#ff7351",
  neon: "#CCFF00",
};

// ─── Exercise Data ───
const EXERCISES = [
  { id: "sentadillas", name: "Sentadillas", icon: "squat", category: "Piernas" },
  { id: "zancadas", name: "Zancadas", icon: "lunge", category: "Piernas" },
  { id: "sentadilla_sumo", name: "Sumo Squat", icon: "sports_kabaddi", category: "Piernas" },
  { id: "elevacion_cadera", name: "Puente Glúteo", icon: "airline_seat_flat", category: "Piernas" },
  { id: "steps", name: "Steps / Escalón", icon: "stairs", category: "Piernas" },
  { id: "flexiones", name: "Flexiones", icon: "fitness_center", category: "Pecho" },
  { id: "fondos_triceps", name: "Fondos Tríceps", icon: "accessibility_new", category: "Brazos" },
  { id: "flexiones_diamante", name: "Flexiones Diamante", icon: "diamond", category: "Pecho" },
  { id: "abdominales", name: "Abdominales", icon: "spo2", category: "Core" },
  { id: "plancha", name: "Plancha (seg)", icon: "timer", category: "Core" },
  { id: "mountain_climbers", name: "Mountain Climbers", icon: "landscape", category: "Core" },
  { id: "rodillas_pecho", name: "Rodillas al Pecho", icon: "sprint", category: "Core" },
  { id: "bicicleta", name: "Bicicleta (Abs)", icon: "pedal_bike", category: "Core" },
  { id: "burpees", name: "Burpees", icon: "bolt", category: "Full Body" },
  { id: "jumping_jacks", name: "Jumping Jacks", icon: "sports_gymnastics", category: "Full Body" },
  { id: "saltos", name: "Saltos", icon: "arrow_upward", category: "Full Body" },
  { id: "correr", name: "Correr (min)", icon: "directions_run", category: "Cardio" },
  { id: "caminar", name: "Caminar (min)", icon: "directions_walk", category: "Cardio" },
  { id: "superman", name: "Superman", icon: "flight", category: "Espalda" },
  { id: "wall_sit", name: "Wall Sit (seg)", icon: "wall_lamp", category: "Piernas" },
];

const TIPS = [
  { title: "10 Sentadillas esperando el café", desc: "Transforma momentos cotidianos en energía cinética.", tag: "FAST MOVE", xp: 5 },
  { title: "Pulso Post-Comida", desc: "Caminar 2 min después de comer reduce picos de azúcar un 22%.", tag: "SALUD" },
  { title: "El Dash de las Escaleras", desc: "Olvida el ascensor. 2 pisos = 30 pasos hacia tus 100.", tag: "HOT IDEA" },
  { title: "20 Zancadas por el pasillo", desc: "Cada pasillo es una pista de progreso.", tag: "FAST MOVE", xp: 3 },
  { title: "Hidratación Inteligente", desc: "Bebe un vaso de agua por cada ejercicio. La sinergia es clave.", tag: "SALUD" },
  { title: "1 min Wall Sit", desc: "Concéntrate en respirar mientras aguantas. Hazlo leyendo emails.", tag: "INTENSO" },
];

const ALL_BADGES = [
  { id: "century_club", name: "Century Club", icon: "workspace_premium", desc: "100 entrenamientos completados", condition: (s) => s.totalSessions >= 100, color: "linear-gradient(135deg, #f3ffca, #cafd00)" },
  { id: "first_100", name: "First 100", icon: "looks_one", desc: "Alcanza 100 movimientos por primera vez", condition: (s) => s.daysAt100 >= 1, color: "linear-gradient(135deg, #ff7524, #fce047)" },
  { id: "weekend_warrior", name: "Weekend Warrior", icon: "fitness_center", desc: "Entrena un sábado y domingo", condition: (s) => s.weekendDays >= 2, color: "#ff7524" },
  { id: "early_bird", name: "Early Bird", icon: "wb_sunny", desc: "Registra antes de las 8am", condition: (s) => s.earlyWorkouts >= 1, color: "#fce047" },
  { id: "squat_king", name: "Squat King", icon: "rewarded_ads", desc: "500 sentadillas totales", condition: (s) => (s.exerciseTotals?.sentadillas || 0) >= 500, color: "linear-gradient(135deg, #f3ffca, #cafd00)" },
  { id: "plank_master", name: "Plank Master", icon: "horizontal_rule", desc: "300 segundos de plancha", condition: (s) => (s.exerciseTotals?.plancha || 0) >= 300, color: COLORS.surfaceContainerHighest },
  { id: "streak_365", name: "365 Streak", icon: "calendar_month", desc: "Racha de 365 días", condition: (s) => s.maxStreak >= 365, color: COLORS.surfaceContainerHighest },
  { id: "iron_lung", name: "Iron Lung", icon: "air", desc: "1000 flexiones totales", condition: (s) => (s.exerciseTotals?.flexiones || 0) >= 1000, color: COLORS.surfaceContainerHighest },
  { id: "streak_7", name: "Semana Fuego", icon: "local_fire_department", desc: "Racha de 7 días", condition: (s) => s.maxStreak >= 7, color: "#ff7524" },
];

// ─── Helpers ───
const todayKey = () => new Date().toISOString().slice(0, 10);

function getLevel(activities) {
  const all = Array.isArray(activities) ? activities : Object.values(activities || {}).flat();
  const xp = all.reduce((s, a) => s + (a.reps || 0), 0);
  return { level: Math.floor(xp / 200) + 1, xp, nextLevelXp: (Math.floor(xp / 200) + 1) * 200, progress: (xp % 200) / 200 * 100 };
}

// ─── Icon Component ───
function Icon({ name, filled, size = 24, style = {} }) {
  return (
    <span className="material-symbols-outlined" style={{
      fontSize: size,
      fontVariationSettings: filled ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 400",
      ...style,
    }}>{name}</span>
  );
}

// ─── Bottom Nav ───
function BottomNav({ active, onNavigate }) {
  const tabs = [
    { id: "dashboard", icon: "table_chart", label: "Home" },
    { id: "activity", icon: "add_circle", label: "Activity" },
    { id: "social", icon: "group", label: "Social" },
    { id: "badges", icon: "emoji_events", label: "Badges" },
    { id: "profile", icon: "person", label: "Perfil" },
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, width: "100%", zIndex: 50,
      display: "flex", justifyContent: "space-around", alignItems: "center",
      padding: "10px 8px 24px", background: "rgba(19,19,19,0.85)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      boxShadow: "0 -10px 40px rgba(204,255,0,0.05)",
    }}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onNavigate(t.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: isActive ? COLORS.surfaceContainer : "transparent",
            color: isActive ? COLORS.neon : "#6b7280",
            opacity: isActive ? 1 : 0.6,
            borderRadius: 9999, padding: isActive ? 10 : 8,
            boxShadow: isActive ? "0 0 15px rgba(204,255,0,0.2)" : "none",
            transform: isActive ? "scale(1.1)" : "scale(1)",
            transition: "all 0.2s", border: "none", cursor: "pointer",
          }}>
            <Icon name={t.icon} filled={isActive} size={22} />
            <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 3 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Top App Bar ───
function TopBar({ onBadgeClick, avatarUrl, onProfileClick }) {
  return (
    <header style={{
      position: "fixed", top: 0, width: "100%", zIndex: 50,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "0 24px", height: 80,
      background: "linear-gradient(to bottom, #131313, transparent)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div onClick={onProfileClick} style={{
          width: 40, height: 40, borderRadius: "50%", overflow: "hidden",
          border: `2px solid ${COLORS.primaryContainer}`, background: COLORS.surfaceContainerHighest,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Icon name="person" filled size={24} style={{ color: COLORS.primary }} />
          )}
        </div>
        <h1 style={{
          fontSize: 24, fontWeight: 900, color: COLORS.neon,
          letterSpacing: "-0.05em", fontStyle: "italic",
          fontFamily: "'Space Grotesk'", margin: 0,
        }}>1 DE 100</h1>
      </div>
      <button onClick={onBadgeClick} style={{ color: COLORS.neon, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <Icon name="military_tech" size={30} />
      </button>
    </header>
  );
}

// ─── Progress Ring SVG ───
function ProgressRing({ current, total = 100, size = 288 }) {
  const r = (size / 2) - 12;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(current / total, 1);
  const offset = circumference * (1 - pct);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `12px solid ${COLORS.surfaceContainerLow}` }} />
      <svg style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", filter: "drop-shadow(0 0 20px rgba(202,253,0,0.3))" }} width={size} height={size}>
        <defs>
          <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f3ffca" />
            <stop offset="100%" stopColor="#cafd00" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="url(#neonGrad)" strokeWidth={12} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div style={{ textAlign: "center", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
          <span style={{ fontSize: 72, fontFamily: "'Space Grotesk'", fontWeight: 700, letterSpacing: "-0.05em", color: COLORS.onSurface }}>{current}</span>
          <span style={{ fontSize: 24, fontFamily: "'Space Grotesk'", fontWeight: 500, color: COLORS.outline }}>/ {total}</span>
        </div>
        <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: COLORS.primaryContainer, marginTop: 8 }}>Movimientos Hoy</p>
      </div>
    </div>
  );
}

// ─── Achievement Modal ───
function AchievementModal({ badge, level, onClose }) {
  if (!badge) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: COLORS.surface,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "25%", left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.primaryContainer}, transparent)`, opacity: 0.3, transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, background: "rgba(202,253,0,0.05)", borderRadius: "50%", filter: "blur(120px)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 400 }}>
        <div style={{ position: "relative", marginBottom: 48 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(202,253,0,0.2)", filter: "blur(40px)", borderRadius: "50%" }} />
          <div style={{
            position: "relative", width: 192, height: 192, background: COLORS.surfaceContainer,
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.05)", boxShadow: "inset 0 0 40px rgba(204,255,0,0.1)",
          }}>
            <Icon name="military_tech" filled size={96} style={{ color: "#cafd00" }} />
          </div>
          <div style={{
            position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)",
            background: COLORS.tertiaryContainer, color: COLORS.onTertiaryContainer,
            fontFamily: "'Be Vietnam Pro'", fontSize: 14, padding: "4px 16px",
            borderRadius: 9999, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em",
          }}>{badge.name}</div>
        </div>
        <div style={{ marginBottom: 64 }}>
          <h1 style={{
            fontFamily: "'Space Grotesk'", fontSize: 48, fontWeight: 900, fontStyle: "italic",
            color: COLORS.primaryContainer, letterSpacing: "-0.05em", lineHeight: 1,
            textTransform: "uppercase", textShadow: "0 0 15px rgba(204,255,0,0.6)", margin: "0 0 16px",
          }}>¡LOGRO DESBLOQUEADO!</h1>
          <p style={{ fontFamily: "'Manrope'", color: COLORS.onSurfaceVariant, fontSize: 18, fontWeight: 300, lineHeight: 1.6 }}>
            Has alcanzado el <span style={{ color: COLORS.onSurface, fontWeight: 700 }}>{badge.name}</span>. ¡Sigue así!
          </p>
        </div>
        <button onClick={onClose} style={{
          width: "100%", padding: "20px 48px", background: COLORS.primaryContainer,
          color: COLORS.onPrimaryContainer, fontFamily: "'Space Grotesk'", fontWeight: 900,
          fontStyle: "italic", fontSize: 24, borderRadius: 9999, border: "none", cursor: "pointer",
          boxShadow: "0 10px 40px rgba(202,253,0,0.3)",
        }}>¡VAMOS!</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── AUTH SCREEN (Login / Register) ───
// ═══════════════════════════════════════════════════
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) { setError("Escribe tu nombre"); setLoading(false); return; }
        if (password.length < 6) { setError("Mínimo 6 caracteres"); setLoading(false); return; }
        const { error: err } = await signUp(email, password, name.trim());
        if (err) throw err;
        setMessage("¡Revisa tu email para confirmar tu cuenta!");
        setMode("login");
      } else if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email);
        if (err) throw err;
        setMessage("Te hemos enviado un enlace para restablecer tu contraseña.");
        setMode("login");
      } else {
        const { data, error: err } = await signIn(email, password);
        if (err) throw err;
        onAuth(data.session);
      }
    } catch (err) {
      setError(err.message || "Error inesperado");
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "16px 20px", borderRadius: 16,
    background: COLORS.surfaceContainerLow, border: `1px solid ${COLORS.outlineVariant}`,
    color: COLORS.onSurface, fontFamily: "'Manrope'", fontSize: 16, outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.surface, color: COLORS.onSurface,
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "48px 32px", maxWidth: 440, margin: "0 auto",
    }}>
      {/* Background glow */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 400, height: 400, background: "rgba(202,253,0,0.05)", borderRadius: "50%", filter: "blur(120px)", pointerEvents: "none" }} />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 48, position: "relative", zIndex: 10 }}>
        <h1 style={{
          fontFamily: "'Space Grotesk'", fontSize: 56, fontWeight: 900, fontStyle: "italic",
          letterSpacing: "-0.05em", color: COLORS.neon, margin: "0 0 8px",
          textShadow: "0 0 30px rgba(204,255,0,0.3)",
        }}>1 DE 100</h1>
        <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: COLORS.onSurfaceVariant }}>
          Un cuerpo en forma, una mente en calma
        </p>
      </div>

      {/* Form */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", gap: 16 }}>
        {mode === "register" && (
          <input
            type="text" placeholder="Tu nombre" value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        {mode !== "forgot" && (
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={inputStyle}
          />
        )}

        {error && (
          <div style={{
            background: "rgba(255,115,81,0.1)", border: `1px solid ${COLORS.error}40`,
            borderRadius: 12, padding: "12px 16px", fontFamily: "'Manrope'", fontSize: 14, color: COLORS.error,
          }}>{error}</div>
        )}
        {message && (
          <div style={{
            background: "rgba(202,253,0,0.1)", border: `1px solid ${COLORS.primaryContainer}40`,
            borderRadius: 12, padding: "12px 16px", fontFamily: "'Manrope'", fontSize: 14, color: COLORS.primaryContainer,
          }}>{message}</div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: "100%", padding: 20, borderRadius: 9999, border: "none", cursor: loading ? "wait" : "pointer",
          background: loading ? COLORS.surfaceContainerHighest : "linear-gradient(90deg, #f3ffca, #cafd00)",
          color: COLORS.onPrimaryContainer, fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18,
          boxShadow: loading ? "none" : "0 10px 30px rgba(202,253,0,0.3)", transition: "all 0.3s",
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "Cargando..." : mode === "login" ? "Entrar" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}
        </button>

        {/* Toggle links */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 8 }}>
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("register"); setError(null); }} style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "'Manrope'", fontSize: 15, color: COLORS.primary,
              }}>¿No tienes cuenta? <span style={{ fontWeight: 700 }}>Regístrate</span></button>
              <button onClick={() => { setMode("forgot"); setError(null); }} style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "'Manrope'", fontSize: 13, color: COLORS.outline,
              }}>¿Olvidaste tu contraseña?</button>
            </>
          )}
          {mode !== "login" && (
            <button onClick={() => { setMode("login"); setError(null); }} style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'Manrope'", fontSize: 15, color: COLORS.primary,
            }}>← Volver al login</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── DASHBOARD SCREEN ───
// ═══════════════════════════════════════════════════
function DashboardScreen({ todayActivities, onNavigate }) {
  const todayTotal = todayActivities.reduce((s, a) => s + (a.reps || 0), 0);
  const remaining = Math.max(0, 100 - todayTotal);

  // Compute streak from activities (simplified — real streak comes from profile)
  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24, maxWidth: 480, margin: "0 auto" }}>
      {/* Hero: Progress Ring */}
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 32 }}>
        <ProgressRing current={Math.min(todayTotal, 100)} />
        <div style={{ width: "100%", height: 48, marginTop: 32, opacity: 0.4 }}>
          <svg viewBox="0 0 400 50" style={{ width: "100%", height: "100%", stroke: COLORS.secondary, fill: "none" }}>
            <path d="M0,25 Q25,5 50,25 T100,25 T150,25 T200,25 T250,25 T300,25 T350,25 T400,25" strokeWidth="2" />
          </svg>
        </div>
      </section>

      {/* Recent Activity */}
      <section style={{ marginTop: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Actividad Reciente</h2>
        </div>
        {todayActivities.length === 0 ? (
          <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 32, textAlign: "center" }}>
            <Icon name="fitness_center" size={40} style={{ color: COLORS.outline, marginBottom: 12 }} />
            <p style={{ color: COLORS.onSurfaceVariant, fontFamily: "'Manrope'", fontSize: 14 }}>Aún no has registrado movimientos hoy. ¡Empieza ahora!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {todayActivities.slice(0, 5).map((a, i) => {
              const ex = EXERCISES.find((e) => e.id === a.exercise_id) || EXERCISES[0];
              const pct = Math.round((a.reps / 100) * 100);
              const time = a.logged_at ? new Date(a.logged_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <div key={a.id || i} style={{
                  background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%", background: COLORS.surfaceContainerHighest,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: i === 0 ? COLORS.primary : COLORS.secondary,
                    }}>
                      <Icon name={ex.icon} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2, margin: 0 }}>{a.reps} {ex.name}</h3>
                      <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.outline, margin: "4px 0 0" }}>{time} • {ex.category}</p>
                    </div>
                  </div>
                  <span style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, color: COLORS.primaryContainer }}>+{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Motivational Card */}
      <section style={{
        marginTop: 48, background: `linear-gradient(135deg, ${COLORS.surfaceContainerLow}, ${COLORS.surfaceContainer})`,
        padding: 24, borderRadius: 16, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icon name="auto_awesome" filled style={{ color: COLORS.tertiaryContainer }} />
            <h3 style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.onSurfaceVariant, fontWeight: 700, margin: 0 }}>Tu Reto Diario</h3>
          </div>
          <p style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, maxWidth: 200, lineHeight: 1.3, margin: 0 }}>
            {remaining > 0 ? `Estás a solo ${remaining} movimientos de tu meta.` : "¡Has completado tu meta de hoy! 🔥"}
          </p>
        </div>
        <div style={{ position: "absolute", right: -40, bottom: -40, width: 160, height: 160, background: "rgba(202,253,0,0.1)", filter: "blur(60px)", borderRadius: "50%" }} />
      </section>

      {/* FAB */}
      <div style={{ position: "fixed", bottom: 112, left: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
        <button onClick={() => onNavigate("activity")} style={{
          background: "linear-gradient(90deg, #f3ffca, #cafd00)", color: COLORS.onPrimaryContainer,
          padding: "16px 32px", borderRadius: 9999, fontFamily: "'Space Grotesk'", fontWeight: 700,
          fontSize: 18, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 10px 30px rgba(202,253,0,0.3)",
        }}>
          <Icon name="add" size={24} style={{ fontVariationSettings: "'wght' 700" }} />
          Registrar Movimiento
        </button>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── ACTIVITY SCREEN ───
// ═══════════════════════════════════════════════════
function ActivityScreen({ onRegister }) {
  const [selectedExercise, setSelectedExercise] = useState("sentadillas");
  const [reps, setReps] = useState(25);
  const [inputStr, setInputStr] = useState("25");
  const [filterCat, setFilterCat] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleKeypad = (val) => {
    if (val === "back") {
      const ns = inputStr.slice(0, -1) || "0";
      setInputStr(ns); setReps(parseInt(ns) || 0);
    } else {
      const ns = inputStr === "0" ? val : inputStr + val;
      if (parseInt(ns) <= 999) { setInputStr(ns); setReps(parseInt(ns) || 0); }
    }
  };

  const handlePlusMinus = (delta) => {
    const newVal = Math.max(0, Math.min(999, reps + delta));
    setReps(newVal); setInputStr(String(newVal));
  };

  const handleConfirm = async () => {
    if (reps > 0 && !saving) {
      setSaving(true);
      await onRegister(selectedExercise, reps);
      setReps(25); setInputStr("25");
      setSaving(false);
    }
  };

  const categories = [...new Set(EXERCISES.map((e) => e.category))];

  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24, maxWidth: 448, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 30, color: COLORS.primary, letterSpacing: "-0.025em", margin: 0 }}>Añadir Movimiento</h2>
        <p style={{ fontFamily: "'Be Vietnam Pro'", color: COLORS.onSurfaceVariant, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>Registra tu progreso diario</p>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
        <button onClick={() => setFilterCat(null)} style={{
          padding: "8px 16px", borderRadius: 9999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
          background: filterCat === null ? COLORS.primaryContainer : COLORS.surfaceContainerHighest,
          color: filterCat === null ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant,
          fontFamily: "'Be Vietnam Pro'", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>Todos</button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            padding: "8px 16px", borderRadius: 9999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
            background: filterCat === cat ? COLORS.primaryContainer : COLORS.surfaceContainerHighest,
            color: filterCat === cat ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant,
            fontFamily: "'Be Vietnam Pro'", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>{cat}</button>
        ))}
      </div>

      {/* Exercise grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32, maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
        {EXERCISES.filter((ex) => !filterCat || ex.category === filterCat).map((ex) => {
          const isActive = selectedExercise === ex.id;
          return (
            <button key={ex.id} onClick={() => setSelectedExercise(ex.id)} style={{
              background: isActive ? COLORS.surfaceContainer : COLORS.surfaceContainerLow,
              border: isActive ? `2px solid ${COLORS.primaryContainer}` : "2px solid transparent",
              padding: "16px 8px", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 8, cursor: "pointer", color: isActive ? COLORS.primary : COLORS.onSurfaceVariant,
              transition: "all 0.2s", minHeight: 88,
            }}>
              <Icon name={ex.icon} filled={isActive} size={28} />
              <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>{ex.name}</span>
            </button>
          );
        })}
      </div>

      {/* Rep Counter */}
      <div style={{
        background: COLORS.surfaceContainerLow, borderRadius: 20, padding: 32,
        marginBottom: 32, textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)`, opacity: 0.3 }} />
        <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: COLORS.onSurfaceVariant, marginBottom: 16, display: "block" }}>Repeticiones totales</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, marginBottom: 24 }}>
          <button onClick={() => handlePlusMinus(-5)} style={{
            width: 56, height: 56, borderRadius: "50%", background: COLORS.surfaceContainerHighest,
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.secondary,
          }}><Icon name="remove" size={24} /></button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontFamily: "'Space Grotesk'", fontSize: 72, fontWeight: 700, lineHeight: 1 }}>{reps}</span>
            <div style={{ height: 4, width: 48, background: COLORS.primary, marginTop: 8, borderRadius: 9999, boxShadow: "0 0 10px rgba(204,255,0,0.5)" }} />
          </div>
          <button onClick={() => handlePlusMinus(5)} style={{
            width: 56, height: 56, borderRadius: "50%", background: COLORS.surfaceContainerHighest,
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.primary,
          }}><Icon name="add" size={24} /></button>
        </div>
      </div>

      {/* Numeric Keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 48 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "back", 0, "."].map((val) => (
          <button key={val}
            onClick={() => val === "back" ? handleKeypad("back") : val !== "." ? handleKeypad(String(val)) : null}
            style={{
              height: 64, borderRadius: 16, background: val === "back" ? "transparent" : COLORS.surfaceContainerHighest,
              border: "none", cursor: val === "." ? "default" : "pointer",
              fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700,
              color: val === "back" ? COLORS.onSurfaceVariant : COLORS.onSurface,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: val === "back" ? 0.4 : val === "." ? 0.3 : 1,
            }}
          >{val === "back" ? <Icon name="backspace" /> : val}</button>
        ))}
      </div>

      {/* CTA */}
      <button onClick={handleConfirm} disabled={saving} style={{
        width: "100%", padding: 20, borderRadius: 9999,
        background: saving ? COLORS.surfaceContainerHighest : "linear-gradient(90deg, #f3ffca, #cafd00)",
        color: COLORS.onPrimary, fontWeight: 700, fontSize: 18, border: "none", cursor: saving ? "wait" : "pointer",
        boxShadow: saving ? "none" : "0 10px 30px rgba(202,253,0,0.2)",
      }}>
        {saving ? "Guardando..." : "Confirmar Entrenamiento"}
      </button>
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── SOCIAL SCREEN (Friends + Challenges) ───
// ═══════════════════════════════════════════════════
function SocialScreen({ userId }) {
  const [tab, setTab] = useState("friends"); // friends | challenges | create
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendEmail, setFriendEmail] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendMsg, setFriendMsg] = useState(null);

  // Challenge creation state
  const [cTitle, setCTitle] = useState("");
  const [cExercise, setCExercise] = useState("");
  const [cTarget, setCTarget] = useState(100);
  const [cStake, setCStake] = useState("");
  const [cDays, setCDays] = useState(7);
  const [cInvited, setCInvited] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    const [f, p, c] = await Promise.all([
      getFriends(userId),
      getPendingRequests(userId),
      getMyChallenges(userId),
    ]);
    setFriends(f.data || []);
    setPending(p.data || []);
    setChallenges(c.data || []);
    setLoading(false);
  };

  const handleAddFriend = async () => {
    if (!friendEmail.trim()) return;
    setAddingFriend(true);
    setFriendMsg(null);
    const { data, error } = await inviteFriend(friendEmail.trim());
    if (error) {
      setFriendMsg({ type: "error", text: error.message || "No se pudo enviar la invitación" });
    } else {
      setFriendMsg({ type: "success", text: data?.message || "¡Invitación enviada!" });
      setFriendEmail("");
      loadData(); // refresh friend list
    }
    setAddingFriend(false);
  };

  const handleRespond = async (id, accept) => {
    await respondFriendRequest(id, accept);
    loadData();
  };

  const handleCreateChallenge = async () => {
    if (!cTitle.trim() || cInvited.length === 0) return;
    setCreating(true);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + cDays);
    await createChallenge(userId, cTitle.trim(), cExercise || null, cTarget, deadline.toISOString(), cStake, cInvited);
    setCTitle(""); setCExercise(""); setCTarget(100); setCStake(""); setCDays(7); setCInvited([]);
    setTab("challenges");
    loadData();
    setCreating(false);
  };

  const chipStyle = (active) => ({
    padding: "10px 20px", borderRadius: 9999, border: "none", cursor: "pointer",
    background: active ? COLORS.primaryContainer : COLORS.surfaceContainerHighest,
    color: active ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant,
    fontFamily: "'Space Grotesk'", fontSize: 14, fontWeight: 700, transition: "all 0.2s",
  });

  const inputStyle = {
    width: "100%", padding: "14px 18px", borderRadius: 14, boxSizing: "border-box",
    background: COLORS.surfaceContainerLow, border: `1px solid ${COLORS.outlineVariant}`,
    color: COLORS.onSurface, fontFamily: "'Manrope'", fontSize: 15, outline: "none",
  };

  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24, maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 30, color: COLORS.primary, letterSpacing: "-0.025em", margin: "0 0 24px" }}>Social</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        <button onClick={() => setTab("friends")} style={chipStyle(tab === "friends")}>
          <Icon name="group" size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Amigos
        </button>
        <button onClick={() => setTab("challenges")} style={chipStyle(tab === "challenges")}>
          <Icon name="emoji_events" size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Retos
        </button>
        <button onClick={() => setTab("create")} style={chipStyle(tab === "create")}>
          <Icon name="add" size={16} style={{ verticalAlign: "middle", marginRight: 4 }} />Crear
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: COLORS.onSurfaceVariant }}>
          <Icon name="hourglass_empty" size={40} style={{ marginBottom: 12 }} />
          <p style={{ fontFamily: "'Manrope'" }}>Cargando...</p>
        </div>
      ) : (
        <>
          {/* ─── FRIENDS TAB ─── */}
          {tab === "friends" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Add friend */}
              <div style={{ display: "flex", gap: 8 }}>
                <input type="email" placeholder="Invitar por email" value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleAddFriend} disabled={addingFriend} style={{
                  padding: "0 20px", borderRadius: 14, border: "none", cursor: "pointer",
                  background: COLORS.primaryContainer, color: COLORS.onPrimaryContainer,
                  fontWeight: 700, fontFamily: "'Space Grotesk'", whiteSpace: "nowrap",
                }}>
                  {addingFriend ? "..." : "Invitar"}
                </button>
              </div>
              {friendMsg && (
                <div style={{
                  padding: "10px 14px", borderRadius: 12, fontSize: 14, fontFamily: "'Manrope'",
                  background: friendMsg.type === "error" ? "rgba(255,115,81,0.1)" : "rgba(202,253,0,0.1)",
                  color: friendMsg.type === "error" ? COLORS.error : COLORS.primaryContainer,
                }}>{friendMsg.text}</div>
              )}

              {/* Pending requests */}
              {pending.length > 0 && (
                <div>
                  <h3 style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.secondary, margin: "0 0 12px" }}>
                    Solicitudes pendientes ({pending.length})
                  </h3>
                  {pending.map((req) => (
                    <div key={req.id} style={{
                      background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 8,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.surfaceContainerHighest, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {req.requester?.avatar_url ? (
                            <img src={req.requester.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <Icon name="person" size={20} style={{ color: COLORS.outline }} />
                          )}
                        </div>
                        <span style={{ fontFamily: "'Manrope'", fontWeight: 600, fontSize: 15 }}>{req.requester?.display_name || "Usuario"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleRespond(req.id, true)} style={{
                          width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
                          background: COLORS.primaryContainer, color: COLORS.onPrimaryContainer,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}><Icon name="check" size={18} /></button>
                        <button onClick={() => handleRespond(req.id, false)} style={{
                          width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
                          background: COLORS.surfaceContainerHighest, color: COLORS.error,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}><Icon name="close" size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Friend list */}
              <div>
                <h3 style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.onSurfaceVariant, margin: "0 0 12px" }}>
                  Tus amigos ({friends.length})
                </h3>
                {friends.length === 0 ? (
                  <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 32, textAlign: "center" }}>
                    <Icon name="group_add" size={40} style={{ color: COLORS.outline, marginBottom: 12 }} />
                    <p style={{ fontFamily: "'Manrope'", fontSize: 14, color: COLORS.onSurfaceVariant, margin: 0 }}>
                      Aún no tienes amigos. Escribe su email arriba y les llegará una invitación para unirse.
                    </p>
                  </div>
                ) : (
                  friends.map((f, i) => (
                    <div key={f.friend_id || i} style={{
                      background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 8,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: COLORS.surfaceContainerHighest, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {f.avatar_url ? (
                            <img src={f.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <Icon name="person" size={22} style={{ color: COLORS.outline }} />
                          )}
                        </div>
                        <div>
                          <span style={{ fontFamily: "'Manrope'", fontWeight: 600, fontSize: 15, display: "block" }}>{f.display_name}</span>
                          <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, color: COLORS.outline }}>Racha: {f.streak} días</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontFamily: "'Space Grotesk'", fontSize: 22, fontWeight: 700, color: COLORS.primaryContainer, display: "block" }}>{Number(f.today_reps)}</span>
                        <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 9, color: COLORS.onSurfaceVariant, textTransform: "uppercase" }}>hoy</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── CHALLENGES TAB ─── */}
          {tab === "challenges" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {challenges.length === 0 ? (
                <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 32, textAlign: "center" }}>
                  <Icon name="emoji_events" size={40} style={{ color: COLORS.outline, marginBottom: 12 }} />
                  <p style={{ fontFamily: "'Manrope'", fontSize: 14, color: COLORS.onSurfaceVariant, margin: "0 0 16px" }}>
                    No tienes retos activos. ¡Crea uno y reta a tus amigos!
                  </p>
                  <button onClick={() => setTab("create")} style={{
                    padding: "12px 24px", borderRadius: 9999, border: "none", cursor: "pointer",
                    background: COLORS.primaryContainer, color: COLORS.onPrimaryContainer,
                    fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 15,
                  }}>Crear Reto</button>
                </div>
              ) : (
                challenges.map((cp) => {
                  const ch = cp.challenge;
                  if (!ch) return null;
                  const daysLeft = Math.max(0, Math.ceil((new Date(ch.deadline) - new Date()) / 86400000));
                  const pct = Math.min(100, Math.round((cp.current_reps / ch.target_reps) * 100));
                  return (
                    <div key={cp.id} style={{
                      background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20,
                      border: pct >= 100 ? `1px solid ${COLORS.primaryContainer}40` : "none",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 18, fontWeight: 700, margin: 0, color: COLORS.onSurface }}>{ch.title}</h3>
                          <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, color: COLORS.outline, margin: "4px 0 0" }}>
                            Creado por {ch.creator?.display_name || "?"} • {daysLeft > 0 ? `${daysLeft} días restantes` : "Finalizado"}
                          </p>
                        </div>
                        {ch.stake && (
                          <span style={{
                            background: COLORS.tertiaryContainer, color: COLORS.onTertiaryContainer,
                            padding: "4px 10px", borderRadius: 8, fontFamily: "'Be Vietnam Pro'", fontSize: 10, fontWeight: 700,
                          }}>{ch.stake}</span>
                        )}
                      </div>
                      {/* Progress */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.onSurfaceVariant }}>{cp.current_reps} / {ch.target_reps}</span>
                          <span style={{ fontFamily: "'Space Grotesk'", fontSize: 14, fontWeight: 700, color: pct >= 100 ? COLORS.primaryContainer : COLORS.secondary }}>{pct}%</span>
                        </div>
                        <div style={{ height: 8, background: COLORS.surfaceContainerHighest, borderRadius: 9999, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${pct}%`, borderRadius: 9999,
                            background: pct >= 100 ? `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryContainer})` : COLORS.secondary,
                            boxShadow: pct >= 100 ? "0 0 10px rgba(202,253,0,0.3)" : "none",
                            transition: "width 0.5s",
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ─── CREATE CHALLENGE TAB ─── */}
          {tab === "create" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input type="text" placeholder='Nombre del reto (ej: "100 burpees en 5 días")' value={cTitle}
                onChange={(e) => setCTitle(e.target.value)} style={inputStyle} />

              <select value={cExercise} onChange={(e) => setCExercise(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
                <option value="">Cualquier ejercicio</option>
                {EXERCISES.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", color: COLORS.onSurfaceVariant, letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Objetivo (reps)</label>
                  <input type="number" value={cTarget} onChange={(e) => setCTarget(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", color: COLORS.onSurfaceVariant, letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Días</label>
                  <input type="number" value={cDays} onChange={(e) => setCDays(Number(e.target.value))} style={inputStyle} />
                </div>
              </div>

              <input type="text" placeholder='¿Qué se juegan? (ej: "Una cena")' value={cStake}
                onChange={(e) => setCStake(e.target.value)} style={inputStyle} />

              {/* Invite friends */}
              <div>
                <label style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", color: COLORS.onSurfaceVariant, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>Invitar amigos</label>
                {friends.length === 0 ? (
                  <p style={{ fontFamily: "'Manrope'", fontSize: 14, color: COLORS.outline }}>Primero añade amigos para poder retarles.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {friends.map((f) => {
                      const invited = cInvited.includes(f.friend_id);
                      return (
                        <button key={f.friend_id} onClick={() => {
                          setCInvited(invited ? cInvited.filter((id) => id !== f.friend_id) : [...cInvited, f.friend_id]);
                        }} style={{
                          padding: "8px 16px", borderRadius: 9999, cursor: "pointer",
                          background: invited ? COLORS.primaryContainer : COLORS.surfaceContainerHighest,
                          color: invited ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant,
                          border: "none", fontFamily: "'Manrope'", fontSize: 14, fontWeight: 600,
                          transition: "all 0.2s",
                        }}>
                          {invited ? "✓ " : ""}{f.display_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button onClick={handleCreateChallenge} disabled={creating || !cTitle.trim() || cInvited.length === 0} style={{
                width: "100%", padding: 20, borderRadius: 9999, border: "none",
                cursor: creating ? "wait" : "pointer", marginTop: 8,
                background: (!cTitle.trim() || cInvited.length === 0) ? COLORS.surfaceContainerHighest : "linear-gradient(90deg, #f3ffca, #cafd00)",
                color: COLORS.onPrimaryContainer, fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18,
                boxShadow: cTitle.trim() && cInvited.length > 0 ? "0 10px 30px rgba(202,253,0,0.2)" : "none",
                opacity: (!cTitle.trim() || cInvited.length === 0) ? 0.5 : 1,
              }}>
                {creating ? "Creando..." : "Lanzar Reto 🔥"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── BADGES SCREEN ───
// ═══════════════════════════════════════════════════
function BadgesScreen({ allActivities, unlockedBadges }) {
  const level = getLevel(allActivities);

  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24 }}>
      <section style={{
        background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 32,
        position: "relative", overflow: "hidden", marginBottom: 48,
      }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 256, height: 256, background: "rgba(202,253,0,0.1)", filter: "blur(100px)", borderRadius: "50%", marginRight: -80, marginTop: -80 }} />
        <div style={{ position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <p style={{ fontFamily: "'Be Vietnam Pro'", color: COLORS.primaryContainer, textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 12, margin: "0 0 4px" }}>Status Actual</p>
              <h1 style={{ fontFamily: "'Space Grotesk'", fontSize: 48, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Nivel {level.level}</h1>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.onSurfaceVariant, textTransform: "uppercase" }}>{level.xp} / {level.nextLevelXp} XP</span>
              <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.primary, fontWeight: 700 }}>{Math.round(level.progress)}%</span>
            </div>
            <div style={{ height: 16, background: COLORS.surfaceContainerHighest, borderRadius: 9999, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "linear-gradient(90deg, #f3ffca, #cafd00)",
                width: `${level.progress}%`, borderRadius: 9999,
                boxShadow: "0 0 15px rgba(202,253,0,0.4)", transition: "width 0.8s ease",
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
        <div style={{ background: COLORS.surfaceContainer, padding: 24, borderRadius: 16 }}>
          <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, color: COLORS.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>Total Puntos</p>
          <p style={{ fontFamily: "'Space Grotesk'", fontSize: 30, fontWeight: 700, color: COLORS.primary, margin: 0 }}>{level.xp.toLocaleString()}</p>
        </div>
        <div style={{ background: COLORS.surfaceContainer, padding: 24, borderRadius: 16 }}>
          <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, color: COLORS.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>Logros</p>
          <p style={{ fontFamily: "'Space Grotesk'", fontSize: 30, fontWeight: 700, color: COLORS.secondary, margin: 0 }}>{unlockedBadges.length}/{ALL_BADGES.length}</p>
        </div>
      </section>

      {/* Badges Grid */}
      <section>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, fontWeight: 700, margin: "0 0 24px" }}>Insignias</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {ALL_BADGES.map((badge) => {
            const unlocked = unlockedBadges.includes(badge.id);
            return (
              <div key={badge.id} style={{
                aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: 16, background: unlocked ? COLORS.surfaceContainer : COLORS.surfaceContainerLow,
                borderRadius: 16, border: unlocked ? "1px solid rgba(202,253,0,0.1)" : `1px solid rgba(72,72,71,0.05)`,
                opacity: unlocked ? 1 : 0.4, filter: unlocked ? "none" : "grayscale(1)",
                position: "relative", overflow: "hidden",
              }}>
                {unlocked && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(202,253,0,0.05), transparent)" }} />}
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 12, background: unlocked ? badge.color : COLORS.surfaceContainerHighest,
                }}>
                  <Icon name={badge.icon} filled={unlocked} size={28} style={{ color: unlocked ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant }} />
                </div>
                <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 9, fontWeight: 700, textAlign: "center", textTransform: "uppercase", lineHeight: 1.3, color: unlocked ? COLORS.primaryContainer : COLORS.onSurfaceVariant }}>{badge.name}</span>
                {!unlocked && <div style={{ position: "absolute", top: 8, right: 8 }}><Icon name="lock" size={14} style={{ color: COLORS.onSurfaceVariant }} /></div>}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── PROFILE SCREEN ───
// ═══════════════════════════════════════════════════
function ProfileScreen({ user, profile, allActivities, unlockedBadges, onSignOut, onRefresh }) {
  const level = getLevel(allActivities);
  const fileInputRef = useRef(null);
  const dailyPhotoRef = useRef(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.display_name || "");
  const [photos, setPhotos] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    loadPhotos();
    checkPush();
  }, []);

  const loadPhotos = async () => {
    const { data } = await getDailyPhotos(user.id);
    setPhotos(data || []);
  };

  const checkPush = async () => {
    const sub = await isPushSubscribed();
    setPushEnabled(sub);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAvatar(user.id, file);
    onRefresh();
  };

  const handleDailyPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadDailyPhoto(user.id, file);
    loadPhotos();
  };

  const handleSaveName = async () => {
    setSavingName(true);
    await updateProfileDB(user.id, { display_name: nameInput.trim() });
    setEditingName(false);
    setSavingName(false);
    onRefresh();
  };

  const handleTogglePush = async () => {
    if (pushEnabled) {
      setPushEnabled(false);
      await savePushSubscription(user.id, null);
    } else {
      const { granted } = await requestNotificationPermission();
      if (granted) {
        const sub = await subscribeToPush();
        if (sub) {
          await savePushSubscription(user.id, sub);
          setPushEnabled(true);
          scheduleLocalReminder(20);
        }
      }
    }
  };

  const todayHasPhoto = photos.some((p) => p.day === todayKey());

  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24, maxWidth: 480, margin: "0 auto" }}>
      {/* Profile Hero */}
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
        <div style={{ position: "relative", marginBottom: 24 }}>
          <div onClick={() => fileInputRef.current?.click()} style={{
            width: 112, height: 112, borderRadius: "50%", cursor: "pointer",
            padding: 3, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
          }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden",
              border: `4px solid ${COLORS.surface}`, background: COLORS.surfaceContainerHighest,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Icon name="person" filled size={48} style={{ color: COLORS.outline }} />
              )}
            </div>
          </div>
          <div style={{
            position: "absolute", bottom: -4, right: -4, background: COLORS.primaryContainer,
            color: COLORS.onPrimaryContainer, width: 32, height: 32, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }} onClick={() => fileInputRef.current?.click()}>
            <Icon name="photo_camera" size={16} />
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
        </div>

        {/* Name */}
        {editingName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              style={{
                background: COLORS.surfaceContainer, border: `1px solid ${COLORS.primaryContainer}`,
                borderRadius: 12, padding: "8px 16px", color: COLORS.onSurface, fontSize: 24,
                fontFamily: "'Space Grotesk'", fontWeight: 700, textAlign: "center", outline: "none", width: 220,
              }}
            />
            <button onClick={handleSaveName} disabled={savingName} style={{
              background: COLORS.primaryContainer, color: COLORS.onPrimaryContainer, border: "none",
              borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}><Icon name="check" size={20} /></button>
          </div>
        ) : (
          <h2 onClick={() => { setNameInput(profile?.display_name || ""); setEditingName(true); }} style={{
            fontFamily: "'Space Grotesk'", fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em",
            margin: "0 0 8px", cursor: "pointer",
          }}>{profile?.display_name || "Tu Nombre"}</h2>
        )}

        {/* Stats chips */}
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.surfaceContainer, padding: "8px 16px", borderRadius: 9999 }}>
            <Icon name="local_fire_department" filled size={18} style={{ color: COLORS.secondary }} />
            <span style={{ fontFamily: "'Be Vietnam Pro'", fontWeight: 700, fontSize: 13 }}>{profile?.streak || 0} DÍAS</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.surfaceContainer, padding: "8px 16px", borderRadius: 9999 }}>
            <Icon name="military_tech" filled size={18} style={{ color: COLORS.primaryContainer }} />
            <span style={{ fontFamily: "'Be Vietnam Pro'", fontWeight: 700, fontSize: 13 }}>{unlockedBadges.length} MEDALLAS</span>
          </div>
        </div>

        {/* Level bar */}
        <div style={{ width: "100%", marginTop: 24, background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, color: COLORS.onSurfaceVariant, textTransform: "uppercase" }}>Nivel {level.level}</span>
            <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, color: COLORS.primary, fontWeight: 700 }}>{level.xp} XP</span>
          </div>
          <div style={{ height: 8, background: COLORS.surfaceContainerHighest, borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryContainer})`, width: `${level.progress}%`, borderRadius: 9999, transition: "width 0.8s" }} />
          </div>
        </div>
      </section>

      {/* Notifications toggle */}
      <section style={{ marginBottom: 32 }}>
        <div onClick={handleTogglePush} style={{
          background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Icon name={pushEnabled ? "notifications_active" : "notifications_off"} filled size={24} style={{ color: pushEnabled ? COLORS.primaryContainer : COLORS.outline }} />
            <div>
              <span style={{ fontFamily: "'Manrope'", fontWeight: 600, fontSize: 15, display: "block" }}>Recordatorios diarios</span>
              <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 11, color: COLORS.onSurfaceVariant }}>
                {pushEnabled ? "Recibirás un recordatorio a las 20:00" : "Activa notificaciones para no perder tu racha"}
              </span>
            </div>
          </div>
          <div style={{
            width: 48, height: 28, borderRadius: 14, padding: 2, cursor: "pointer",
            background: pushEnabled ? COLORS.primaryContainer : COLORS.surfaceContainerHighest,
            transition: "background 0.3s",
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "white",
              transform: pushEnabled ? "translateX(20px)" : "translateX(0)",
              transition: "transform 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }} />
          </div>
        </div>
      </section>

      {/* Daily Photo Section */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 22, fontWeight: 700, margin: 0 }}>Mi Progreso Visual</h3>
          <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, color: COLORS.secondary, fontWeight: 600, textTransform: "uppercase" }}>{photos.length} fotos</span>
        </div>

        {!todayHasPhoto && (
          <button onClick={() => dailyPhotoRef.current?.click()} style={{
            width: "100%", padding: 24, borderRadius: 16, border: `2px dashed ${COLORS.primaryContainer}40`,
            background: COLORS.surfaceContainerLow, cursor: "pointer", marginBottom: 20,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: COLORS.onSurface,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${COLORS.primaryContainer}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="add_a_photo" size={28} style={{ color: COLORS.primaryContainer }} />
            </div>
            <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16 }}>Foto del día</span>
            <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.onSurfaceVariant }}>Hazte una foto cada día y ve tu evolución</span>
          </button>
        )}
        <input ref={dailyPhotoRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handleDailyPhoto} />

        {photos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {photos.map((photo, i) => (
              <div key={photo.id || i} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 12, overflow: "hidden" }}>
                <img src={photo.photo_url} alt={`Día ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 8px 8px",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                }}>
                  <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, fontWeight: 700, color: COLORS.primaryContainer }}>
                    DÍA {photos.length - i}
                  </span>
                  <br />
                  <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 9, color: "rgba(255,255,255,0.7)" }}>
                    {new Date(photo.day).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 32, textAlign: "center" }}>
            <Icon name="photo_library" size={40} style={{ color: COLORS.outline, marginBottom: 12 }} />
            <p style={{ fontFamily: "'Manrope'", fontSize: 14, color: COLORS.onSurfaceVariant, margin: 0, lineHeight: 1.6 }}>
              Sube tu primera foto para empezar tu diario visual.
            </p>
          </div>
        )}
      </section>

      {/* Sign out */}
      <button onClick={onSignOut} style={{
        width: "100%", padding: 16, borderRadius: 16, border: `1px solid ${COLORS.outlineVariant}`,
        background: "transparent", color: COLORS.error, fontFamily: "'Manrope'", fontWeight: 600,
        fontSize: 15, cursor: "pointer", marginBottom: 24,
      }}>
        Cerrar sesión
      </button>
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── ONBOARDING ───
// ═══════════════════════════════════════════════════
const ONBOARDING_SLIDES = [
  {
    icon: "self_improvement", tagline: "UNA FILOSOFÍA",
    title: "Un cuerpo en forma,\nuna mente en calma\ny una casa llena\nde amor.",
    body: "El deporte no va de abdominales ni de récords. Va de cuidarte para poder cuidar a los tuyos. Va de sentirte vivo.",
    accent: COLORS.primaryContainer,
  },
  {
    icon: "bolt", tagline: "LA IDEA",
    title: "100 movimientos.\nCada día.\nSin excusas.",
    body: "No necesitas un gimnasio, ni una hora libre, ni equipamiento. Solo mover el cuerpo 100 veces al día. Cada movimiento cuenta.",
    accent: COLORS.secondary,
  },
  {
    icon: "phone_iphone", tagline: "INSTÁLALA",
    title: "Tu reto,\nen tu bolsillo.",
    body: null, isInstallSlide: true, accent: COLORS.tertiaryContainer,
  },
];

function OnboardingScreen({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = ONBOARDING_SLIDES[currentSlide];
  const isLast = currentSlide === ONBOARDING_SLIDES.length - 1;
  const handleNext = () => isLast ? onComplete() : setCurrentSlide((s) => s + 1);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: COLORS.surface,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 400, height: 400, background: `${slide.accent}10`, borderRadius: "50%",
          filter: "blur(120px)", transition: "background 0.6s ease",
        }} />
      </div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 32px 32px", position: "relative", zIndex: 10, maxWidth: 440, margin: "0 auto", width: "100%",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: COLORS.surfaceContainer, marginBottom: 32, boxShadow: `0 0 40px ${slide.accent}20`,
          border: `1px solid ${slide.accent}30`,
        }}>
          <Icon name={slide.icon} filled size={40} style={{ color: slide.accent }} />
        </div>

        <span style={{
          fontFamily: "'Be Vietnam Pro'", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.25em", color: slide.accent, marginBottom: 16,
        }}>{slide.tagline}</span>

        <h1 style={{
          fontFamily: "'Space Grotesk'", fontSize: 36, fontWeight: 700, lineHeight: 1.15,
          letterSpacing: "-0.03em", margin: "0 0 24px", whiteSpace: "pre-line",
        }}>{slide.title}</h1>

        {slide.isInstallSlide ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {isIOS ? (
              <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Icon name="ios_share" size={24} style={{ color: COLORS.primary }} />
                  <span style={{ fontFamily: "'Manrope'", fontWeight: 700, fontSize: 16 }}>En Safari:</span>
                </div>
                <p style={{ fontFamily: "'Manrope'", fontSize: 15, color: COLORS.onSurfaceVariant, lineHeight: 1.6, margin: 0 }}>
                  Pulsa el botón de compartir ↑ y selecciona <span style={{ color: COLORS.onSurface, fontWeight: 600 }}>"Añadir a pantalla de inicio"</span>.
                </p>
              </div>
            ) : isAndroid ? (
              <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Icon name="more_vert" size={24} style={{ color: COLORS.primary }} />
                  <span style={{ fontFamily: "'Manrope'", fontWeight: 700, fontSize: 16 }}>En Chrome:</span>
                </div>
                <p style={{ fontFamily: "'Manrope'", fontSize: 15, color: COLORS.onSurfaceVariant, lineHeight: 1.6, margin: 0 }}>
                  Pulsa el menú ⋮ y selecciona <span style={{ color: COLORS.onSurface, fontWeight: 600 }}>"Añadir a pantalla de inicio"</span>.
                </p>
              </div>
            ) : (
              <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20 }}>
                <p style={{ fontFamily: "'Manrope'", fontSize: 15, color: COLORS.onSurfaceVariant, lineHeight: 1.6, margin: 0 }}>
                  Abre esta web en tu móvil y añádela a la pantalla de inicio desde el menú del navegador.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontFamily: "'Manrope'", fontSize: 17, color: COLORS.onSurfaceVariant, lineHeight: 1.7, margin: 0, maxWidth: 360 }}>{slide.body}</p>
        )}
      </div>

      <div style={{ padding: "0 32px 48px", position: "relative", zIndex: 10, maxWidth: 440, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <div key={i} style={{
              width: i === currentSlide ? 32 : 8, height: 8, borderRadius: 9999,
              background: i === currentSlide ? slide.accent : COLORS.surfaceContainerHighest, transition: "all 0.3s ease",
            }} />
          ))}
        </div>
        <button onClick={handleNext} style={{
          width: "100%", padding: 20, borderRadius: 9999, border: "none", cursor: "pointer",
          background: isLast ? `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryContainer})` : COLORS.surfaceContainer,
          color: isLast ? COLORS.onPrimaryContainer : COLORS.onSurface,
          fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18,
          boxShadow: isLast ? "0 10px 30px rgba(202,253,0,0.3)" : "none",
        }}>
          {isLast ? "Empezar mi reto" : "Siguiente"}
        </button>
        {!isLast && (
          <button onClick={onComplete} style={{
            width: "100%", padding: 12, background: "none", border: "none", cursor: "pointer",
            fontFamily: "'Be Vietnam Pro'", fontSize: 13, color: COLORS.outline,
            textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 8,
          }}>Saltar</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── MAIN APP ───
// ═══════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayActivities, setTodayActivities] = useState([]);
  const [allActivities, setAllActivities] = useState([]); // for badges/level calculation
  const [unlockedBadges, setUnlockedBadges] = useState([]);
  const [achievementModal, setAchievementModal] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ─── Auth listener ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
      if (s) loadUserData(s.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadUserData(s.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── Load user data from Supabase ───
  const loadUserData = async (user) => {
    const [profileRes, todayRes, allRes] = await Promise.all([
      getProfile(user.id),
      fetchTodayActivities(user.id),
      getActivitiesForRange(user.id, "2020-01-01", "2099-12-31"),
    ]);
    setProfile(profileRes.data);
    setTodayActivities(todayRes.data || []);
    const all = allRes.data || [];
    setAllActivities(all);

    // Check onboarding
    if (profileRes.data?.total_sessions === 0) {
      try {
        if (!window.localStorage?.getItem?.("1de100_onboarded")) {
          setShowOnboarding(true);
        }
      } catch { setShowOnboarding(true); }
    }

    // Compute unlocked badges
    computeBadges(all);
  };

  const computeBadges = (activities) => {
    const byDay = {};
    for (const a of activities) {
      const d = a.day || todayKey();
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(a);
    }
    const stats = {
      totalSessions: activities.length,
      daysAt100: Object.values(byDay).filter((acts) => acts.reduce((s, a) => s + a.reps, 0) >= 100).length,
      weekendDays: Object.entries(byDay).filter(([date]) => { const d = new Date(date); return d.getDay() === 0 || d.getDay() === 6; }).filter(([_, acts]) => acts.length > 0).length,
      earlyWorkouts: activities.filter((a) => { const h = new Date(a.logged_at).getHours(); return h < 8; }).length,
      maxStreak: profile?.max_streak || 0,
      exerciseTotals: {},
    };
    activities.forEach((a) => {
      stats.exerciseTotals[a.exercise_id] = (stats.exerciseTotals[a.exercise_id] || 0) + a.reps;
    });

    const unlocked = [];
    let newBadge = null;
    for (const badge of ALL_BADGES) {
      if (badge.condition(stats)) {
        unlocked.push(badge.id);
        if (!unlockedBadges.includes(badge.id)) newBadge = badge;
      }
    }
    setUnlockedBadges(unlocked);
    if (newBadge) setTimeout(() => setAchievementModal(newBadge), 300);
  };

  // ─── Register activity ───
  const handleRegister = useCallback(async (exerciseId, reps) => {
    if (!session?.user) return;
    const { data } = await logActivity(session.user.id, exerciseId, reps);
    if (data) {
      const newToday = [data, ...todayActivities];
      setTodayActivities(newToday);
      const newAll = [data, ...allActivities];
      setAllActivities(newAll);
      computeBadges(newAll);
    }
    setScreen("dashboard");
  }, [session, todayActivities, allActivities, unlockedBadges]);

  const handleAuth = (s) => {
    setSession(s);
    if (s) loadUserData(s.user);
  };

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    setProfile(null);
    setTodayActivities([]);
    setAllActivities([]);
    setUnlockedBadges([]);
  };

  const refreshProfile = async () => {
    if (!session?.user) return;
    const { data } = await getProfile(session.user.id);
    setProfile(data);
  };

  const level = getLevel(allActivities);

  // ─── Loading ───
  if (authLoading) {
    return (
      <div style={{
        background: COLORS.surface, color: COLORS.onSurface, minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      }}>
        <h1 style={{ fontFamily: "'Space Grotesk'", fontSize: 48, fontWeight: 900, fontStyle: "italic", color: COLORS.neon, letterSpacing: "-0.05em" }}>1 DE 100</h1>
        <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 16 }}>Cargando...</p>
      </div>
    );
  }

  // ─── Not authenticated ───
  if (!session) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  // ─── Main app ───
  return (
    <div style={{
      background: COLORS.surface, color: COLORS.onSurface, fontFamily: "'Manrope', sans-serif",
      minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative",
      WebkitFontSmoothing: "antialiased",
    }}>
      {showOnboarding ? (
        <OnboardingScreen onComplete={() => {
          try { window.localStorage?.setItem?.("1de100_onboarded", "1"); } catch {}
          setShowOnboarding(false);
        }} />
      ) : (
        <>
          <TopBar
            onBadgeClick={() => setScreen("badges")}
            avatarUrl={profile?.avatar_url}
            onProfileClick={() => setScreen("profile")}
          />

          {screen === "dashboard" && <DashboardScreen todayActivities={todayActivities} onNavigate={setScreen} />}
          {screen === "activity" && <ActivityScreen onRegister={handleRegister} />}
          {screen === "social" && <SocialScreen userId={session.user.id} />}
          {screen === "badges" && <BadgesScreen allActivities={allActivities} unlockedBadges={unlockedBadges} />}
          {screen === "profile" && (
            <ProfileScreen
              user={session.user}
              profile={profile}
              allActivities={allActivities}
              unlockedBadges={unlockedBadges}
              onSignOut={handleSignOut}
              onRefresh={refreshProfile}
            />
          )}

          <BottomNav active={screen} onNavigate={setScreen} />

          <AchievementModal badge={achievementModal} level={level} onClose={() => setAchievementModal(null)} />
        </>
      )}
    </div>
  );
}
