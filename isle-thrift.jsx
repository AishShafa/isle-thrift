import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, X, Check, Tag, MapPin, Copy, CheckCircle2, Sparkles,
  Heart, MessageCircle, Home, User, ChevronLeft, ChevronRight, Send, Phone,
} from "lucide-react";

const COLORS = {
  bg: "#FFF9F2",
  card: "#FFFFFF",
  ink: "#16213E",
  inkSoft: "#4B5675",
  coral: "#FF5A4E",
  coralDeep: "#E8402F",
  teal: "#0FBFA6",
  tealDeep: "#0A8F7C",
  sun: "#FFC24B",
  line: "#F0E6D8",
  violet: "#8B6BFF",
};

const CATEGORIES = ["Clothing", "Electronics", "Furniture", "Home", "Books", "Sports", "Baby & Kids", "Other"];
const ISLANDS = ["Male'", "Hulhumale'", "Villimale'", "Addu", "Fuvahmulah", "Kulhudhuffushi", "Other"];
const AVATAR_TONES = ["#FF5A4E", "#0FBFA6", "#8B6BFF", "#FFC24B", "#3D8BFF", "#00C48C", "#FF8FB1"];

const CATEGORY_TONE = {
  Clothing: "#FF5A4E", Electronics: "#0FBFA6", Furniture: "#FFC24B", Home: "#8B6BFF",
  Books: "#3D8BFF", Sports: "#00C48C", "Baby & Kids": "#FF8FB1", Other: "#9AA0B4",
};

const LISTINGS_KEY = "isle-thrift-listings-v2";
const MESSAGES_KEY_PREFIX = "isle-thrift-msgs-";
const PROFILE_KEY = "isle-thrift-my-profile";
const FAVORITES_KEY = "isle-thrift-my-favorites";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function initials(name) { return (name || "?").trim().slice(0, 1).toUpperCase(); }
function toneFor(name) {
  const i = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_TONES[i % AVATAR_TONES.length];
}

function Avatar({ name, size = 32 }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold shrink-0"
      style={{ width: size, height: size, background: toneFor(name), color: "#fff", fontSize: size * 0.42 }}
    >
      {initials(name)}
    </div>
  );
}

function Chip({ label, active, onClick, tone }) {
  return (
    <button
      onClick={onClick}
      className="text-xs font-semibold px-3.5 py-1.5 mr-2 mb-2 inline-flex items-center rounded-full transition-all active:scale-95"
      style={{
        background: active ? tone : COLORS.card, color: active ? "#fff" : COLORS.ink,
        border: `2px solid ${active ? tone : COLORS.line}`,
        boxShadow: active ? `0 3px 0 0 ${tone}55` : "none",
      }}
    >
      {label}
    </button>
  );
}

function NavButton({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative">
      {badge > 0 && (
        <span className="absolute top-1 right-[28%] w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: COLORS.coral }}>
          {badge}
        </span>
      )}
      <div style={{ color: active ? COLORS.coral : COLORS.inkSoft }}>{icon}</div>
      <span className="text-[10px] font-semibold" style={{ color: active ? COLORS.coral : COLORS.inkSoft }}>{label}</span>
    </button>
  );
}

