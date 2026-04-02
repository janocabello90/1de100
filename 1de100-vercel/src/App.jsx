import { useState, useEffect, useCallback, useRef } from "react";

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
  { id: "sentadillas", name: "Sentadillas", icon: "fitness_center", category: "Piernas" },
  { id: "flexiones", name: "Flexiones", icon: "exercise", category: "Pecho" },
  { id: "zancadas", name: "Zancadas", icon: "directions_run", category: "Piernas" },
  { id: "plancha", name: "Plancha (s)", icon: "self_improvement", category: "Core" },
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
const getInitialState = () => {
  const empty = {
    activities: {},    // { "2026-04-02": [{ exercise: "sentadillas", reps: 25, time: "..." }, ...] }
    stats: { totalSessions: 0, daysAt100: 0, weekendDays: 0, earlyWorkouts: 0, maxStreak: 0, exerciseTotals: {} },
    unlockedBadges: [],
    streak: 0,
  };
  return empty;
};

function getTodayTotal(state) {
  const today = state.activities[todayKey()] || [];
  return today.reduce((sum, a) => sum + a.reps, 0);
}

function getTodayActivities(state) {
  return state.activities[todayKey()] || [];
}

function getStreak(state) {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    const dayActivities = state.activities[key] || [];
    const dayTotal = dayActivities.reduce((s, a) => s + a.reps, 0);
    if (dayTotal > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getWeeklyData(state) {
  const days = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(dd.getDate() - i);
    const key = dd.toISOString().slice(0, 10);
    const acts = state.activities[key] || [];
    const total = acts.reduce((s, a) => s + a.reps, 0);
    days.push({ day: dd.toLocaleDateString("es", { weekday: "short" }).charAt(0).toUpperCase(), total, date: key });
  }
  return days;
}

function getLevel(state) {
  const xp = Object.values(state.activities).flat().reduce((s, a) => s + a.reps, 0);
  return { level: Math.floor(xp / 200) + 1, xp, nextLevelXp: (Math.floor(xp / 200) + 1) * 200, progress: (xp % 200) / 200 * 100 };
}

// ─── Icon Component ───
function Icon({ name, filled, size = 24, style = {} }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: filled ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 400",
        ...style,
      }}
    >
      {name}
    </span>
  );
}

// ─── Bottom Nav ───
function BottomNav({ active, onNavigate }) {
  const tabs = [
    { id: "dashboard", icon: "table_chart", label: "Dashboard" },
    { id: "activity", icon: "add_circle", label: "Activity" },
    { id: "library", icon: "lightbulb", label: "Library" },
    { id: "badges", icon: "emoji_events", label: "Badges" },
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, width: "100%", zIndex: 50,
      display: "flex", justifyContent: "space-around", alignItems: "center",
      padding: "12px 16px 24px", background: "rgba(19,19,19,0.85)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      boxShadow: "0 -10px 40px rgba(204,255,0,0.05)",
    }}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onNavigate(t.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: isActive ? COLORS.surfaceContainer : "transparent",
              color: isActive ? COLORS.neon : "#6b7280",
              opacity: isActive ? 1 : 0.6,
              borderRadius: 9999, padding: isActive ? 12 : 8,
              boxShadow: isActive ? "0 0 15px rgba(204,255,0,0.2)" : "none",
              transform: isActive ? "scale(1.1)" : "scale(1)",
              transition: "all 0.2s", border: "none", cursor: "pointer",
            }}
          >
            <Icon name={t.icon} filled={isActive} size={24} />
            <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Top App Bar ───
