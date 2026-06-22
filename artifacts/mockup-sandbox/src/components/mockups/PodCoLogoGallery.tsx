import { useEffect } from "react";

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Madelyn&family=Montserrat:wght@700;900&display=swap";

function loadFonts() {
  if (document.getElementById("pod-co-fonts")) return;
  const link = document.createElement("link");
  link.id = "pod-co-fonts";
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_URL;
  document.head.appendChild(link);
}

// All SVGs use viewBox="0 0 800 400" with width/height="100%" so they scale
// responsively inside their container (min effective size ≥ 800×400 px at 1:1).

// ─── Logo Variants ─────────────────────────────────────────────────────────────

/** V1 — Cobalt Blue · Horizontal · Layered Pod Icon */
function Logo1() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="v1-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD43B" /><stop offset="100%" stopColor="#F59F00" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="#FFFFFF" />
      {/* Layered pod squares */}
      <rect x="52" y="110" width="148" height="148" rx="24" fill="none" stroke="#3B5BDB" strokeWidth="11" />
      <rect x="80" y="82"  width="148" height="148" rx="24" fill="none" stroke="#3B5BDB" strokeWidth="11" opacity="0.35" />
      {/* "the" */}
      <text x="250" y="188" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="80" fill="#3B5BDB" fontStyle="italic">the</text>
      {/* "POD Co." */}
      <text x="248" y="300" fontFamily="'Montserrat',sans-serif" fontSize="102" fontWeight="900" fill="#3B5BDB" letterSpacing="-2">POD Co.</text>
      <line x1="52" y1="326" x2="748" y2="326" stroke="#3B5BDB" strokeWidth="2" opacity="0.2" />
    </svg>
  );
}

/** V2 — Deep Navy + Gold · Stacked Centred · Geometric Pod */
function Logo2() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="v2-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD43B" /><stop offset="100%" stopColor="#F59F00" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="#0D1B3E" />
      <rect x="354" y="18" width="92" height="92" rx="24" fill="none" stroke="url(#v2-gold)" strokeWidth="7" />
      <rect x="372" y="36" width="56" height="56" rx="14" fill="url(#v2-gold)" opacity="0.2" />
      <text x="400" y="172" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="72" fill="#FFD43B" textAnchor="middle" fontStyle="italic">the</text>
      <text x="400" y="282" fontFamily="'Montserrat',sans-serif" fontSize="98" fontWeight="900" fill="#FFFFFF" textAnchor="middle" letterSpacing="-2">POD Co.</text>
      <rect x="218" y="300" width="364" height="3" rx="1.5" fill="url(#v2-gold)" />
    </svg>
  );
}

/** V3 — All-White on Charcoal · Soundwave Bars · Horizontal */
function Logo3() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="400" fill="#1A1A2E" />
      {[0,1,2,3,4,5,6].map((i) => {
        const h = [50,82,120,158,120,82,50][i];
        return <rect key={i} x={58 + i * 21} y={200 - h/2} width="13" height={h} rx="6" fill="#FFFFFF" opacity={0.52 + i * 0.05} />;
      })}
      <line x1="218" y1="108" x2="218" y2="292" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.25" />
      <text x="246" y="188" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="74" fill="#FFFFFF" opacity="0.9" fontStyle="italic">the</text>
      <text x="244" y="296" fontFamily="'Montserrat',sans-serif" fontSize="104" fontWeight="900" fill="#FFFFFF" letterSpacing="-2">POD Co.</text>
    </svg>
  );
}

/** V4 — Jet Black on Cream · Badge Lockup · Wordmark Only */
function Logo4() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="400" fill="#F5F0E8" />
      <circle cx="400" cy="200" r="172" fill="none" stroke="#1A1A1A" strokeWidth="6" />
      <circle cx="400" cy="200" r="158" fill="none" stroke="#1A1A1A" strokeWidth="1.5" />
      <text x="400" y="178" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="64" fill="#1A1A1A" textAnchor="middle" fontStyle="italic">the</text>
      <text x="400" y="256" fontFamily="'Montserrat',sans-serif" fontSize="76" fontWeight="900" fill="#1A1A1A" textAnchor="middle" letterSpacing="-1">POD Co.</text>
      <line x1="248" y1="200" x2="290" y2="200" stroke="#1A1A1A" strokeWidth="1.5" />
      <line x1="510" y1="200" x2="552" y2="200" stroke="#1A1A1A" strokeWidth="1.5" />
    </svg>
  );
}