export default function IsleThrift() {
  const [listings, setListings] = useState(null);
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState(null);

  const [view, setView] = useState("feed"); // feed | favorites | messages | profile
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [islandFilter, setIslandFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [selected, setSelected] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const [chatListing, setChatListing] = useState(null);
  const [chatMessages, setChatMessages] = useState(null);
  const [chatInput, setChatInput] = useState("");

  const [form, setForm] = useState({
    title: "", price: "", category: CATEGORIES[0], island: ISLANDS[0],
    description: "", contact: "", images: [""],
  });
  const [formError, setFormError] = useState("");
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(LISTINGS_KEY, true);
        setListings(res ? JSON.parse(res.value) : []);
      } catch { setListings([]); }
      try {
        const p = await window.storage.get(PROFILE_KEY, false);
        if (p) setProfile(JSON.parse(p.value));
        else setShowProfileSetup(true);
      } catch { setShowProfileSetup(true); }
      try {
        const f = await window.storage.get(FAVORITES_KEY, false);
        setFavorites(f ? JSON.parse(f.value) : []);
      } catch { setFavorites([]); }
    })();
  }, []);

  async function persistListings(next) {
    setListings(next);
    try {
      const r = await window.storage.set(LISTINGS_KEY, JSON.stringify(next), true);
      if (!r) setError("Could not save. Please try again.");
    } catch { setError("Could not save. Please try again."); }
  }

  async function saveProfile(name) {
    const p = { name: name.trim() };
    setProfile(p);
    try { await window.storage.set(PROFILE_KEY, JSON.stringify(p), false); } catch {}
    setShowProfileSetup(false);
  }

  async function toggleFavorite(id) {
    const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
    setFavorites(next);
    try { await window.storage.set(FAVORITES_KEY, JSON.stringify(next), false); } catch {}
  }

  function resetForm() {
    setForm({ title: "", price: "", category: CATEGORIES[0], island: ISLANDS[0], description: "", contact: "", images: [""] });
    setFormError("");
  }

  async function submitListing(e) {
    e.preventDefault();
    if (!profile?.name) { setFormError("Set up your seller name first."); return; }
    if (!form.title.trim() || !form.price.trim() || !form.contact.trim() || !form.description.trim()) {
      setFormError("Please fill in title, price, description and contact number.");
      return;
    }
    setSaving(true);
    const cleanImages = form.images.map((i) => i.trim()).filter(Boolean);
    const newListing = {
      id: uid(), ...form, images: cleanImages, price: form.price.trim(),
      seller: profile.name, sold: false, createdAt: Date.now(),
    };
    await persistListings([newListing, ...(listings || [])]);
    setSaving(false);
    setShowForm(false);
    resetForm();
  }

  async function toggleSold(id) {
    const next = (listings || []).map((l) => (l.id === id ? { ...l, sold: !l.sold } : l));
    await persistListings(next);
    setSelected((s) => (s && s.id === id ? { ...s, sold: !s.sold } : s));
  }

  const filtered = useMemo(() => {
    if (!listings) return [];
    return listings.filter((l) => {
      if (catFilter !== "All" && l.category !== catFilter) return false;
      if (islandFilter !== "All" && l.island !== islandFilter) return false;
      if (query.trim() && !l.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [listings, catFilter, islandFilter, query]);

  const favoriteListings = useMemo(
    () => (listings || []).filter((l) => favorites.includes(l.id)),
    [listings, favorites]
  );

  const myListings = useMemo(
    () => (listings || []).filter((l) => l.seller === profile?.name),
    [listings, profile]
  );

  function copyContact(num) {
    navigator.clipboard?.writeText(num);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function openChat(listing) {
    setChatListing(listing);
    setChatMessages(null);
    try {
      const r = await window.storage.get(MESSAGES_KEY_PREFIX + listing.id, true);
      setChatMessages(r ? JSON.parse(r.value) : []);
    } catch { setChatMessages([]); }
  }

  async function sendMessage() {
    if (!chatInput.trim() || !chatListing) return;
    const msg = { id: uid(), sender: profile?.name || "Guest", text: chatInput.trim(), ts: Date.now() };
    const next = [...(chatMessages || []), msg];
    setChatMessages(next);
    setChatInput("");
    try { await window.storage.set(MESSAGES_KEY_PREFIX + chatListing.id, JSON.stringify(next), true); } catch {}
  }

  const unreadCount = 0; // placeholder — real backend would track read state per user

  function ListingCard({ l }) {
    const isFav = favorites.includes(l.id);
    const cover = l.images && l.images[0];
    return (
      <div
        className="relative overflow-hidden rounded-2xl cursor-pointer transition-transform"
        style={{ background: COLORS.card, border: `1.5px solid ${COLORS.line}`, opacity: l.sold ? 0.55 : 1 }}
        onClick={() => { setSelected(l); setPhotoIdx(0); }}
      >
        <div
          className="w-full relative flex items-center justify-center"
          style={{ aspectRatio: "1 / 1", background: cover ? `center/cover no-repeat url(${cover})` : CATEGORY_TONE[l.category] + "20" }}
        >
          {!cover && <Tag size={28} style={{ color: CATEGORY_TONE[l.category] }} />}
          {l.images && l.images.length > 1 && (
            <span className="absolute bottom-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "rgba(22,33,62,0.65)" }}>
              1/{l.images.length}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(l.id); }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.9)" }}
          >
            <Heart size={14} fill={isFav ? COLORS.coral : "none"} color={isFav ? COLORS.coral : COLORS.inkSoft} />
          </button>
          {l.sold && (
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: COLORS.ink }}>SOLD</span>
          )}
        </div>
        <div className="p-2.5">
          <div className="font-mono text-sm font-bold mb-0.5" style={{ color: COLORS.coralDeep }}>MVR {l.price}</div>
          <div className="text-xs font-semibold mb-1.5 line-clamp-1">{l.title}</div>
          <div className="flex items-center gap-1.5">
            <Avatar name={l.seller} size={16} />
            <span className="text-[11px] font-medium truncate" style={{ color: COLORS.inkSoft }}>{l.seller}</span>
            <span className="text-[11px]" style={{ color: COLORS.inkSoft }}>· {l.island}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.ink, fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif", paddingBottom: "72px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@600;700&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        input:focus, textarea:focus, select:focus, button:focus-visible { outline: 2.5px solid ${COLORS.violet}; outline-offset: 2px; }
        .card-hover:hover { transform: translateY(-3px); }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } .card-hover:hover { transform: none; } }
      `}</style>

      {/* Header */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.coral} 0%, ${COLORS.violet} 100%)` }}>
        <div className="absolute rounded-full" style={{ width: "220px", height: "220px", background: COLORS.sun, opacity: 0.22, top: "-110px", right: "-50px" }} />
        <div className="max-w-5xl mx-auto px-5 pt-6 pb-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.22)" }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <h1 className="font-display text-2xl tracking-tight text-white" style={{ fontWeight: 700 }}>Isle Thrift</h1>
            </div>
            {profile && (
              <button onClick={() => setView("profile")} className="flex items-center gap-2 px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }}>
                <Avatar name={profile.name} size={26} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(255,255,255,0.92)", borderRadius: "16px" }}>
            <Search size={17} style={{ color: COLORS.coral }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search listings…" className="w-full bg-transparent text-sm outline-none font-medium" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        {view === "feed" && (
          <>
            <div className="mb-2">
              <Chip label="All items" active={catFilter === "All"} onClick={() => setCatFilter("All")} tone={COLORS.ink} />
              {CATEGORIES.map((c) => <Chip key={c} label={c} active={catFilter === c} onClick={() => setCatFilter(c)} tone={CATEGORY_TONE[c]} />)}
            </div>
            <div className="mb-6">
              <Chip label="All islands" active={islandFilter === "All"} onClick={() => setIslandFilter("All")} tone={COLORS.tealDeep} />
              {ISLANDS.map((i) => <Chip key={i} label={i} active={islandFilter === i} onClick={() => setIslandFilter(i)} tone={COLORS.teal} />)}
            </div>
            {error && <div className="text-sm font-medium mb-4 px-3 py-2 rounded-xl" style={{ background: "#FFE4E0", color: COLORS.coralDeep }}>{error}</div>}
            {listings === null ? (
              <div className="text-center py-24 text-sm font-medium" style={{ color: COLORS.inkSoft }}>loading listings…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="font-display text-xl font-bold mb-1">Nothing here yet</p>
                <p className="text-sm" style={{ color: COLORS.inkSoft }}>Be the first to post in this category or island.</p>
              </div>
            ) : (
              <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {filtered.map((l) => <ListingCard key={l.id} l={l} />)}
              </div>
            )}
          </>
        )}

        {view === "favorites" && (
          <>
            <h2 className="font-display text-xl font-bold mb-4">Your favorites</h2>
            {favoriteListings.length === 0 ? (
              <div className="text-center py-20">
                <Heart size={28} style={{ color: COLORS.line }} className="mx-auto mb-2" />
                <p className="text-sm" style={{ color: COLORS.inkSoft }}>Tap the heart on any listing to save it here.</p>
              </div>
            ) : (
              <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {favoriteListings.map((l) => <ListingCard key={l.id} l={l} />)}
              </div>
            )}
          </>
        )}

        {view === "messages" && (
          <>
            <h2 className="font-display text-xl font-bold mb-4">Messages</h2>
            {myListings.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Post a listing to start receiving messages from buyers, or open a listing you're interested in to message the seller.</p>
            ) : (
              <div className="grid gap-2">
                {myListings.map((l) => (
                  <button key={l.id} onClick={() => openChat(l)} className="flex items-center gap-3 p-3 rounded-2xl text-left" style={{ background: COLORS.card, border: `1.5px solid ${COLORS.line}` }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: l.images?.[0] ? `center/cover no-repeat url(${l.images[0]})` : CATEGORY_TONE[l.category] + "20" }}>
                      {!l.images?.[0] && <Tag size={16} style={{ color: CATEGORY_TONE[l.category] }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{l.title}</div>
                      <div className="text-xs" style={{ color: COLORS.inkSoft }}>Tap to view conversation</div>
                    </div>
                    <MessageCircle size={18} style={{ color: COLORS.teal }} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {view === "profile" && profile && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <Avatar name={profile.name} size={56} />
              <div>
                <div className="font-display text-xl font-bold">{profile.name}</div>
                <div className="text-xs" style={{ color: COLORS.inkSoft }}>{myListings.length} item{myListings.length !== 1 ? "s" : ""} listed</div>
              </div>
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: COLORS.inkSoft }}>My listings</h3>
            {myListings.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>You haven't posted anything yet.</p>
            ) : (
              <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {myListings.map((l) => <ListingCard key={l.id} l={l} />)}
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center" style={{ background: COLORS.card, borderTop: `1.5px solid ${COLORS.line}`, height: "64px" }}>
        <NavButton icon={<Home size={19} />} label="Feed" active={view === "feed"} onClick={() => setView("feed")} />
        <NavButton icon={<Heart size={19} />} label="Saved" active={view === "favorites"} onClick={() => setView("favorites")} />
        <button
          onClick={() => { setShowForm(true); setFormError(""); }}
          className="w-12 h-12 rounded-full flex items-center justify-center -mt-6 shrink-0"
          style={{ background: COLORS.coral, boxShadow: "0 4px 10px rgba(255,90,78,0.4)" }}
        >
          <Plus size={22} color="#fff" strokeWidth={2.5} />
        </button>
        <NavButton icon={<MessageCircle size={19} />} label="Chats" active={view === "messages"} onClick={() => setView("messages")} badge={unreadCount} />
        <NavButton icon={<User size={19} />} label="Profile" active={view === "profile"} onClick={() => setView("profile")} />
      </nav>

      {/* Profile setup modal */}
      {showProfileSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,33,62,0.6)" }}>
          <div className="w-full max-w-sm p-6 rounded-2xl" style={{ background: COLORS.card }}>
            <h2 className="font-display text-xl font-bold mb-1">Welcome to Isle Thrift</h2>
            <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>Pick a name buyers and sellers will see. This is stored only on your device.</p>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Aisha"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl mb-3"
              style={{ border: `2px solid ${COLORS.line}` }}
            />
            <button
              onClick={() => nameInput.trim() && saveProfile(nameInput)}
              className="w-full py-3 text-sm font-bold rounded-2xl"
              style={{ background: COLORS.coral, color: "#fff" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Listing detail modal */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(22,33,62,0.55)" }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-3xl" style={{ background: COLORS.card, maxHeight: "88vh", overflowY: "auto" }}>
            <div className="w-full relative flex items-center justify-center" style={{ height: "260px", background: selected.images?.[photoIdx] ? `center/cover no-repeat url(${selected.images[photoIdx]})` : CATEGORY_TONE[selected.category] + "20" }}>
              {!selected.images?.[photoIdx] && <Tag size={36} style={{ color: CATEGORY_TONE[selected.category] }} />}
              {selected.images && selected.images.length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx((i) => (i - 1 + selected.images.length) % selected.images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.85)" }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setPhotoIdx((i) => (i + 1) % selected.images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.85)" }}>
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-2 flex gap-1">
                    {selected.images.map((_, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.5)" }} />
                    ))}
                  </div>
                </>
              )}
              <button onClick={() => toggleFavorite(selected.id)} className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.9)" }}>
                <Heart size={16} fill={favorites.includes(selected.id) ? COLORS.coral : "none"} color={favorites.includes(selected.id) ? COLORS.coral : COLORS.inkSoft} />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="font-display text-xl font-bold">{selected.title}</h2>
                <button onClick={() => setSelected(null)} aria-label="Close"><X size={20} /></button>
              </div>
              <div className="font-mono text-lg font-bold mb-3" style={{ color: COLORS.coralDeep }}>MVR {selected.price}</div>
              <div className="flex items-center gap-3 text-xs font-medium mb-4" style={{ color: COLORS.inkSoft }}>
                <span className="flex items-center gap-1"><MapPin size={12} /> {selected.island}</span>
                <span className="px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_TONE[selected.category], fontSize: "10px", fontWeight: 700 }}>{selected.category}</span>
                <span>{timeAgo(selected.createdAt)}</span>
              </div>
              <p className="text-sm mb-5 leading-relaxed">{selected.description}</p>

              <div className="flex items-center gap-2.5 p-3 mb-4 rounded-2xl" style={{ background: COLORS.bg, border: `2px solid ${COLORS.line}` }}>
                <Avatar name={selected.seller} size={36} />
                <div className="flex-1">
                  <div className="text-sm font-bold">{selected.seller}</div>
                  <div className="text-[11px]" style={{ color: COLORS.inkSoft }}>Seller on Isle Thrift</div>
                </div>
              </div>

              <button onClick={() => openChat(selected)} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-2xl mb-2.5" style={{ background: COLORS.teal, color: "#fff" }}>
                <MessageCircle size={16} /> Message seller
              </button>

              <div className="p-3 mb-4 rounded-2xl" style={{ background: COLORS.bg, border: `2px solid ${COLORS.line}` }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-sm font-semibold"><Phone size={13} style={{ color: COLORS.inkSoft }} /> {selected.contact}</span>
                  <button onClick={() => copyContact(selected.contact)} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl" style={{ background: COLORS.ink, color: "#fff" }}>
                    {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-[11px] mt-2" style={{ color: COLORS.inkSoft }}>Pay by bank transfer once you've agreed on details with the seller.</p>
              </div>

              {selected.seller === profile?.name && (
                <button onClick={() => toggleSold(selected.id)} className="w-full flex items-center justify-center gap-1.5 text-sm font-bold py-3 rounded-2xl" style={{ border: `2px solid ${COLORS.line}` }}>
                  <Check size={15} /> {selected.sold ? "Mark as available" : "Mark as sold"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat modal */}
      {chatListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,33,62,0.6)" }} onClick={() => setChatListing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl flex flex-col" style={{ background: COLORS.card, height: "70vh" }}>
            <div className="flex items-center gap-3 p-4" style={{ borderBottom: `1.5px solid ${COLORS.line}` }}>
              <Avatar name={chatListing.seller} size={34} />
              <div className="flex-1">
                <div className="text-sm font-bold">{chatListing.seller}</div>
                <div className="text-[11px] truncate" style={{ color: COLORS.inkSoft }}>{chatListing.title}</div>
              </div>
              <button onClick={() => setChatListing(null)}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {chatMessages === null ? (
                <div className="text-center text-sm py-8" style={{ color: COLORS.inkSoft }}>loading…</div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center text-sm py-8" style={{ color: COLORS.inkSoft }}>Say hello and ask about the item.</div>
              ) : chatMessages.map((m) => {
                const mine = m.sender === profile?.name;
                return (
                  <div key={m.id} className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${mine ? "self-end" : "self-start"}`} style={{ background: mine ? COLORS.coral : COLORS.bg, color: mine ? "#fff" : COLORS.ink }}>
                    {!mine && <div className="text-[10px] font-bold mb-0.5 opacity-70">{m.sender}</div>}
                    {m.text}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 p-3" style={{ borderTop: `1.5px solid ${COLORS.line}` }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl"
                style={{ border: `2px solid ${COLORS.line}` }}
              />
              <button onClick={sendMessage} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: COLORS.coral }}>
                <Send size={16} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(22,33,62,0.55)" }} onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitListing} className="w-full max-w-md p-5 rounded-3xl" style={{ background: COLORS.card, maxHeight: "88vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Post an ad</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            {formError && <div className="text-sm font-medium mb-3 px-3 py-2 rounded-xl" style={{ background: "#FFE4E0", color: COLORS.coralDeep }}>{formError}</div>}
            <div className="grid gap-3">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Photos</label>
              {form.images.map((img, idx) => (
                <input
                  key={idx}
                  value={img}
                  onChange={(e) => { const imgs = [...form.images]; imgs[idx] = e.target.value; setForm({ ...form, images: imgs }); }}
                  placeholder={`Photo URL ${idx + 1}`}
                  className="px-3.5 py-2.5 text-sm rounded-xl"
                  style={{ border: `2px solid ${COLORS.line}` }}
                />
              ))}
              {form.images.length < 4 && (
                <button type="button" onClick={() => setForm({ ...form, images: [...form.images, ""] })} className="text-xs font-bold text-left" style={{ color: COLORS.teal }}>
                  + Add another photo
                </button>
              )}

              <label className="text-xs font-bold uppercase tracking-wide mt-1" style={{ color: COLORS.inkSoft }}>Item title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Rattan armchair" className="px-3.5 py-2.5 text-sm rounded-xl" style={{ border: `2px solid ${COLORS.line}` }} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Price (MVR)</label>
                  <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="450" className="w-full px-3.5 py-2.5 text-sm mt-1 rounded-xl" style={{ border: `2px solid ${COLORS.line}` }} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Contact number</label>
                  <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="7xxxxxx" className="w-full px-3.5 py-2.5 text-sm mt-1 rounded-xl" style={{ border: `2px solid ${COLORS.line}` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3.5 py-2.5 text-sm mt-1 rounded-xl" style={{ border: `2px solid ${COLORS.line}` }}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Island</label>
                  <select value={form.island} onChange={(e) => setForm({ ...form, island: e.target.value })} className="w-full px-3.5 py-2.5 text-sm mt-1 rounded-xl" style={{ border: `2px solid ${COLORS.line}` }}>
                    {ISLANDS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Condition, age, why you're selling…" rows={3} className="px-3.5 py-2.5 text-sm rounded-xl" style={{ border: `2px solid ${COLORS.line}` }} />

              <button type="submit" disabled={saving} className="mt-2 w-full py-3 text-sm font-bold rounded-2xl" style={{ background: COLORS.coral, color: "#fff", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Posting…" : "Post ad"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