function TopBar({ onBadgeClick }) {
  return (
    <header style={{
      position: "fixed", top: 0, width: "100%", zIndex: 50,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "0 24px", height: 80,
      background: "linear-gradient(to bottom, #131313, transparent)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", overflow: "hidden",
          border: `2px solid ${COLORS.primaryContainer}`,
          background: COLORS.surfaceContainerHighest,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="person" filled size={24} style={{ color: COLORS.primary }} />
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
      {/* Background effects */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "25%", left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.primaryContainer}, transparent)`, opacity: 0.3, transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, background: "rgba(202,253,0,0.05)", borderRadius: "50%", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, background: "rgba(255,117,36,0.1)", borderRadius: "50%", filter: "blur(80px)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 400 }}>
        {/* Badge icon */}
        <div style={{ position: "relative", marginBottom: 48 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(202,253,0,0.2)", filter: "blur(40px)", borderRadius: "50%" }} />
          <div style={{
            position: "relative", width: 192, height: 192, background: COLORS.surfaceContainer,
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "inset 0 0 40px rgba(204,255,0,0.1)",
          }}>
            <Icon name="military_tech" filled size={96} style={{ color: "#cafd00" }} />
            <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(202,253,0,0.2)", borderRadius: "50%", transform: "scale(1.1)" }} />
            <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(202,253,0,0.1)", borderRadius: "50%", transform: "scale(1.25)" }} />
          </div>
          <div style={{
            position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)",
            background: COLORS.tertiaryContainer, color: COLORS.onTertiaryContainer,
            fontFamily: "'Be Vietnam Pro'", fontSize: 14, padding: "4px 16px",
            borderRadius: 9999, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em",
            boxShadow: "0 4px 20px rgba(252,224,71,0.3)",
          }}>{badge.name}</div>
        </div>

        <div style={{ marginBottom: 64 }}>
          <h1 style={{
            fontFamily: "'Space Grotesk'", fontSize: 48, fontWeight: 900, fontStyle: "italic",
            color: COLORS.primaryContainer, letterSpacing: "-0.05em", lineHeight: 1,
            textTransform: "uppercase", textShadow: "0 0 15px rgba(204,255,0,0.6)",
            margin: "0 0 16px",
          }}>¡LOGRO DESBLOQUEADO!</h1>
          <p style={{ fontFamily: "'Manrope'", color: COLORS.onSurfaceVariant, fontSize: 18, fontWeight: 300, lineHeight: 1.6 }}>
            Has alcanzado el <span style={{ color: COLORS.onSurface, fontWeight: 700 }}>{badge.name}</span> con tus últimos movimientos. ¡Sigue así!
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: "100%", marginBottom: 48 }}>
          <div style={{ background: COLORS.surfaceContainerLow, padding: 24, borderRadius: 16, textAlign: "left" }}>
            <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, color: COLORS.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Entrenamientos</p>
            <span style={{ fontFamily: "'Space Grotesk'", fontSize: 36, fontWeight: 700 }}>{level.xp}</span>
          </div>
          <div style={{ background: COLORS.surfaceContainerLow, padding: 24, borderRadius: 16, textAlign: "left" }}>
            <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, color: COLORS.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Nivel Actual</p>
            <span style={{ fontFamily: "'Space Grotesk'", fontSize: 36, fontWeight: 700, color: COLORS.secondary }}>LVL {level.level}</span>
          </div>
        </div>

        <button onClick={onClose} style={{
          width: "100%", padding: "20px 48px", background: COLORS.primaryContainer,
          color: COLORS.onPrimaryContainer, fontFamily: "'Space Grotesk'", fontWeight: 900,
          fontStyle: "italic", fontSize: 24, borderRadius: 9999, border: "none", cursor: "pointer",
          boxShadow: "0 10px 40px rgba(202,253,0,0.3)",
          transition: "all 0.3s",
        }}>¡VAMOS!</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── DASHBOARD SCREEN ───
// ═══════════════════════════════════════════════════
function DashboardScreen({ state, onNavigate }) {
  const todayTotal = getTodayTotal(state);
  const todayActivities = getTodayActivities(state);
  const streak = getStreak(state);
  const remaining = Math.max(0, 100 - todayTotal);

  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24, maxWidth: 480, margin: "0 auto" }}>
      {/* Hero: Progress Ring */}
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 32 }}>
        <ProgressRing current={Math.min(todayTotal, 100)} />
        {/* Energy Wave */}
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
          <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.secondary, fontWeight: 600, cursor: "pointer" }}>VER TODO</span>
        </div>
        {todayActivities.length === 0 ? (
          <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 32, textAlign: "center" }}>
            <Icon name="fitness_center" size={40} style={{ color: COLORS.outline, marginBottom: 12 }} />
            <p style={{ color: COLORS.onSurfaceVariant, fontFamily: "'Manrope'", fontSize: 14 }}>Aún no has registrado movimientos hoy. ¡Empieza ahora!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {todayActivities.slice(-3).reverse().map((a, i) => {
              const ex = EXERCISES.find((e) => e.id === a.exercise) || EXERCISES[0];
              const pct = Math.round((a.reps / 100) * 100);
              return (
                <div key={i} style={{
                  background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "background 0.2s",
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
                      <p style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.outline, margin: "4px 0 0" }}>{a.time} • {ex.category}</p>
                    </div>
                  </div>
                  <span style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, color: COLORS.primaryContainer }}>+{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Streak / Motivational Card */}
      <section style={{
        marginTop: 48, background: `linear-gradient(135deg, ${COLORS.surfaceContainerLow}, ${COLORS.surfaceContainer})`,
        padding: 24, borderRadius: 16, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icon name="auto_awesome" filled style={{ color: COLORS.tertiaryContainer }} />
            <h3 style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.onSurfaceVariant, fontWeight: 700, margin: 0 }}>
              {streak > 0 ? `Racha de ${streak} día${streak > 1 ? "s" : ""}` : "¡Empieza tu racha!"}
            </h3>
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
          boxShadow: "0 10px 30px rgba(202,253,0,0.3)", transition: "all 0.2s",
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
function ActivityScreen({ state, onRegister }) {
  const [selectedExercise, setSelectedExercise] = useState("sentadillas");
  const [reps, setReps] = useState(25);
  const [inputStr, setInputStr] = useState("25");

  const handleKeypad = (val) => {
    if (val === "back") {
      const ns = inputStr.slice(0, -1) || "0";
      setInputStr(ns);
      setReps(parseInt(ns) || 0);
    } else {
      const ns = inputStr === "0" ? val : inputStr + val;
      if (parseInt(ns) <= 999) {
        setInputStr(ns);
        setReps(parseInt(ns) || 0);
      }
    }
  };

  const handlePlusMinus = (delta) => {
    const newVal = Math.max(0, Math.min(999, reps + delta));
    setReps(newVal);
    setInputStr(String(newVal));
  };

  const handleConfirm = () => {
    if (reps > 0) {
      onRegister(selectedExercise, reps);
      setReps(25);
      setInputStr("25");
    }
  };

  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24, maxWidth: 448, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 30, color: COLORS.primary, letterSpacing: "-0.025em", margin: 0 }}>Añadir Movimiento</h2>
        <p style={{ fontFamily: "'Be Vietnam Pro'", color: COLORS.onSurfaceVariant, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>Registra tu progreso diario</p>
      </div>

      {/* Exercise grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        {EXERCISES.map((ex) => {
          const isActive = selectedExercise === ex.id;
          return (
            <button key={ex.id} onClick={() => setSelectedExercise(ex.id)} style={{
              background: isActive ? COLORS.surfaceContainer : COLORS.surfaceContainerLow,
              border: isActive ? `2px solid ${COLORS.primaryContainer}` : "2px solid transparent",
              padding: 24, borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 12, cursor: "pointer", color: isActive ? COLORS.primary : COLORS.onSurfaceVariant,
              transition: "all 0.2s",
            }}>
              <Icon name={ex.icon} filled={isActive} size={36} />
              <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{ex.name}</span>
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
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: COLORS.secondary, transition: "all 0.2s",
          }}>
            <Icon name="remove" size={24} />
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontFamily: "'Space Grotesk'", fontSize: 72, fontWeight: 700, lineHeight: 1 }}>{reps}</span>
            <div style={{ height: 4, width: 48, background: COLORS.primary, marginTop: 8, borderRadius: 9999, boxShadow: "0 0 10px rgba(204,255,0,0.5)" }} />
          </div>
          <button onClick={() => handlePlusMinus(5)} style={{
            width: 56, height: 56, borderRadius: "50%", background: COLORS.surfaceContainerHighest,
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: COLORS.primary, transition: "all 0.2s",
          }}>
            <Icon name="add" size={24} />
          </button>
        </div>
      </div>

      {/* Numeric Keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 48 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "back", 0, "."].map((val) => (
          <button
            key={val}
            onClick={() => val === "back" ? handleKeypad("back") : val !== "." ? handleKeypad(String(val)) : null}
            style={{
              height: 64, borderRadius: 16, background: val === "back" ? "transparent" : COLORS.surfaceContainerHighest,
              border: "none", cursor: val === "." ? "default" : "pointer",
              fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700,
              color: val === "back" ? COLORS.onSurfaceVariant : COLORS.onSurface,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: val === "back" ? 0.4 : val === "." ? 0.3 : 1,
              transition: "all 0.15s",
            }}
          >
            {val === "back" ? <Icon name="backspace" /> : val}
          </button>
        ))}
      </div>

      {/* CTA */}
      <button onClick={handleConfirm} style={{
        width: "100%", padding: 20, borderRadius: 9999,
        background: "linear-gradient(90deg, #f3ffca, #cafd00)",
        color: COLORS.onPrimary, fontWeight: 700, fontSize: 18, border: "none", cursor: "pointer",
        boxShadow: "0 10px 30px rgba(202,253,0,0.2)", transition: "all 0.2s",
      }}>
        Confirmar Entrenamiento
      </button>
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── LIBRARY SCREEN ───
// ═══════════════════════════════════════════════════
function LibraryScreen() {
  const weeklyData = [40, 60, 50, 80, 100, 70, 45];
  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24 }}>
      {/* Hero */}
      <section style={{ marginBottom: 48 }}>
        <span style={{ fontFamily: "'Be Vietnam Pro'", color: COLORS.primary, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em" }}>Biblioteca de Movimiento</span>
        <h1 style={{ fontFamily: "'Space Grotesk'", fontSize: 44, fontWeight: 700, letterSpacing: "-0.025em", margin: "8px 0 0" }}>Ideas & Consejos</h1>
        {/* Quote card */}
        <div style={{
          marginTop: 24, padding: 24, borderRadius: 16, background: COLORS.surfaceContainerLow,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(202,253,0,0.1), transparent)", opacity: 0.5 }} />
          <div style={{ position: "relative", zIndex: 10 }}>
            <p style={{ fontFamily: "'Manrope'", fontSize: 18, color: "#beee00", lineHeight: 1.6, fontStyle: "italic", maxWidth: "80%" }}>
              "¡Cada movimiento cuenta hacia tu objetivo!"
            </p>
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="bolt" filled style={{ color: COLORS.primary }} />
              <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.onSurfaceVariant }}>Motivación Diaria</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tips Grid */}
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {TIPS.map((tip, i) => (
          <div key={i} style={{
            background: i === 1 ? "rgba(255,117,36,0.1)" : COLORS.surfaceContainer,
            borderRadius: 16, padding: 24, position: "relative", overflow: "hidden",
            borderLeft: i === 4 ? `4px solid ${COLORS.primary}` : "none",
            boxShadow: i === 1 ? "0 0 30px rgba(255,117,36,0.05)" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, margin: 0, maxWidth: "75%" }}>{tip.title}</h3>
              <span style={{
                background: tip.tag === "HOT IDEA" ? COLORS.tertiaryContainer : tip.tag === "SALUD" ? "rgba(255,117,36,0.2)" : COLORS.primary,
                color: tip.tag === "HOT IDEA" ? COLORS.onTertiaryContainer : tip.tag === "SALUD" ? COLORS.secondary : COLORS.onPrimary,
                padding: "4px 8px", borderRadius: 8, fontFamily: "'Be Vietnam Pro'", fontSize: 8, fontWeight: 700,
              }}>{tip.tag}</span>
            </div>
            <p style={{ fontFamily: "'Manrope'", fontSize: 14, color: COLORS.onSurfaceVariant, margin: 0, lineHeight: 1.5 }}>{tip.desc}</p>
            {tip.xp && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 10, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.15em" }}>+{tip.xp} XP</span>
              </div>
            )}
          </div>
        ))}

        {/* Weekly Rhythm */}
        <div style={{
          background: COLORS.surfaceContainer, borderRadius: 16, padding: 32,
          position: "relative", overflow: "hidden",
        }}>
          <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>Ritmo Semanal</h2>
          <p style={{ fontFamily: "'Manrope'", color: COLORS.onSurfaceVariant, margin: "0 0 24px", fontSize: 14 }}>
            Tus interacciones han aumentado el movimiento un 15% esta semana.
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
            {weeklyData.map((v, i) => (
              <div key={i} style={{
                flex: 1, background: `rgba(255,117,36,${0.2 + (v / 100) * 0.8})`,
                borderTopLeftRadius: 4, borderTopRightRadius: 4,
                height: `${v}%`,
                boxShadow: v === 100 ? "0 0 20px rgba(255,117,36,0.5)" : "none",
                transition: "height 0.5s ease",
              }} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── BADGES SCREEN ───
// ═══════════════════════════════════════════════════
function BadgesScreen({ state }) {
  const level = getLevel(state);
  const streak = getStreak(state);
  const weeklyData = getWeeklyData(state);
  const maxWeekly = Math.max(...weeklyData.map((d) => d.total), 1);

  return (
    <main style={{ paddingTop: 96, paddingBottom: 140, paddingLeft: 24, paddingRight: 24 }}>
      {/* Hero: Level & Streak */}
      <section style={{
        background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 32,
        position: "relative", overflow: "hidden", marginBottom: 48,
        clipPath: "polygon(0 0, 100% 0, 100% 85%, 0% 100%)",
      }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 256, height: 256, background: "rgba(202,253,0,0.1)", filter: "blur(100px)", borderRadius: "50%", marginRight: -80, marginTop: -80 }} />
        <div style={{ position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <p style={{ fontFamily: "'Be Vietnam Pro'", color: COLORS.primaryContainer, textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 12, margin: "0 0 4px" }}>Status Actual</p>
              <h1 style={{ fontFamily: "'Space Grotesk'", fontSize: 48, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Nivel {level.level}</h1>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, background: "rgba(255,117,36,0.2)",
                color: COLORS.secondary, padding: "8px 16px", borderRadius: 9999,
              }}>
                <Icon name="local_fire_department" filled size={20} />
                <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 20 }}>{streak} Días</span>
              </div>
              <p style={{ fontFamily: "'Be Vietnam Pro'", color: COLORS.onSurfaceVariant, fontSize: 10, textTransform: "uppercase", marginTop: 8 }}>Racha Actual</p>
            </div>
          </div>
          {/* XP Progress */}
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
          <p style={{ fontFamily: "'Space Grotesk'", fontSize: 30, fontWeight: 700, color: COLORS.secondary, margin: 0 }}>{state.unlockedBadges.length}/{ALL_BADGES.length}</p>
        </div>
      </section>

      {/* Badges Grid */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, fontWeight: 700, margin: 0 }}>Insignias Ganadas</h2>
          <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 12, color: COLORS.primaryContainer, textTransform: "uppercase", letterSpacing: "0.15em" }}>Ver todas</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {ALL_BADGES.map((badge) => {
            const unlocked = state.unlockedBadges.includes(badge.id);
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
                  marginBottom: 12, background: unlocked ? (typeof badge.color === "string" && badge.color.startsWith("linear") ? badge.color : badge.color) : COLORS.surfaceContainerHighest,
                  boxShadow: unlocked ? "0 0 20px rgba(202,253,0,0.2)" : "none",
                }}>
                  <Icon name={badge.icon} filled={unlocked} size={28} style={{ color: unlocked ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant }} />
                </div>
                <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 9, fontWeight: 700, textAlign: "center", textTransform: "uppercase", lineHeight: 1.3, color: unlocked ? COLORS.primaryContainer : COLORS.onSurfaceVariant }}>{badge.name}</span>
                {!unlocked && (
                  <div style={{ position: "absolute", top: 8, right: 8 }}>
                    <Icon name="lock" size={14} style={{ color: COLORS.onSurfaceVariant }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Weekly Intensity */}
      <section style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Intensidad Semanal</h3>
        </div>
        <div style={{ height: 128, display: "flex", alignItems: "flex-end", gap: 4 }}>
          {weeklyData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: "100%", background: `rgba(255,117,36,${0.2 + (d.total / maxWeekly) * 0.8})`,
                borderTopLeftRadius: 4, borderTopRightRadius: 4,
                height: `${Math.max(5, (d.total / maxWeekly) * 100)}%`,
                boxShadow: d.total === maxWeekly ? "0 0 10px rgba(255,117,36,0.3)" : "none",
                transition: "height 0.5s ease",
              }} />
              <span style={{ fontFamily: "'Be Vietnam Pro'", fontSize: 9, color: COLORS.onSurfaceVariant }}>{d.day}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════
// ─── ONBOARDING ───
// ═══════════════════════════════════════════════════
const ONBOARDING_SLIDES = [
  {
    icon: "self_improvement",
    tagline: "UNA FILOSOFÍA",
    title: "Un cuerpo en forma,\nuna mente en calma\ny una casa llena\nde amor.",
    body: "El deporte no va de abdominales ni de récords. Va de cuidarte para poder cuidar a los tuyos. Va de sentirte vivo. De llegar al final del día sabiendo que te has movido, que has hecho algo por ti.",
    accent: COLORS.primaryContainer,
  },
  {
    icon: "bolt",
    tagline: "LA IDEA",
    title: "100 movimientos.\nCada día.\nSin excusas.",
    body: "No necesitas un gimnasio, ni una hora libre, ni equipamiento. Solo mover el cuerpo 100 veces al día. Sentadillas esperando el café. Flexiones antes de la ducha. Zancadas por el pasillo. Cada movimiento cuenta.",
    accent: COLORS.secondary,
  },
  {
    icon: "phone_iphone",
    tagline: "INSTÁLALA",
    title: "Tu reto,\nen tu bolsillo.",
    body: null, // Custom content for install instructions
    accent: COLORS.tertiaryContainer,
    isInstallSlide: true,
  },
];

function OnboardingScreen({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = ONBOARDING_SLIDES[currentSlide];
  const isLast = currentSlide === ONBOARDING_SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentSlide((s) => s + 1);
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: COLORS.surface,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 400, height: 400, background: `${slide.accent}10`, borderRadius: "50%",
          filter: "blur(120px)", transition: "background 0.6s ease",
        }} />
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 32px 32px", position: "relative", zIndex: 10, maxWidth: 440, margin: "0 auto", width: "100%",
      }}>
        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: COLORS.surfaceContainer, marginBottom: 32,
          boxShadow: `0 0 40px ${slide.accent}20`,
          border: `1px solid ${slide.accent}30`,
        }}>
          <Icon name={slide.icon} filled size={40} style={{ color: slide.accent }} />
        </div>

        {/* Tag */}
        <span style={{
          fontFamily: "'Be Vietnam Pro'", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.25em",
          color: slide.accent, marginBottom: 16,
        }}>{slide.tagline}</span>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Space Grotesk'", fontSize: 36, fontWeight: 700,
          lineHeight: 1.15, letterSpacing: "-0.03em", margin: "0 0 24px",
          whiteSpace: "pre-line", color: COLORS.onSurface,
        }}>{slide.title}</h1>

        {/* Body */}
        {slide.isInstallSlide ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {isIOS ? (
              <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Icon name="ios_share" size={24} style={{ color: COLORS.primary }} />
                  <span style={{ fontFamily: "'Manrope'", fontWeight: 700, fontSize: 16 }}>En Safari:</span>
                </div>
                <p style={{ fontFamily: "'Manrope'", fontSize: 15, color: COLORS.onSurfaceVariant, lineHeight: 1.6, margin: 0 }}>
                  Pulsa el botón de compartir <span style={{ color: COLORS.onSurface }}>↑</span> y selecciona <span style={{ color: COLORS.onSurface, fontWeight: 600 }}>"Añadir a pantalla de inicio"</span>.
                </p>
              </div>
            ) : isAndroid ? (
              <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Icon name="more_vert" size={24} style={{ color: COLORS.primary }} />
                  <span style={{ fontFamily: "'Manrope'", fontWeight: 700, fontSize: 16 }}>En Chrome:</span>
                </div>
                <p style={{ fontFamily: "'Manrope'", fontSize: 15, color: COLORS.onSurfaceVariant, lineHeight: 1.6, margin: 0 }}>
                  Pulsa el menú <span style={{ color: COLORS.onSurface }}>⋮</span> y selecciona <span style={{ color: COLORS.onSurface, fontWeight: 600 }}>"Añadir a pantalla de inicio"</span>.
                </p>
              </div>
            ) : (
              <div style={{ background: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20 }}>
                <p style={{ fontFamily: "'Manrope'", fontSize: 15, color: COLORS.onSurfaceVariant, lineHeight: 1.6, margin: 0 }}>
                  Abre esta web en tu móvil y añádela a la pantalla de inicio desde el menú del navegador. Se instalará como una app.
                </p>
              </div>
            )}
            <p style={{ fontFamily: "'Manrope'", fontSize: 14, color: COLORS.onSurfaceVariant, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
              No necesitas App Store. Se abre como una app real, sin barra del navegador.
            </p>
          </div>
        ) : (
          <p style={{
            fontFamily: "'Manrope'", fontSize: 17, color: COLORS.onSurfaceVariant,
            lineHeight: 1.7, margin: 0, maxWidth: 360,
          }}>{slide.body}</p>
        )}
      </div>

      {/* Bottom: dots + button */}
      <div style={{ padding: "0 32px 48px", position: "relative", zIndex: 10, maxWidth: 440, margin: "0 auto", width: "100%" }}>
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <div key={i} style={{
              width: i === currentSlide ? 32 : 8, height: 8, borderRadius: 9999,
              background: i === currentSlide ? slide.accent : COLORS.surfaceContainerHighest,
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* CTA */}
        <button onClick={handleNext} style={{
          width: "100%", padding: 20, borderRadius: 9999, border: "none", cursor: "pointer",
          background: isLast ? `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryContainer})` : COLORS.surfaceContainer,
          color: isLast ? COLORS.onPrimaryContainer : COLORS.onSurface,
          fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18,
          boxShadow: isLast ? "0 10px 30px rgba(202,253,0,0.3)" : "none",
          transition: "all 0.3s",
        }}>
          {isLast ? "Empezar mi reto" : "Siguiente"}
        </button>

        {/* Skip */}
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
  const [state, setState] = useState(getInitialState);
  const [achievementModal, setAchievementModal] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !window.sessionStorage?.getItem?.("1de100_onboarded"); } catch { return true; }
  });

  const checkAchievements = useCallback((newState) => {
    const stats = {
      totalSessions: Object.values(newState.activities).flat().length,
      daysAt100: Object.entries(newState.activities).filter(([_, acts]) => acts.reduce((s, a) => s + a.reps, 0) >= 100).length,
      weekendDays: Object.entries(newState.activities).filter(([date]) => { const d = new Date(date); return d.getDay() === 0 || d.getDay() === 6; }).filter(([_, acts]) => acts.length > 0).length,
      earlyWorkouts: Object.values(newState.activities).flat().filter((a) => { const h = parseInt(a.time?.split(":")[0]); return h < 8; }).length,
      maxStreak: getStreak(newState),
      exerciseTotals: {},
    };
    Object.values(newState.activities).flat().forEach((a) => {
      stats.exerciseTotals[a.exercise] = (stats.exerciseTotals[a.exercise] || 0) + a.reps;
    });

    let newBadge = null;
    const newUnlocked = [...newState.unlockedBadges];
    for (const badge of ALL_BADGES) {
      if (!newUnlocked.includes(badge.id) && badge.condition(stats)) {
        newUnlocked.push(badge.id);
        newBadge = badge;
      }
    }

    return { ...newState, unlockedBadges: newUnlocked, stats, newBadge };
  }, []);

  const handleRegister = useCallback((exerciseId, reps) => {
    setState((prev) => {
      const key = todayKey();
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const newActivities = { ...prev.activities, [key]: [...(prev.activities[key] || []), { exercise: exerciseId, reps, time }] };
      const newState = { ...prev, activities: newActivities };
      const checked = checkAchievements(newState);
      if (checked.newBadge) {
        setTimeout(() => setAchievementModal(checked.newBadge), 300);
      }
      const { newBadge, ...cleanState } = checked;
      return cleanState;
    });
    setScreen("dashboard");
  }, [checkAchievements]);

  const level = getLevel(state);

  return (
    <div style={{
      background: COLORS.surface, color: COLORS.onSurface, fontFamily: "'Manrope', sans-serif",
      minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative",
      WebkitFontSmoothing: "antialiased",
    }}>

      {showOnboarding ? (
        <OnboardingScreen onComplete={() => {
          try { window.sessionStorage?.setItem?.("1de100_onboarded", "1"); } catch {}
          setShowOnboarding(false);
        }} />
      ) : (
        <>
          <TopBar onBadgeClick={() => setScreen("badges")} />

          {screen === "dashboard" && <DashboardScreen state={state} onNavigate={setScreen} />}
          {screen === "activity" && <ActivityScreen state={state} onRegister={handleRegister} />}
          {screen === "library" && <LibraryScreen />}
          {screen === "badges" && <BadgesScreen state={state} />}

          <BottomNav active={screen} onNavigate={setScreen} />

          <AchievementModal
            badge={achievementModal}
            level={level}
            onClose={() => setAchievementModal(null)}
          />
        </>
      )}
    </div>
  );
}