/** V5 — Charcoal + Copper · Stacked · Abstract Mic Icon */
function Logo5() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="v5-cu" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8A87C" /><stop offset="100%" stopColor="#C4622D" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="#2D2D2D" />
      <rect x="368" y="18" width="64" height="100" rx="32" fill="none" stroke="url(#v5-cu)" strokeWidth="7" />
      <circle cx="400" cy="68" r="20" fill="url(#v5-cu)" />
      <line x1="400" y1="118" x2="400" y2="144" stroke="url(#v5-cu)" strokeWidth="6" strokeLinecap="round" />
      <path d="M366 144 Q400 172 434 144" fill="none" stroke="url(#v5-cu)" strokeWidth="6" strokeLinecap="round" />
      <text x="400" y="234" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="70" fill="#E8A87C" textAnchor="middle" fontStyle="italic">the</text>
      <text x="400" y="330" fontFamily="'Montserrat',sans-serif" fontSize="96" fontWeight="900" fill="#FFFFFF" textAnchor="middle" letterSpacing="-2">POD Co.</text>
    </svg>
  );
}

/** V6 — Dark Green + Ivory · Horizontal Right-Aligned · Overlapping Squares */
function Logo6() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="400" fill="#1B3A2D" />
      <text x="60" y="196" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="74" fill="#E8DCC8" fontStyle="italic">the</text>
      <text x="58" y="306" fontFamily="'Montserrat',sans-serif" fontSize="104" fontWeight="900" fill="#E8DCC8" letterSpacing="-2">POD Co.</text>
      {/* Overlapping squares on right */}
      <rect x="588" y="108" width="116" height="116" rx="18" fill="none" stroke="#E8DCC8" strokeWidth="7" opacity="0.9" />
      <rect x="618" y="138" width="116" height="116" rx="18" fill="none" stroke="#E8DCC8" strokeWidth="7" opacity="0.4" />
      <rect x="650" y="170" width="80" height="80" rx="12" fill="#E8DCC8" opacity="0.12" />
    </svg>
  );
}

/** V7 — Monochrome Black · Ultra-Condensed Stacked · Wordmark Only */
function Logo7() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="400" fill="#FFFFFF" />
      <rect x="170" y="68" width="460" height="4" fill="#000000" />
      <text x="400" y="170" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="76" fill="#000000" textAnchor="middle" fontStyle="italic">the</text>
      <text x="400" y="284" fontFamily="'Montserrat',sans-serif" fontSize="114" fontWeight="900" fill="#000000" textAnchor="middle" letterSpacing="-6">POD Co.</text>
      <rect x="170" y="316" width="460" height="4" fill="#000000" />
    </svg>
  );
}

/** V8 — Blue Gradient · Horizontal · Pod + Soundwave Hybrid */
function Logo8() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="v8-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A" /><stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="v8-txt" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#BAE6FD" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#v8-bg)" />
      {/* Pod square */}
      <rect x="48" y="116" width="136" height="136" rx="26" fill="none" stroke="#FFFFFF" strokeWidth="7" />
      {/* Soundwave inside */}
      {[0,1,2,3,4].map((i) => {
        const h = [34,60,86,60,34][i];
        return <rect key={i} x={72 + i * 22} y={184 - h/2} width="12" height={h} rx="6" fill="#FFFFFF" opacity="0.94" />;
      })}
      <text x="228" y="200" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="78" fill="url(#v8-txt)" fontStyle="italic">the</text>
      <text x="226" y="310" fontFamily="'Montserrat',sans-serif" fontSize="106" fontWeight="900" fill="#FFFFFF" letterSpacing="-3">POD Co.</text>
    </svg>
  );
}

/** V9 — Navy + Gold · Circle Badge · Geometric Pod · Premium */
function Logo9() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="v9-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD43B" /><stop offset="100%" stopColor="#F08C00" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="#0A1628" />
      {/* Badge */}
      <circle cx="190" cy="200" r="164" fill="#0F2044" />
      <circle cx="190" cy="200" r="164" fill="none" stroke="url(#v9-gold)" strokeWidth="4" />
      <circle cx="190" cy="200" r="150" fill="none" stroke="url(#v9-gold)" strokeWidth="1" opacity="0.4" />
      {/* Pod icon */}
      <rect x="140" y="116" width="100" height="100" rx="22" fill="none" stroke="url(#v9-gold)" strokeWidth="6" />
      <rect x="158" y="134" width="64" height="64" rx="14" fill="url(#v9-gold)" opacity="0.18" />
      {/* "the" inside badge */}
      <text x="190" y="260" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="52" fill="#FFD43B" textAnchor="middle" fontStyle="italic">the</text>
      {/* "POD Co." right */}
      <text x="412" y="208" fontFamily="'Montserrat',sans-serif" fontSize="98" fontWeight="900" fill="#FFFFFF" letterSpacing="-2">POD</text>
      <text x="418" y="298" fontFamily="'Montserrat',sans-serif" fontSize="64" fontWeight="700" fill="url(#v9-gold)" letterSpacing="10">Co.</text>
    </svg>
  );
}

/** V10 — Rich Blue + White · Stacked · Pod Soundwave Bars */
function Logo10() {
  return (
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="400" fill="#3B5BDB" />
      {/* Pod housing bars */}
      <rect x="322" y="14" width="156" height="156" rx="34" fill="#FFFFFF" opacity="0.12" />
      <rect x="322" y="14" width="156" height="156" rx="34" fill="none" stroke="#FFFFFF" strokeWidth="7" />
      {[0,1,2,3].map((i) => {
        const h = [52,82,64,38][i];
        return <rect key={i} x={344 + i * 30} y={92 - h/2} width="18" height={h} rx="9" fill="#FFFFFF" />;
      })}
      <text x="400" y="238" fontFamily="'Madelyn','Dancing Script',cursive" fontSize="74" fill="#FFFFFF" textAnchor="middle" fontStyle="italic" opacity="0.94">the</text>
      <text x="400" y="342" fontFamily="'Montserrat',sans-serif" fontSize="100" fontWeight="900" fill="#FFFFFF" textAnchor="middle" letterSpacing="-2">POD Co.</text>
    </svg>
  );
}

// ─── Variant metadata ──────────────────────────────────────────────────────────

const variants = [
  { num: 1,  label: "Cobalt Blue — Horizontal + Layered Pod",             Component: Logo1  },
  { num: 2,  label: "Navy + Gold — Stacked + Geometric Pod",              Component: Logo2  },
  { num: 3,  label: "All-White on Dark — Soundwave + Horizontal",         Component: Logo3  },
  { num: 4,  label: "Jet Black on Cream — Circle Badge + Wordmark",       Component: Logo4  },
  { num: 5,  label: "Charcoal + Copper — Stacked + Mic Icon",             Component: Logo5  },
  { num: 6,  label: "Dark Green + Ivory — Horizontal + Overlapping Squares", Component: Logo6 },
  { num: 7,  label: "Monochrome Black — Condensed Wordmark Only",         Component: Logo7  },
  { num: 8,  label: "Blue Gradient — Horizontal + Pod Soundwave",         Component: Logo8  },
  { num: 9,  label: "Navy + Gold Badge — Premium Circle Lockup",          Component: Logo9  },
  { num: 10, label: "Rich Blue + White — Stacked + Pod Bars",             Component: Logo10 },
];

// ─── Gallery ──────────────────────────────────────────────────────────────────

export default function PodCoLogoGallery() {
  useEffect(() => { loadFonts(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#111118", padding: "48px 40px", fontFamily: "'Montserrat',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "52px" }}>
        <p style={{ fontFamily: "'Madelyn',cursive", fontSize: "28px", color: "#9CA3AF", margin: "0 0 4px", letterSpacing: "1px" }}>the</p>
        <h1 style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: "42px", color: "#FFFFFF", margin: "0 0 8px", letterSpacing: "-1px" }}>
          POD Co. — Logo Variants
        </h1>
        <p style={{ color: "#6B7280", fontSize: "15px", margin: 0 }}>10 premium logo explorations · Pick your favourite</p>
      </div>

      {/* 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "28px", maxWidth: "1600px", margin: "0 auto" }}>
        {variants.map(({ num, label, Component }) => (
          <div key={num} style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {/* Logo canvas — 800×400 aspect ratio, SVG fills it responsively */}
            <div style={{ width: "100%", aspectRatio: "2 / 1", overflow: "hidden", display: "block" }}>
              <Component />
            </div>
            {/* Label */}
            <div style={{ background: "#1A1A26", padding: "14px 20px", display: "flex", alignItems: "center", gap: "14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ background: "#3B5BDB", color: "#FFFFFF", fontWeight: 700, fontSize: "12px", borderRadius: "6px", padding: "3px 10px", letterSpacing: "0.5px", flexShrink: 0 }}>
                {num}
              </span>
              <span style={{ color: "#D1D5DB", fontSize: "14px", fontWeight: 500, letterSpacing: "0.2px" }}>
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: "52px", color: "#4B5563", fontSize: "13px" }}>
        The POD Co. · Master Brand · 2026
      </div>
    </div>
  );
}
