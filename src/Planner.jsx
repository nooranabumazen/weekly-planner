import React, { useState, useRef, useCallback, useEffect } from "react";
import { makeTask, getWeekDates, getUpcomingDates, DEFAULT_CATEGORIES, formatLocalDate } from "./usePlannerData";
import { db } from "./firebase";
import NotebooksPanel from "./NotebooksSidebar";
import JournalPanel from "./JournalPanel";
import ContactsPanel from "./ContactsPanel";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/* ─── Mobile detection ─── */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

/* ─── Search Highlight Helper ─── */
function HighlightText({ text, query }) {
  if (!query || !text) return text || "";
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text;
  return (
    <>{text.slice(0, idx)}<mark data-search-highlight style={{ background: "#c9a227", color: "#1a1a1a", borderRadius: 2, padding: "0 1px" }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>
  );
}

/* ─── Category Helpers ─── */
function getCatColor(categories, catId) {
  const cat = categories.find((c) => c.id === catId);
  return cat ? cat.color : "#e0ddd6";
}
function getCatName(categories, catId) {
  const cat = categories.find((c) => c.id === catId);
  return cat ? cat.name : "Other";
}

/* ─── Auto-detect category from task text ─── */
const CATEGORY_KEYWORDS = {
  cat_cleaning: ["clean", "vacuum", "mop", "dust", "laundry", "wash", "dishes", "tidy", "organize", "declutter", "wipe", "scrub", "sweep"],
  cat_cooking: ["cook", "bake", "recipe", "meal", "dinner", "lunch", "breakfast", "prep food", "grocery", "groceries", "kitchen", "roast", "grill", "fry", "soup", "salad"],
  cat_learning: ["learn", "module","study", "course", "lecture", "class", "homework", "research", "practice", "lesson", "tutorial", "certificate", "training", "coursera"],
  cat_crafts: ["read", "book", "draw", "paint", "craft", "art", "sketch", "sew", "knit", "crochet", "journal", "write", "pottery", "collage", "creative", "tatreez", "embroidery"],
  cat_sporas: ["sporas", "poetry", "land day", "olive branch", "magazine", "diaspora", "abulhawa", "book club"],
  cat_events: ["event", "party", "birthday", "dinner party", "gathering", "celebration", "concert", "show", "festival", "conference", "workshop"],
  cat_volunteering: ["volunteer", "red raccoon", "bike rescue", "house of friendship", "community", "donate", "fundraise", "advocacy"],
  cat_gardening: ["garden", "plant", "seed", "water", "prune", "harvest", "compost", "soil", "flower", "weed", "transplant", "mulch", "jerash"],
  cat_selfcare: ["shower", "tweeze", "brush", "hair", "nails", "exercise", "shave"],
};

function autoDetectCategory(text, categories) {
  const lower = text.toLowerCase();

  // "Self care" is a built-in keyword list, but users may have their own
  // category id/name. This maps self-care keywords onto the category whose
  // name matches "self care" (or "selfcare").
  const selfCareCategory = categories.find((c) => {
    const n = (c?.name || "").toLowerCase();
    return (
      c?.id === "cat_selfcare" ||
      /\bself\s*care\b/.test(n) ||
      n.includes("selfcare") ||
      n.includes("self care")
    );
  });
  const selfCareCategoryId = selfCareCategory?.id || null;

  // Check each category: use stored keywords if present, fall back to built-in defaults
  // Sort keywords longest-first so "shower" matches before "show"
  for (const cat of categories) {
    if (cat.id === "cat_none") continue;
    const storedKw = cat.keywords && cat.keywords.length > 0 ? cat.keywords : null;
    const builtinKw = CATEGORY_KEYWORDS[cat.id] || null;
    const isSelfCare = cat.id === "cat_selfcare" || (selfCareCategoryId && cat.id === selfCareCategoryId);
    const selfCareKw = isSelfCare ? CATEGORY_KEYWORDS.cat_selfcare : null;

    const keywords = (storedKw || builtinKw || selfCareKw || []).slice().sort((a, b) => b.length - a.length);
    for (const kw of keywords) {
      if (!kw) continue;
      // Multi-word keywords use includes (e.g. "prep food", "land day")
      // Single-word keywords use word boundary regex to prevent partial matches (e.g. "show" in "shower")
      const kwLower = kw.toLowerCase();
      if (kwLower.includes(" ")) {
        if (lower.includes(kwLower)) return cat.id;
      } else {
        const re = new RegExp("\\b" + kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
        if (re.test(lower)) return cat.id;
      }
    }
  }
  // Check custom categories by name match
  for (const cat of categories) {
    if (cat.id !== "cat_none" && lower.includes(cat.name.toLowerCase())) return cat.id;
  }
  return "cat_none";
}

/* ─── Compact Category Dot (shows detected color, click to override) ─── */
function CategoryDot({ categories, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const color = getCatColor(categories, selected);
  const name = getCatName(categories, selected);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <div onClick={() => setOpen(!open)} title={`Category: ${name} (click to change)`}
        style={{ width: 14, height: 14, borderRadius: 3, background: color, cursor: "pointer", border: "1.5px solid rgba(0,0,0,0.15)", flexShrink: 0 }} />
      <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{name}</span>
      {open && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, zIndex: 60, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: 5, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", display: "flex", gap: 3, flexWrap: "wrap", width: 130, marginBottom: 4 }}>
          {categories.map((cat) => (
            <div key={cat.id} onClick={() => { onSelect(cat.id); setOpen(false); }} title={cat.name}
              style={{ width: 18, height: 18, borderRadius: 3, background: cat.color, cursor: "pointer", border: selected === cat.id ? "2px solid #555" : "1.5px solid rgba(0,0,0,0.1)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Category Manager (full panel) ─── */
function CategoryManager({ categories, onChange, layout, onLayoutChange, darkMode, onDarkModeChange, taskFontSize, onTaskFontSizeChange, onGetBackups, onRestoreBackup, onExportData }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#B7D5E8");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [backups, setBackups] = useState(null);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [showBackups, setShowBackups] = useState(false);
  const addRef = useRef(null);
  const editRef = useRef(null);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus(); }, [editingId]);

  const PALETTE = [
    // Row 1: bold primaries + secondaries
    "#FF6B6B","#FF9F43","#FECA57","#48DBFB","#0ABDE3","#1DD1A1","#10AC84","#5F27CD",
    // Row 2: softer but still distinct
    "#EE5A24","#F79F1F","#A3CB38","#009432","#0652DD","#6F1E51","#ED4C67","#B53471",
    // Row 3: earth tones + muted
    "#D5A67B","#C49B66","#8B7355","#7B8D6F","#6B8E9B","#8B6B8E","#9B7B6B","#6B7B5A",
    // Row 4: pastels (lighter options)
    "#FFB8B8","#FFDAB8","#FFF3B8","#B8FFD6","#B8E8FF","#D6B8FF","#FFB8EB","#E0E0E0",
  ];

  const addCat = () => {
    if (newName.trim()) {
      const kw = newKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
      onChange([...categories, { id: "cat_" + Date.now(), name: newName.trim(), color: newColor, keywords: kw }]);
      setNewName(""); setNewColor("#B7D5E8"); setNewKeywords("");
    }
    setAdding(false);
  };

  const saveEdit = () => {
    if (editName.trim()) {
      const kw = editKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
      onChange(categories.map((c) => c.id === editingId ? { ...c, name: editName.trim(), color: editColor, keywords: kw } : c));
    }
    setEditingId(null);
  };

  const deleteCat = (id) => {
    if (categories.length <= 1) return;
    onChange(categories.filter((c) => c.id !== id));
  };

  const ColorGrid = ({ selected, onPick }) => (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "6px 0" }}>
      {PALETTE.map((c) => (
        <div key={c} onClick={() => onPick(c)} style={{
          width: 24, height: 24, borderRadius: 5, background: c, cursor: "pointer",
          border: selected === c ? "2.5px solid #444" : "1.5px solid rgba(0,0,0,0.08)",
          transition: "transform 0.1s",
          transform: selected === c ? "scale(1.15)" : "scale(1)",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Settings</span>
      </div>

      {/* Layout toggle */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", maxWidth: 500 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Planner Layout</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: "vertical", label: "Vertical (list)", icon: "\u2630" }, { id: "horizontal", label: "Horizontal (columns)", icon: "\u2637" }].map((opt) => (
            <button key={opt.id} onClick={() => onLayoutChange(opt.id)}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 6, cursor: "pointer",
                border: layout === opt.id ? "2px solid #8B6914" : "1.5px solid var(--border)",
                background: layout === opt.id ? "rgba(139,105,20,0.06)" : "#fff",
                color: layout === opt.id ? "#8B6914" : "#888",
                fontSize: 12, fontWeight: layout === opt.id ? 600 : 400,
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 18 }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dark mode toggle */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", maxWidth: 500 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Theme</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: false, label: "Light", icon: "\u2600" }, { id: true, label: "Dark", icon: "\u{1F319}" }].map((opt) => (
            <button key={String(opt.id)} onClick={() => onDarkModeChange(opt.id)}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 6, cursor: "pointer",
                border: darkMode === opt.id ? "2px solid #8B6914" : "1.5px solid var(--border)",
                background: darkMode === opt.id ? "rgba(139,105,20,0.06)" : "var(--bg-card)",
                color: darkMode === opt.id ? "#8B6914" : "var(--text-muted)",
                fontSize: 12, fontWeight: darkMode === opt.id ? 600 : 400,
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 18 }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task text size */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", maxWidth: 500 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Task Text Size</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: 11, label: "Small" }, { id: 13, label: "Default" }, { id: 15, label: "Large" }].map((opt) => (
            <button key={opt.id} onClick={() => onTaskFontSizeChange(opt.id)}
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                border: (taskFontSize || 13) === opt.id ? "2px solid #8B6914" : "1.5px solid var(--border)",
                background: (taskFontSize || 13) === opt.id ? "rgba(139,105,20,0.06)" : "var(--bg-card)",
                color: (taskFontSize || 13) === opt.id ? "#8B6914" : "var(--text-muted)",
                fontSize: opt.id, fontWeight: (taskFontSize || 13) === opt.id ? 600 : 400,
                transition: "all 0.15s",
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div style={{ padding: "12px 16px 4px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>Categories</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px", maxWidth: 500 }}>
        {categories.map((cat) => (
          <div key={cat.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
            {editingId === cat.id ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: editColor, flexShrink: 0, border: "1.5px solid rgba(0,0,0,0.1)" }} />
                  <input ref={editRef} value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                    style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", fontSize: 13, outline: "none", background: "var(--bg-card)", color: "var(--text)" }} />
                </div>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Auto-detect keywords (comma separated)</div>
                  <input value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)}
                    placeholder="e.g. clean, vacuum, mop, dust"
                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", fontSize: 12, outline: "none", background: "var(--bg-card)", color: "var(--text)", boxSizing: "border-box" }} />
                </div>
                <ColorGrid selected={editColor} onPick={setEditColor} />
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  <button onClick={saveEdit} style={{ background: "#555", color: "#fff", border: "none", borderRadius: 4, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: "5px 14px", cursor: "pointer", fontSize: 11 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: cat.color, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: "var(--text)" }}>{cat.name}</span>
                  {(cat.keywords?.length > 0 || CATEGORY_KEYWORDS[cat.id]) && (
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(cat.keywords || CATEGORY_KEYWORDS[cat.id] || []).join(", ")}
                    </div>
                  )}
                </div>
                <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); setEditKeywords((cat.keywords || CATEGORY_KEYWORDS[cat.id] || []).join(", ")); }}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>Edit</button>
                {cat.id !== "cat_none" && (
                  <button onClick={() => deleteCat(cat.id)}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "var(--text-faint)" }}
                    onMouseEnter={(e) => { e.target.style.color = "#c44"; e.target.style.borderColor = "#c44"; }}
                    onMouseLeave={(e) => { e.target.style.color = "#ccc"; e.target.style.borderColor = "var(--border)"; }}>Delete</button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add new category */}
        {adding ? (
          <div style={{ padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: newColor, flexShrink: 0, border: "1.5px solid rgba(0,0,0,0.1)" }} />
              <input ref={addRef} value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCat(); if (e.key === "Escape") setAdding(false); }}
                placeholder="Category name..." style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", fontSize: 13, outline: "none", background: "var(--bg-card)", color: "var(--text)" }} />
            </div>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Auto-detect keywords (comma separated)</div>
              <input value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="e.g. cook, bake, recipe, meal"
                style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", fontSize: 12, outline: "none", background: "var(--bg-card)", color: "var(--text)", boxSizing: "border-box" }} />
            </div>
            <ColorGrid selected={newColor} onPick={setNewColor} />
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <button onClick={addCat} style={{ background: "#555", color: "#fff", border: "none", borderRadius: 4, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Create</button>
              <button onClick={() => setAdding(false)} style={{ background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: "5px 14px", cursor: "pointer", fontSize: 11 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{
            marginTop: 12, width: "100%", background: "none", border: "1px dashed #ccc", borderRadius: 6,
            padding: "8px 0", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { e.target.style.borderColor = "#999"; e.target.style.color = "#666"; }}
            onMouseLeave={(e) => { e.target.style.borderColor = "#ccc"; e.target.style.color = "#999"; }}>
            + Add New Category
          </button>
        )}
      </div>

      {/* Backup & Restore */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", maxWidth: 500 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Backup & Restore</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={onExportData} style={{
            flex: 1, padding: "8px 12px", borderRadius: 6, cursor: "pointer",
            border: "1.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text)",
            fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {"\u2B07"} Export JSON
          </button>
          <button onClick={async () => { setBackupsLoading(true); setShowBackups(true); const b = await onGetBackups(); setBackups(b); setBackupsLoading(false); }} style={{
            flex: 1, padding: "8px 12px", borderRadius: 6, cursor: "pointer",
            border: "1.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text)",
            fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {"\uD83D\uDD04"} {showBackups ? "Refresh Backups" : "View Backups"}
          </button>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 8 }}>
          Backups are saved automatically around 12 AM and 12 PM daily, plus on first open. Last 7 are kept.
        </div>
        {showBackups && (
          <div>
            {backupsLoading && <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 0" }}>Loading backups...</div>}
            {backups && backups.length === 0 && <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "8px 0" }}>No backups yet. One will be created automatically.</div>}
            {backups && backups.map((b) => {
              const date = new Date(b.timestamp);
              const now = new Date();
              const isToday = date.toDateString() === now.toDateString();
              const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
              const label = isToday ? "Today" : isYesterday ? "Yesterday" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              return (
                <div key={b.id} style={{ padding: "8px 10px", marginBottom: 4, background: "var(--bg-surface)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}, {time}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                      {b.taskCount} tasks, {b.notebookCount} notes, {b.contactCount} contacts, {b.archiveCount} archived
                    </div>
                  </div>
                  {restoring === b.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={async () => { await onRestoreBackup(b.id); }} style={{ background: "#c44", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Yes, restore</button>
                      <button onClick={() => setRestoring(null)} style={{ background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 10, cursor: "pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setRestoring(b.id)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 10px", fontSize: 10, cursor: "pointer", color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.color = "var(--accent)"; }}
                      onMouseLeave={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--text-muted)"; }}>Restore</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
function ResizeHandle({ currentHeight, minHeight, maxHeight, onHeightChange }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = currentHeight;
    const onMouseMove = (e2) => {
      const diff = startY - e2.clientY;
      const newH = Math.max(minHeight, Math.min(maxHeight, startHeight + diff));
      onHeightChange(newH);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };
  return (
    <div onMouseDown={handleMouseDown} style={{
      height: 9, cursor: "ns-resize", display: "flex", alignItems: "center", justifyContent: "center",
      borderTop: "1px solid var(--border)", background: "var(--bg)", flexShrink: 0,
    }}>
      <div style={{ width: 30, height: 3, borderRadius: 2, background: "var(--border)" }} />
    </div>
  );
}

/* ─── Habits Tracker ─── */
function HabitsTracker({ dailyHabits, weeklyHabits, habitHistory, onToggleDaily, onToggleWeekly, onAddDaily, onAddWeekly, onDeleteDaily, onDeleteWeekly, onEditDaily, onEditWeekly, onReorderDaily, onReorderWeekly }) {
  const [addingDaily, setAddingDaily] = useState(false);
  const [addingWeekly, setAddingWeekly] = useState(false);
  const [newDaily, setNewDaily] = useState("");
  const [newWeekly, setNewWeekly] = useState("");
  const [editingHabit, setEditingHabit] = useState(null);
  const [editText, setEditText] = useState("");
  const [splitPct, setSplitPct] = useState(55);
  const [dragHabit, setDragHabit] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const dailyRef = useRef(null);
  const weeklyRef = useRef(null);
  const editRef = useRef(null);
  const containerRef = useRef(null);
  useEffect(() => { if (addingDaily && dailyRef.current) dailyRef.current.focus(); }, [addingDaily]);
  useEffect(() => { if (addingWeekly && weeklyRef.current) weeklyRef.current.focus(); }, [addingWeekly]);
  useEffect(() => { if (editingHabit && editRef.current) editRef.current.focus(); }, [editingHabit]);
  const addDH = () => { if (newDaily.trim()) { onAddDaily(newDaily.trim()); setNewDaily(""); } setAddingDaily(false); };
  const addWH = () => { if (newWeekly.trim()) { onAddWeekly(newWeekly.trim()); setNewWeekly(""); } setAddingWeekly(false); };
  const saveEdit = () => { if (editText.trim() && editingHabit) { if (editingHabit.type === "daily") onEditDaily(editingHabit.id, editText.trim()); else onEditWeekly(editingHabit.id, editText.trim()); } setEditingHabit(null); };
  const sLabel = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 };
  const chk = (on) => ({ width: 16, height: 16, borderRadius: 3, cursor: "pointer", border: on ? "none" : "1.5px solid var(--border)", background: on ? "#6a9955" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0, fontSize: 10, color: "#fff", fontWeight: 700 });
  const checkboxesWidth = 28 * 7 + 18; // 7 day columns + delete button

  const handleDividerDrag = (e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (e2) => {
      const x = (e2.clientX || e2.touches?.[0]?.clientX) - rect.left;
      const pct = Math.max(30, Math.min(70, (x / rect.width) * 100));
      setSplitPct(pct);
    };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleDailyDrop = (targetId) => {
    if (!dragHabit || dragHabit.type !== "daily" || dragHabit.id === targetId) { setDragHabit(null); return; }
    const items = [...dailyHabits];
    const fromIdx = items.findIndex((h) => h.id === dragHabit.id);
    const toIdx = items.findIndex((h) => h.id === targetId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    onReorderDaily(items);
    setDragHabit(null);
  };

  const handleWeeklyDrop = (targetId) => {
    if (!dragHabit || dragHabit.type !== "weekly" || dragHabit.id === targetId) { setDragHabit(null); return; }
    const items = [...weeklyHabits];
    const fromIdx = items.findIndex((h) => h.id === dragHabit.id);
    const toIdx = items.findIndex((h) => h.id === targetId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    onReorderWeekly(items);
    setDragHabit(null);
  };

  // Measure the longest daily habit name to set a fixed column width
  const nameColWidth = (() => {
    if (typeof document === "undefined" || dailyHabits.length === 0) return 120;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = "12px 'DM Sans', sans-serif";
    let maxW = 0;
    for (const h of dailyHabits) {
      const cnt = Object.values(h.checks).filter(Boolean).length;
      const text = h.name + " " + cnt + "/7";
      const w = ctx.measureText(text).width;
      if (w > maxW) maxW = w;
    }
    return Math.ceil(maxW) + 16; // 16px padding buffer
  })();

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>
      <div ref={containerRef} style={{ display: "flex", overflow: "hidden" }}>
      <div style={{ flex: `0 0 ${splitPct}%`, minWidth: 0, overflow: "hidden", paddingRight: 4 }}>
        <div style={sLabel}>Daily Habits</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: nameColWidth, flexShrink: 0 }} />
            {DAYS.map((d) => (<div key={d} style={{ width: 28, textAlign: "center", fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.5, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{d.slice(0,2)}</div>))}
            <div style={{ width: 18, flexShrink: 0 }} />
          </div>
          {dailyHabits.map((h) => {
            const cnt = Object.values(h.checks).filter(Boolean).length;
            return (
              <div key={h.id}>
              <div draggable onDragStart={() => setDragHabit({ id: h.id, type: "daily" })} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDailyDrop(h.id)}
                style={{ display: "flex", alignItems: "center", cursor: "grab", paddingBottom: 0, marginBottom: 0 }}>
                {editingHabit?.id === h.id && editingHabit?.type === "daily" ? (
                  <input ref={editRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={saveEdit}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingHabit(null); }}
                    style={{ width: nameColWidth, flexShrink: 0, border: "1px solid var(--border)", borderRadius: 3, padding: "1px 4px", fontSize: 12, outline: "none", background: "var(--input-bg)", color: "var(--text)", boxSizing: "border-box" }} />
                ) : (
                  <div onDoubleClick={() => { setEditingHabit({ id: h.id, type: "daily" }); setEditText(h.name); }}
                    style={{ width: nameColWidth, flexShrink: 0, fontSize: 12, color: "var(--text)", paddingRight: 6, wordBreak: "break-word", lineHeight: 1.3, cursor: "grab" }}>{h.name}<span style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: 4 }}>{cnt}/7</span></div>
                )}
                {DAYS.map((d) => (<div key={d} style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}><div onClick={() => onToggleDaily(h.id, d.toLowerCase())} style={chk(h.checks[d.toLowerCase()])}>{h.checks[d.toLowerCase()] && "\u2713"}</div></div>))}
                <button onClick={() => onDeleteDaily(h.id)} style={{ width: 18, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13, padding: 0, fontWeight: 600 }} onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "var(--text-faint)")}>&times;</button>
              </div>
              <div style={{ height: 0, borderBottom: "0.5px solid var(--border-light)", opacity: 0.5, marginBottom: 1 }} />
              </div>);
          })}
          {addingDaily ? (<div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><input ref={dailyRef} value={newDaily} onChange={(e) => setNewDaily(e.target.value)} onBlur={addDH} onKeyDown={(e) => { if (e.key === "Enter") addDH(); if (e.key === "Escape") setAddingDaily(false); }} placeholder="Habit name..." style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "3px 6px", fontSize: 11, outline: "none", background: "var(--input-bg)", color: "var(--text)" }} /></div>
          ) : (<button onClick={() => setAddingDaily(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 11, padding: "2px 0", textAlign: "left" }} onMouseEnter={(e) => (e.target.style.color = "var(--text-muted)")} onMouseLeave={(e) => (e.target.style.color = "var(--text-faint)")}>+ Add daily habit</button>)}
        </div>
      </div>
      {/* Draggable divider */}
      <div onMouseDown={handleDividerDrag} style={{ width: 8, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 3, height: 30, borderRadius: 2, background: "var(--border)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", paddingLeft: 4, display: "flex", flexDirection: "column" }}>
        <div style={sLabel}>Weekly Habits</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", visibility: "hidden" }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, fontFamily: "'JetBrains Mono', monospace" }}>&nbsp;</div>
          </div> {/* Invisible spacer matching daily habits day header row */}
          {weeklyHabits.map((h) => (
            <div key={h.id} draggable onDragStart={() => setDragHabit({ id: h.id, type: "weekly" })} onDragOver={(e) => e.preventDefault()} onDrop={() => handleWeeklyDrop(h.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "grab" }}>
              <div onClick={() => onToggleWeekly(h.id)} style={chk(h.done)}>{h.done && "\u2713"}</div>
              {editingHabit?.id === h.id && editingHabit?.type === "weekly" ? (
                <input ref={editRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={saveEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingHabit(null); }}
                  style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 3, padding: "1px 4px", fontSize: 12, outline: "none", background: "var(--input-bg)", color: "var(--text)" }} />
              ) : (
                <span onDoubleClick={() => { setEditingHabit({ id: h.id, type: "weekly" }); setEditText(h.name); }}
                  style={{ fontSize: 12, color: h.done ? "var(--text-muted)" : "var(--text)", textDecoration: h.done ? "line-through" : "none", wordBreak: "break-word", minWidth: 0, cursor: "grab" }}>{h.name}</span>
              )}
              <button onClick={() => onDeleteWeekly(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13, padding: 0, marginLeft: "auto", fontWeight: 600, flexShrink: 0 }} onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "var(--text-faint)")}>&times;</button>
            </div>
          ))}
          {addingWeekly ? (<input ref={weeklyRef} value={newWeekly} onChange={(e) => setNewWeekly(e.target.value)} onBlur={addWH} onKeyDown={(e) => { if (e.key === "Enter") addWH(); if (e.key === "Escape") setAddingWeekly(false); }} placeholder="Habit name..." style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "3px 6px", fontSize: 11, outline: "none", background: "var(--input-bg)", color: "var(--text)" }} />
          ) : (<button onClick={() => setAddingWeekly(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 11, padding: "2px 0", textAlign: "left" }} onMouseEnter={(e) => (e.target.style.color = "var(--text-muted)")} onMouseLeave={(e) => (e.target.style.color = "var(--text-faint)")}>+ Add weekly habit</button>)}
        </div>
      </div>
      </div>
      {/* Streaks section - centered below both habit columns */}
      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <button onClick={() => setShowStats(!showStats)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 9, padding: "2px 0", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}
          onMouseEnter={(e) => e.target.style.color = "var(--text-muted)"} onMouseLeave={(e) => e.target.style.color = "var(--text-faint)"}>
          {showStats ? "\u25BC" : "\u25B6"} Streaks
        </button>
      </div>
      {showStats && (() => {
        const weeks = Object.keys(habitHistory).sort().reverse();
        const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
        const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

        // Per-day completion for current week (momentum circles)
        const dailyByDay = dayKeys.map((d) => {
          const done = dailyHabits.filter((h) => h.checks[d]).length;
          return { day: d, done, total: dailyHabits.length };
        });

        // Figure out "today" index
        const todayIdx = (() => { const d = new Date().getDay(); return (d + 6) % 7; })();

        // Previous week per-day (from history)
        const prevWeek = weeks[0];
        const prev = prevWeek ? habitHistory[prevWeek] : null;
        const prevTotal = prev?.daily ? prev.daily.reduce((s, h) => s + Object.values(h.checks || {}).filter(Boolean).length, 0) : 0;
        const prevPossible = prev?.daily ? prev.daily.length * 7 : 0;
        const curTotal = dailyHabits.reduce((s, h) => s + Object.values(h.checks).filter(Boolean).length, 0);
        const curPossible = dailyHabits.length * 7;
        // Pace: are we on track to beat last week?
        const daysElapsed = todayIdx + 1;
        const curPace = daysElapsed > 0 ? Math.round(curTotal / daysElapsed * 7) : 0;

        // Per-habit streaks (consecutive weeks with 5+/7)
        const dailyStreaks = dailyHabits.map((h) => {
          let streak = 0;
          const curChecks = Object.values(h.checks).filter(Boolean).length;
          if (curChecks >= 5) streak++;
          else return { name: h.name, streak: 0, curChecks, improved: 0 };
          for (const wk of weeks) {
            const wData = habitHistory[wk]?.daily;
            if (!wData) break;
            const match = wData.find((hh) => hh.id === h.id || hh.name === h.name);
            if (match && Object.values(match.checks || {}).filter(Boolean).length >= 5) streak++;
            else break;
          }
          return { name: h.name, streak, curChecks, improved: 0 };
        });

        // Most improved: compare current checks to last week
        if (prev?.daily) {
          dailyStreaks.forEach((s) => {
            const habit = dailyHabits.find((h) => h.name === s.name);
            if (!habit) return;
            const curC = Object.values(habit.checks).filter(Boolean).length;
            const prevH = prev.daily.find((hh) => hh.id === habit.id || hh.name === habit.name);
            const prevC = prevH ? Object.values(prevH.checks || {}).filter(Boolean).length : 0;
            s.improved = curC - prevC;
          });
        }

        // Perfect weeks (7/7)
        const perfectThisWeek = dailyHabits.filter((h) => Object.values(h.checks).filter(Boolean).length === 7);

        // Longest active streak
        const longestStreak = dailyStreaks.reduce((best, s) => s.streak > best.streak ? s : best, { name: "", streak: 0 });

        // Most improved
        const mostImproved = dailyStreaks.reduce((best, s) => s.improved > best.improved ? s : best, { name: "", improved: 0 });

        // Close to milestone (streak of 3, 5, 8)
        const nearMilestone = dailyStreaks.filter((s) => s.streak > 0 && [2, 4, 7].includes(s.streak));

        // Circle component for momentum
        const circle = (pct, isFuture, isToday) => {
          const size = 22;
          const r = 9;
          const circ = 2 * Math.PI * r;
          const offset = circ * (1 - pct);
          const color = pct >= 0.8 ? "#6a9955" : pct >= 0.5 ? "#c9a227" : pct > 0 ? "#c47a20" : "var(--border)";
          return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={isFuture ? "var(--bg-hover)" : "var(--border)"} strokeWidth={2.5} />
              {!isFuture && pct > 0 && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={2.5}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />}
              {isToday && <circle cx={size/2} cy={size/2} r={1.5} fill="var(--accent)" />}
            </svg>
          );
        };

        const spotlights = [];

        // Longest active streak (lower threshold to 1 week)
        if (longestStreak.streak >= 1) spotlights.push({ icon: "\uD83D\uDD25", text: `${longestStreak.name}: ${longestStreak.streak}w streak${longestStreak.streak >= 3 ? "!" : ""}` });

        // Most improved this week vs last (threshold: 1+ more days)
        if (mostImproved.improved >= 1) spotlights.push({ icon: "\uD83D\uDCC8", text: `${mostImproved.name}: +${mostImproved.improved} day${mostImproved.improved > 1 ? "s" : ""} vs last week` });

        // Perfect week THIS week (7/7)
        perfectThisWeek.forEach((h) => spotlights.push({ icon: "\u2B50", text: `${h.name}: perfect week! (7/7)` }));

        // Last week achievements (from history)
        if (prev?.daily) {
          prev.daily.forEach((h) => {
            const done = Object.values(h.checks || {}).filter(Boolean).length;
            if (done === 7) spotlights.push({ icon: "\u2B50", text: `${h.name}: perfect last week! (7/7)` });
          });
          // Best daily habit last week
          const bestLast = prev.daily.reduce((best, h) => {
            const d = Object.values(h.checks || {}).filter(Boolean).length;
            return d > best.done ? { name: h.name, done: d } : best;
          }, { name: "", done: 0 });
          if (bestLast.done >= 5 && !spotlights.some((s) => s.text.includes(bestLast.name))) {
            spotlights.push({ icon: "\uD83D\uDCAA", text: `${bestLast.name}: ${bestLast.done}/7 last week` });
          }
        }

        // Weekly habits completed last week
        if (prev?.weekly) {
          const weeklyDone = prev.weekly.filter((h) => h.done);
          if (weeklyDone.length > 0 && weeklyDone.length === prev.weekly.length) {
            spotlights.push({ icon: "\uD83C\uDF1F", text: `All weekly habits completed last week!` });
          }
        }

        // Near milestone
        nearMilestone.forEach((s) => {
          const next = s.streak < 3 ? 3 : s.streak < 5 ? 5 : 8;
          spotlights.push({ icon: "\uD83C\uDFAF", text: `${s.name}: ${next - s.streak}w from ${next}-week streak` });
        });

        // Current week encouragement based on today's progress
        const todayDone = dailyHabits.filter((h) => {
          const todayKey = dayKeys[todayIdx];
          return h.checks[todayKey];
        }).length;
        if (todayDone === dailyHabits.length && dailyHabits.length > 0 && spotlights.length < 4) {
          spotlights.push({ icon: "\u2705", text: `All daily habits done today!` });
        }

        // Pace message
        let paceMsg = "";
        if (prev && daysElapsed >= 1) {
          if (curTotal >= prevTotal) paceMsg = "Already passed last week's total!";
          else if (curPace > prevTotal) paceMsg = `On pace to beat last week (projected ${curPace} vs ${prevTotal})`;
        }

        return (
          <div style={{ padding: "6px 12px 4px" }}>
            {/* Weekly momentum: day circles */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: spotlights.length > 0 || paceMsg ? 8 : 0 }}>
              {dayKeys.map((d, i) => {
                const dd = dailyByDay[i];
                const pct = dd.total > 0 ? dd.done / dd.total : 0;
                const isFuture = i > todayIdx;
                const isToday = i === todayIdx;
                return (
                  <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <span style={{ fontSize: 8, color: isToday ? "var(--accent)" : "var(--text-faint)", fontWeight: isToday ? 700 : 400, fontFamily: "'JetBrains Mono', monospace" }}>{dayLabels[i]}</span>
                    {circle(pct, isFuture, isToday)}
                    {!isFuture && <span style={{ fontSize: 7, color: pct >= 0.8 ? "#6a9955" : "var(--text-faint)" }}>{dd.done}/{dd.total}</span>}
                  </div>
                );
              })}
              {/* Weekly habits summary dot */}
              <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <span style={{ fontSize: 8, color: "var(--text-faint)", fontFamily: "'JetBrains Mono', monospace" }}>WK</span>
                {(() => {
                  const wd = weeklyHabits.filter((h) => h.done).length;
                  const wt = weeklyHabits.length;
                  const pct = wt > 0 ? wd / wt : 0;
                  return circle(pct, false, false);
                })()}
                <span style={{ fontSize: 7, color: "var(--text-faint)" }}>{weeklyHabits.filter((h) => h.done).length}/{weeklyHabits.length}</span>
              </div>
            </div>
            {/* Pace message */}
            {paceMsg && <div style={{ textAlign: "center", fontSize: 9, color: "#6a9955", fontWeight: 600, marginBottom: 4 }}>{paceMsg}</div>}
            {/* Best streaks spotlight */}
            {spotlights.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4 }}>
                {spotlights.map((s, i) => (
                  <span key={i} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "var(--bg-surface)", color: "var(--text-muted)", fontWeight: 500 }}>
                    {s.icon} {s.text}
                  </span>
                ))}
              </div>
            )}
            {weeks.length === 0 && !paceMsg && spotlights.length === 0 && <div style={{ textAlign: "center", fontSize: 9, color: "var(--text-faint)" }}>Streak history starts after your first full week</div>}
          </div>
        );
      })()}
    </div>
  );
}

/* ─── Notes ─── */
function NotesSection({ notes, onChange }) {
  return (
    <div style={{ padding: "6px 12px", boxSizing: "border-box" }}>
      <textarea value={notes} onChange={(e) => onChange(e.target.value)} placeholder="Jot things down here..."
        style={{ width: "100%", minHeight: 60, border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1.5, outline: "none", background: "var(--input-bg)", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", resize: "vertical", boxSizing: "border-box" }} />
    </div>
  );
}

/* ─── Task Card ─── */
function TaskCard({ task, columnId, categories, onDragStart, onToggle, onDelete, onEdit, onChangeCategory, isMobile, onMove, onSetRecurring, highlightQuery, taskFontSize }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [hover, setHover] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [repeatMenu, setRepeatMenu] = useState(false);
  const [repeatDate, setRepeatDate] = useState("");
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => {
    if (!showCatPicker) return;
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowCatPicker(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showCatPicker]);
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => { setCtxMenu(null); setRepeatMenu(false); setRepeatDate(""); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);
  const save = () => { if (editText.trim()) onEdit(columnId, task.id, editText.trim()); setEditing(false); };
  const catColor = getCatColor(categories, task.category);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div draggable={!editing}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: task.id, from: columnId })); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onContextMenu={handleContextMenu}
      style={{
        padding: isMobile ? "8px 12px" : "2px 4px",
        borderLeft: `3px solid ${catColor}`,
        background: hover ? "var(--bg-hover)" : `${catColor}18`,
        cursor: editing ? "text" : "grab",
        opacity: task.done ? 0.45 : 1, transition: "opacity 0.2s, background 0.15s",
        fontSize: isMobile ? 16 : (taskFontSize || 13), lineHeight: 1.4, userSelect: "none", position: "relative",
      }}>
      <input type="checkbox" checked={task.done} onChange={() => onToggle(columnId, task.id)}
        style={{ cursor: "pointer", accentColor: "#5a5a5a", float: "left", width: isMobile ? 20 : 15, height: isMobile ? 20 : 15, marginRight: isMobile ? 10 : 5, marginTop: 2 }} />
      {editing ? (
        <textarea ref={inputRef} value={editText} onChange={(e) => { setEditText(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") setEditing(false); }}
          style={{ width: "100%", border: "1px solid var(--border)", background: "var(--input-bg)", font: "inherit", outline: "none", padding: "2px 4px", fontSize: isMobile ? 16 : (taskFontSize || 13), lineHeight: 1.4, resize: "none", overflow: "hidden", borderRadius: 3, color: "var(--text)", boxSizing: "border-box", minHeight: 20 }}
          onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }} />
      ) : (
        <span onDoubleClick={() => { setEditing(true); setEditText(task.text); }}
          style={{ flex: 1, textDecoration: task.done ? "line-through" : "none", cursor: "pointer", color: task.done ? "var(--text-muted)" : "var(--text)" }}>
          <HighlightText text={task.text} query={highlightQuery} />
          {task.recurring && <span title={`Repeats ${task.recurring.type === "weeks" ? task.recurring.count + " weeks" : task.recurring.type === "monthly" ? "monthly" : "until " + task.recurring.until}`} style={{ fontSize: 9, marginLeft: 4, color: "var(--text-faint)" }}>{"\uD83D\uDD01"}</span>}
        </span>
      )}
      {(hover || showCatPicker) && !editing && (
        <div style={{ position: "absolute", top: 1, right: 2, display: "flex", gap: 2, alignItems: "center", background: hover ? "var(--bg-hover)" : `${catColor}18`, padding: "0 2px" }}>
          <button onClick={() => setShowCatPicker(!showCatPicker)} title="Change category"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1, color: "var(--text-muted)" }}>{"\u{1F3A8}"}</button>
          <button onClick={() => onDelete(columnId, task.id)} title="Remove"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#c44", fontSize: isMobile ? 20 : 16, padding: isMobile ? "2px 4px" : "0 2px", lineHeight: 1, fontWeight: 600 }}>&times;</button>
        </div>
      )}
      {showCatPicker && (
        <div ref={pickerRef} style={{ position: "absolute", top: "100%", right: 0, zIndex: 50, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: 5, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", display: "flex", gap: 3, flexWrap: "wrap", width: 130, marginTop: 2 }}>
          {categories.map((cat) => (
            <div key={cat.id} onClick={() => { onChangeCategory(columnId, task.id, cat.id); setShowCatPicker(false); }}
              title={cat.name}
              style={{ width: 18, height: 18, borderRadius: 3, background: cat.color, cursor: "pointer", border: task.category === cat.id ? "2px solid #555" : "1.5px solid rgba(0,0,0,0.1)" }} />
          ))}
        </div>
      )}
      {/* Right-click context menu */}
      {ctxMenu && (
        <div ref={(el) => {
          if (el) {
            const rect = el.getBoundingClientRect();
            const maxY = window.innerHeight - 8;
            if (rect.bottom > maxY) el.style.top = Math.max(8, ctxMenu.y - rect.height) + "px";
            const maxX = window.innerWidth - 8;
            if (rect.right > maxX) el.style.left = Math.max(8, ctxMenu.x - rect.width) + "px";
          }
        }} onMouseDown={(e) => e.stopPropagation()} style={{
          position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000,
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)", padding: "4px 0", minWidth: 170,
          maxHeight: "calc(100vh - 16px)", overflowY: "auto",
        }}>
          <div onMouseDown={(e) => { e.preventDefault(); setEditing(true); setEditText(task.text); setCtxMenu(null); }}
            style={{ padding: "6px 14px", cursor: "pointer", fontSize: 12, color: "var(--text)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            Edit
          </div>
          <div onMouseDown={(e) => { e.preventDefault(); setRepeatMenu(!repeatMenu); }}
            style={{ padding: "6px 14px", cursor: "pointer", fontSize: 12, color: "var(--text)", display: "flex", justifyContent: "space-between" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span>{task.recurring ? "Change repeat" : "Repeat"}</span><span style={{ fontSize: 10, color: "var(--text-faint)" }}>{"\u25B6"}</span>
          </div>
          {repeatMenu && (
            <div style={{ padding: "4px 14px 8px", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Weekly</div>
              {[2, 4, 8, 12].map((n) => (
                <div key={n} onMouseDown={(e) => { e.preventDefault(); onSetRecurring(columnId, task.id, { type: "weeks", count: n, day: columnId }); setCtxMenu(null); }}
                  style={{ padding: "3px 0", cursor: "pointer", fontSize: 11, color: "var(--text)" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text)"}>
                  Every week for {n} weeks
                </div>
              ))}
              <div style={{ marginTop: 4, display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Until:</span>
                <input type="date" value={repeatDate} onChange={(e) => setRepeatDate(e.target.value)} onMouseDown={(e) => e.stopPropagation()}
                  style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 3, padding: "2px 4px", fontSize: 10, background: "var(--bg-card)", color: "var(--text)", outline: "none" }} />
                {repeatDate && <button onMouseDown={(e) => { e.preventDefault(); onSetRecurring(columnId, task.id, { type: "until", until: repeatDate, day: columnId }); setCtxMenu(null); }}
                  style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 3, padding: "2px 6px", fontSize: 9, cursor: "pointer", fontWeight: 600 }}>Set</button>}
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, marginTop: 8, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Monthly</div>
              {(() => {
                const today = new Date();
                const dayOfMonth = today.getDate();
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                const weekdayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                const dow = today.getDay();
                const weekNum = Math.ceil(dayOfMonth / 7);
                const ordinals = ["","1st","2nd","3rd","4th","5th"];
                const monthlyOptions = [
                  { label: `${ordinals[weekNum]} ${weekdayNames[dow]} of month`, rule: { type: "monthly", pattern: "nth_weekday", weekday: dow, nth: weekNum, day: columnId } },
                  { label: `1st of every month`, rule: { type: "monthly", pattern: "day_of_month", dayOfMonth: 1, day: columnId } },
                  { label: `15th of every month`, rule: { type: "monthly", pattern: "day_of_month", dayOfMonth: 15, day: columnId } },
                  { label: `Last day of month`, rule: { type: "monthly", pattern: "last_day", day: columnId } },
                ];
                return monthlyOptions.map((opt, i) => (
                  <div key={i} onMouseDown={(e) => { e.preventDefault(); onSetRecurring(columnId, task.id, opt.rule); setCtxMenu(null); }}
                    style={{ padding: "3px 0", cursor: "pointer", fontSize: 11, color: "var(--text)" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text)"}>
                    {opt.label}
                  </div>
                ));
              })()}
              {task.recurring && (
                <div onMouseDown={(e) => { e.preventDefault(); onSetRecurring(columnId, task.id, null); setCtxMenu(null); }}
                  style={{ padding: "4px 0 0", cursor: "pointer", fontSize: 10, color: "#c44", marginTop: 4 }}>
                  Remove repeat
                </div>
              )}
            </div>
          )}
          <div onMouseDown={(e) => { e.preventDefault(); onDelete(columnId, task.id); setCtxMenu(null); }}
            style={{ padding: "6px 14px", cursor: "pointer", fontSize: 12, color: "#c44" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            Delete
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Drop Zone ─── */
const DragContext = React.createContext(false);

function DropZone({ onDrop }) {
  const [over, setOver] = useState(false);
  const dragging = React.useContext(DragContext);
  return (
    <div data-dropzone="true" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={(e) => { e.stopPropagation(); setOver(false); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onDrop(e); }}
      style={{ height: over ? 20 : dragging ? 8 : 2, margin: 0, background: over ? "rgba(139,105,20,0.25)" : "transparent", borderRadius: over ? 4 : 0, transition: "all 0.15s", border: over ? "1.5px dashed #8B6914" : "1.5px dashed transparent", overflow: "hidden" }} />
  );
}

/* ─── Day Section ─── */
function DaySection({ dayInfo, columnId, tasks, categories, onDragStart, onDrop, onToggle, onDelete, onEdit, onAdd, onChangeCategory, isMobile, onMove, onSetRecurring, highlightQuery, taskFontSize }) {
  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCat, setNewCat] = useState("cat_none");
  const [catManuallySet, setCatManuallySet] = useState(false);
  const addRef = useRef(null);
  const dragCounter = useRef(0);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);
  const parseDrop = (e) => { try { return JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return null; } };
  const handleDropAtIndex = (e, beforeTaskId) => { const d = parseDrop(e); if (d) onDrop(d.from, columnId, d.taskId, beforeTaskId); };
  const handleDropEnd = (e) => { e.preventDefault(); dragCounter.current = 0; setDragOver(false); const d = parseDrop(e); if (d) onDrop(d.from, columnId, d.taskId, null); };
  const isLater = columnId === "later";
  const submitAdd = () => { if (newText.trim()) { onAdd(columnId, newText.trim(), isLater ? "cat_none" : newCat); setNewText(""); setNewCat("cat_none"); setCatManuallySet(false); } setAdding(false); };
  const handleTextChange = (e) => { const val = e.target.value; setNewText(val); if (!catManuallySet) setNewCat(autoDetectCategory(val, categories)); };
  const handleManualCat = (catId) => { setNewCat(catId); setCatManuallySet(true); };
  const isToday = dayInfo?.isToday;
  const incompleteTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  const dayLabel = isLater ? "LATER" : (dayInfo?.label === "MON" ? "MONDAY" : dayInfo?.label === "TUE" ? "TUESDAY" : dayInfo?.label === "WED" ? "WEDNESDAY" : dayInfo?.label === "THU" ? "THURSDAY" : dayInfo?.label === "FRI" ? "FRIDAY" : dayInfo?.label === "SAT" ? "SATURDAY" : dayInfo?.label === "SUN" ? "SUNDAY" : dayInfo?.label);

  return (
    <div onDragOver={(e) => { e.preventDefault(); }}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); }}
      onDragLeave={(e) => { dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); } }}
      onDrop={handleDropEnd}
      style={{
        background: dragOver ? "rgba(139,105,20,0.03)" : isToday ? "rgba(180,140,80,0.04)" : "transparent",
        transition: "background 0.2s",
        borderBottom: "1px solid var(--border-light)",
        paddingBottom: 4,
      }}>
      {/* Day header */}
      <div style={{
        padding: isLater ? (isMobile ? "4px 10px 2px" : "2px 10px 2px") : (isMobile ? "10px 10px 4px" : "8px 10px 4px"), display: "flex", alignItems: "baseline", gap: 8,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
          fontSize: isMobile ? 16 : 13, color: isToday ? "#8B6914" : "var(--text)", letterSpacing: 0.5,
        }}>
          {dayLabel}
        </span>
        {!isLater && <span style={{ fontSize: isMobile ? 14 : 11, color: "var(--text-muted)", fontWeight: 400 }}>{dayInfo?.date}</span>}
        {isToday && <span style={{ fontSize: isMobile ? 10 : 8, background: "#8B6914", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>TODAY</span>}
      </div>

      {/* Task list */}
      <div>
        {incompleteTasks.map((task, idx) => (
          <div key={task.id}>
            <DropZone onDrop={(e) => handleDropAtIndex(e, task.id)} />
            <TaskCard task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} isMobile={isMobile} onMove={onMove} onSetRecurring={onSetRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
          </div>
        ))}
        <DropZone onDrop={(e) => handleDropAtIndex(e, null)} />
        {doneTasks.length > 0 && doneTasks.map((task) => (
          <TaskCard key={task.id} task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} isMobile={isMobile} onMove={onMove} onSetRecurring={onSetRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
        ))}
      </div>

      {/* Add task */}
      {adding ? (
        <div style={{ padding: isMobile ? "6px 10px 6px 20px" : "4px 10px 4px 26px" }}>
          <input ref={addRef} value={newText} onChange={isLater ? (e) => setNewText(e.target.value) : handleTextChange}
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Task name..." style={{ width: "100%", maxWidth: 400, border: "1px solid var(--border)", borderRadius: 4, padding: isMobile ? "8px 10px" : "5px 8px", fontSize: isMobile ? 16 : 12, outline: "none", background: "var(--input-bg)", color: "var(--text)", boxSizing: "border-box", marginBottom: 4 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!isLater && <CategoryDot categories={categories} selected={newCat} onSelect={handleManualCat} />}
            <button onClick={submitAdd} style={{ background: "#555", color: "#fff", border: "none", borderRadius: 4, padding: isMobile ? "6px 16px" : "4px 12px", cursor: "pointer", fontSize: isMobile ? 13 : 10 }}>Add</button>
            <button onClick={() => { setAdding(false); setCatManuallySet(false); }} style={{ background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: isMobile ? "6px 14px" : "4px 10px", cursor: "pointer", fontSize: isMobile ? 13 : 10 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: isMobile ? 15 : 12,
          padding: isMobile ? "8px 10px 8px 20px" : "4px 10px 4px 26px", transition: "color 0.15s",
        }}
          onMouseEnter={(e) => (e.target.style.color = "var(--text-muted)")}
          onMouseLeave={(e) => (e.target.style.color = "var(--text-faint)")}>+ Add task</button>
      )}
    </div>
  );
}

/* ─── Day Column (horizontal layout) ─── */
function DoneCollapse({ doneTasks, columnId, categories, onDragStart, onToggle, onDelete, onEdit, onChangeCategory, onMove, onSetRecurring, highlightQuery, isToday, taskFontSize }) {
  const [expanded, setExpanded] = useState(false);
  if (doneTasks.length === 0) return null;
  return (
    <>
      <div onClick={() => setExpanded(!expanded)} style={{ borderTop: "1px dashed var(--border)", margin: "3px 2px 1px", padding: "2px 0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
        <span style={{ fontSize: 8, color: "var(--text-faint)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>{"\u25B6"}</span>
        <span style={{ fontSize: 8, color: "var(--text-faint)" }}>{doneTasks.length} done</span>
      </div>
      {expanded && doneTasks.map((task) => (
        <TaskCard key={task.id} task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} onMove={onMove} onSetRecurring={onSetRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
      ))}
    </>
  );
}

function DayColumn({ dayInfo, columnId, tasks, categories, onDragStart, onDrop, onToggle, onDelete, onEdit, onAdd, onChangeCategory, colWidth, onMove, onSetRecurring, highlightQuery, taskFontSize }) {  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCat, setNewCat] = useState("cat_none");
  const [catManuallySet, setCatManuallySet] = useState(false);
  const addRef = useRef(null);
  const dragCounter = useRef(0);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);
  const parseDrop = (e) => { try { return JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return null; } };
  const handleDropAtIndex = (e, beforeTaskId) => { const d = parseDrop(e); if (d) onDrop(d.from, columnId, d.taskId, beforeTaskId); };
  const handleDropEnd = (e) => { e.preventDefault(); dragCounter.current = 0; setDragOver(false); const d = parseDrop(e); if (d) onDrop(d.from, columnId, d.taskId, null); };
  const isLater = columnId === "later";
  const submitAdd = () => { if (newText.trim()) { onAdd(columnId, newText.trim(), isLater ? "cat_none" : newCat); setNewText(""); setNewCat("cat_none"); setCatManuallySet(false); } setAdding(false); };
  const handleTextChange = (e) => { const val = e.target.value; setNewText(val); if (!catManuallySet) setNewCat(autoDetectCategory(val, categories)); };
  const handleManualCat = (catId) => { setNewCat(catId); setCatManuallySet(true); };
  const isToday = dayInfo?.isToday;
  const incompleteTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  return (
    <div onDragOver={(e) => { e.preventDefault(); }}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); }}
      onDragLeave={(e) => { dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); } }}
      onDrop={handleDropEnd}
      style={{
        width: isLater ? "100%" : colWidth === "100%" ? "100%" : colWidth,
        minWidth: isLater ? "auto" : colWidth === "100%" ? 0 : colWidth,
        flex: colWidth === "100%" && !isLater ? 1 : undefined,
        flexShrink: colWidth === "100%" ? 1 : 0,
        overflow: "hidden",
        background: dragOver ? "rgba(139,105,20,0.04)" : isToday ? "rgba(180,140,80,0.06)" : "transparent",
        borderRadius: 8, padding: "6px 2px", transition: "background 0.2s", display: "flex", flexDirection: "column",
        border: isToday ? "1.5px solid rgba(180,140,80,0.25)" : dragOver ? "1.5px dashed rgba(139,105,20,0.3)" : "1.5px solid transparent",
      }}>
      <div style={{ flexShrink: 0, marginBottom: 2, padding: "0 2px", display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "clamp(9px, 1.1vw, 11px)", color: isToday ? "#8B6914" : "var(--text)", letterSpacing: 0.5 }}>
          {isLater ? "LATER" : dayInfo?.label}
        </span>
        {!isLater && <span style={{ fontSize: "clamp(7px, 0.8vw, 9px)", color: "var(--text-muted)", fontWeight: 400 }}>{dayInfo?.date}</span>}
        {isToday && <span style={{ fontSize: 6, background: "#8B6914", color: "#fff", padding: "1px 3px", borderRadius: 2, fontWeight: 600 }}>TODAY</span>}
      </div>
      <div style={{ flex: 1 }}>
        {incompleteTasks.map((task, idx) => (
          <div key={task.id}>
            <DropZone onDrop={(e) => handleDropAtIndex(e, task.id)} />
            <TaskCard task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} onMove={onMove} onSetRecurring={onSetRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
          </div>
        ))}
        <DropZone onDrop={(e) => handleDropAtIndex(e, null)} />
        <DoneCollapse doneTasks={doneTasks} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} onMove={onMove} onSetRecurring={onSetRecurring} highlightQuery={highlightQuery} isToday={isToday} taskFontSize={taskFontSize} />
      </div>
      {adding ? (
        <div style={{ marginTop: 2, flexShrink: 0 }}>
          <input ref={addRef} value={newText} onChange={isLater ? (e) => setNewText(e.target.value) : handleTextChange}
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Task..." style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", fontSize: 11, outline: "none", background: "var(--input-bg)", color: "var(--text)", boxSizing: "border-box", marginBottom: 2 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {!isLater && <CategoryDot categories={categories} selected={newCat} onSelect={handleManualCat} />}
            <button onClick={submitAdd} style={{ background: "#555", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 9 }}>Add</button>
            <button onClick={() => { setAdding(false); setCatManuallySet(false); }} style={{ background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: "3px 6px", cursor: "pointer", fontSize: 9 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, padding: "3px 0", cursor: "pointer", color: "var(--text-muted)", fontSize: "clamp(9px, 1vw, 11px)", marginTop: 2, width: "100%", flexShrink: 0 }}
          onMouseEnter={(e) => { e.target.style.borderColor = "#999"; e.target.style.color = "var(--text-muted)"; }}
          onMouseLeave={(e) => { e.target.style.borderColor = "#ccc"; e.target.style.color = "var(--text-faint)"; }}>+ Add</button>
      )}
    </div>
  );
}

/* ─── Future Sidebar ─── */
function FutureSidebar({ futureTasks, onAddFuture, onDeleteFuture, onEditFuture, highlightQuery }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);
  const [newText, setNewText] = useState("");
  const [newDate, setNewDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [highlightDate, setHighlightDate] = useState(null);
  const addRef = useRef(null);
  const editRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus(); }, [editingId]);
  const grouped = {};
  futureTasks.forEach((t) => { if (!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });
  const sortedDates = Object.keys(grouped).sort();
  const submitAdd = () => { if (newText.trim() && newDate) { onAddFuture(newText.trim(), newDate); setNewText(""); setNewDate(""); } setAdding(false); };
  const count = futureTasks.length;
  const taskDates = new Set(futureTasks.map((t) => t.date));
  const todayStr = new Date().toISOString().split("T")[0];

  const MNAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DLABELS = ["M","T","W","T","F","S","S"];
  const firstDay = new Date(calYear, calMonth, 1);
  let startDow = firstDay.getDay(); if (startDow === 0) startDow = 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells = [];
  for (let i = 1; i < startDow; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); };

  return (
    <div style={{ width: open ? 190 : 36, minWidth: open ? 190 : 36, background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s ease, min-width 0.2s ease" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: "var(--text-muted)" }}>
        <span style={{ fontSize: 12 }}>{open ? "\u25B6" : "\u25C0"}</span>
        {!open && (<><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 7, letterSpacing: 1, textTransform: "uppercase", writingMode: "vertical-lr" }}>Upcoming</span>{count > 0 && <span style={{ fontSize: 9, fontWeight: 600, background: "var(--border)", borderRadius: 8, padding: "1px 4px", marginTop: 4 }}>{count}</span>}</>)}
        {open && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Upcoming</span>}
      </button>
      {open && (
        <>
          {/* Mini calendar */}
          <div style={{ padding: "6px 6px 4px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 10, padding: "0 3px" }}>{"\u25C0"}</button>
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)" }}>{MNAMES[calMonth]} {calYear}</span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 10, padding: "0 3px" }}>{"\u25B6"}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
              {DLABELS.map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 7, color: "var(--text-faint)", fontFamily: "'JetBrains Mono', monospace", padding: "1px 0" }}>{d}</div>
              ))}
              {calCells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasTask = taskDates.has(dateStr);
                const isToday = dateStr === todayStr;
                return (
                  <div key={i} onClick={() => {
                    setNewDate(dateStr);
                    if (hasTask && listRef.current) {
                      setHighlightDate(dateStr);
                      setTimeout(() => {
                        const el = listRef.current?.querySelector(`[data-future-date="${dateStr}"]`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 50);
                      setTimeout(() => setHighlightDate(null), 2000);
                    }
                  }}
                    style={{ textAlign: "center", fontSize: 9, padding: "2px 0", cursor: "pointer", borderRadius: 3, position: "relative",
                      color: isToday ? "var(--accent)" : "var(--text-muted)", fontWeight: isToday ? 700 : 400,
                      background: newDate === dateStr ? "rgba(139,105,20,0.15)" : "transparent",
                    }}>
                    {day}
                    {hasTask && <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "var(--accent)" }} />}
                  </div>
                );
              })}
            </div>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
            {sortedDates.map((date) => {
              const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const isHighlighted = highlightDate === date;
              return (<div key={date} data-future-date={date} style={{ marginBottom: 8, padding: isHighlighted ? "4px 6px" : 0, background: isHighlighted ? "rgba(139,105,20,0.12)" : "transparent", borderRadius: 6, transition: "background 0.3s" }}><div style={{ fontSize: 11, fontWeight: 600, color: isHighlighted ? "var(--accent)" : "var(--text-muted)", marginBottom: 3 }}>{label}</div>
                {grouped[date].map((task) => (<div key={task.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: task.id, from: "future", futureText: task.text })); }}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 7px", marginBottom: 3, fontSize: 12, cursor: "grab", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                  {editingId === task.id ? (
                    <input ref={editRef} value={editText} onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => { if (editText.trim()) onEditFuture(task.id, editText.trim()); setEditingId(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { if (editText.trim()) onEditFuture(task.id, editText.trim()); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 3, padding: "1px 4px", fontSize: 12, outline: "none", background: "var(--input-bg)", color: "var(--text)", boxSizing: "border-box" }} />
                  ) : (
                    <span onDoubleClick={() => { setEditingId(task.id); setEditText(task.text); }} style={{ flex: 1, wordBreak: "break-word", cursor: "text" }}><HighlightText text={task.text} query={highlightQuery} /></span>
                  )}
                  <button onClick={() => onDeleteFuture(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 11, padding: 0, marginLeft: 3, fontWeight: 600, lineHeight: 1 }} onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "#bbb")}>&times;</button>
                </div>))}</div>);
            })}
            {sortedDates.length === 0 && <div style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "center", marginTop: 16 }}>No upcoming</div>}
          </div>
          {adding ? (
            <div style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
              <input ref={addRef} value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(false); }} placeholder="Task..." style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", fontSize: 10, outline: "none", marginBottom: 2, background: "var(--bg-card)", color: "var(--text)", boxSizing: "border-box" }} />
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", fontSize: 10, outline: "none", marginBottom: 2, background: "var(--bg-card)", color: "var(--text)", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 2 }}>
                <button onClick={submitAdd} style={{ flex: 1, background: "#555", color: "#fff", border: "none", borderRadius: 4, padding: "3px 0", cursor: "pointer", fontSize: 9 }}>Add</button>
                <button onClick={() => setAdding(false)} style={{ flex: 1, background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: "3px 0", cursor: "pointer", fontSize: 9 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setAdding(true)} style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, padding: "4px 0", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, width: "100%" }}
                onMouseEnter={(e) => { e.target.style.borderColor = "#999"; e.target.style.color = "#777"; }} onMouseLeave={(e) => { e.target.style.borderColor = "#ccc"; e.target.style.color = "#aaa"; }}>+ Schedule</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Main Planner ─── */
export default function Planner({ data, onSave, onSaveQuiet, onSaveFuture, onSaveNotebooks, onSaveJournal, onSaveContacts, onSaveArchive, onSaveDailyHabits, onSaveWeeklyHabits, onSaveSettings, onSaveRecurringRules, onGetBackups, onRestoreBackup, onExportData, onLogout, userEmail, userId }) {
  const isMobile = useIsMobile();
  const weekDates = getWeekDates();
  const { tasks, futureTasks, dailyHabits, weeklyHabits, notes, habitHistory } = data;
  const [activeView, setActiveViewState] = useState(() => {
    try { return localStorage.getItem("planner_activeTab") || "planner"; } catch { return "planner"; }
  });
  const setActiveView = (view) => { setActiveViewState(view); try { localStorage.setItem("planner_activeTab", view); } catch {} };
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState(""); // persists after search close to highlight matches
  const [laterHeight, setLaterHeight] = useState(50);
  const [notesHeight, setNotesHeight] = useState(70);
  const [colWidth, setColWidth] = useState(160);
  const [laterOpen, setLaterOpenState] = useState(() => { try { return localStorage.getItem("planner_laterOpen") !== "false"; } catch { return true; } });
  const [notesOpen, setNotesOpenState] = useState(() => { try { return localStorage.getItem("planner_notesOpen") !== "false"; } catch { return true; } });
  const [habitsOpen, setHabitsOpenState] = useState(() => { try { return localStorage.getItem("planner_habitsOpen") !== "false"; } catch { return true; } });
  const setLaterOpen = (v) => { setLaterOpenState(v); try { localStorage.setItem("planner_laterOpen", v); } catch {} };
  const setNotesOpen = (v) => { setNotesOpenState(v); try { localStorage.setItem("planner_notesOpen", v); } catch {} };
  const setHabitsOpen = (v) => { setHabitsOpenState(v); try { localStorage.setItem("planner_habitsOpen", v); } catch {} };
  const notebooks = data.notebooks || [];
  const journal = data.journal || {};
  const contacts = data.contacts || [];
  const archive = data.archive || [];
  const categories = data.categories || [];
  const layout = data.layout || "vertical";
  const darkMode = data.darkMode || false;
  const taskFontSize = data.taskFontSize || 13;

  // Inject CSS variables for theming
  useEffect(() => {
    const r = document.documentElement.style;
    if (darkMode) {
      document.body.classList.add("dark-mode");
      r.setProperty("--bg", "#1e2028");
      r.setProperty("--bg-surface", "#262830");
      r.setProperty("--bg-card", "#2c2e38");
      r.setProperty("--bg-hover", "#363842");
      r.setProperty("--text", "#d8dae0");
      r.setProperty("--text-muted", "#8890a0");
      r.setProperty("--text-faint", "#555b6e");
      r.setProperty("--border", "#363842");
      r.setProperty("--border-light", "#2e3038");
      r.setProperty("--input-bg", "#2c2e38");
      r.setProperty("--accent", "#c9a227");
      r.setProperty("--done-bg", "#1e2028");
    } else {
      document.body.classList.remove("dark-mode");
      r.setProperty("--bg", "#fdfcf8");
      r.setProperty("--bg-surface", "#f2f1ed");
      r.setProperty("--bg-card", "#fff");
      r.setProperty("--bg-hover", "#f8f7f3");
      r.setProperty("--text", "#333");
      r.setProperty("--text-muted", "#999");
      r.setProperty("--text-faint", "#bbb");
      r.setProperty("--border", "#e8e5dd");
      r.setProperty("--border-light", "#f0eeea");
      r.setProperty("--input-bg", "#fafaf7");
      r.setProperty("--accent", "#8B6914");
      r.setProperty("--done-bg", "#fdfcf8");
    }
  }, [darkMode]);

  // Keep a ref to the latest data to avoid stale closure in callbacks
  const dataRef = useRef(data);
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(null);
  dataRef.current = data;

  // Track global drag state for DropZone sizing
  useEffect(() => {
    let dragTimeout = null;
    const clearDrag = () => { setIsDragging(false); if (dragTimeout) { clearTimeout(dragTimeout); dragTimeout = null; } };
    const onStart = () => { setIsDragging(true); if (dragTimeout) { clearTimeout(dragTimeout); dragTimeout = null; } };
    const onDragOver = () => { if (dragTimeout) clearTimeout(dragTimeout); dragTimeout = setTimeout(clearDrag, 3000); };
    document.addEventListener("dragstart", onStart);
    document.addEventListener("dragend", clearDrag);
    document.addEventListener("drop", clearDrag, true);
    document.addEventListener("dragover", onDragOver);
    return () => {
      document.removeEventListener("dragstart", onStart);
      document.removeEventListener("dragend", clearDrag);
      document.removeEventListener("drop", clearDrag, true);
      document.removeEventListener("dragover", onDragOver);
      if (dragTimeout) clearTimeout(dragTimeout);
    };
  }, []);

  const update = (changes) => {
    const latest = dataRef.current;
    onSave({ ...latest, ...changes });
  };

  // Auto-promote upcoming tasks whose dates fall within the current week
  useEffect(() => {
    if (!futureTasks || futureTasks.length === 0) return;
    const weekDateMap = {};
    const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    weekDates.forEach((wd, i) => { weekDateMap[wd.fullDate] = dayKeys[i]; });

    const toPromote = futureTasks.filter((t) => weekDateMap[t.date]);
    if (toPromote.length === 0) return;

    const newTasks = { ...tasks };
    for (const ft of toPromote) {
      const dayCol = weekDateMap[ft.date];
      const detectedCat = autoDetectCategory(ft.text, categories);
      const newTask = makeTask(ft.text, { category: detectedCat });
      newTasks[dayCol] = [...(newTasks[dayCol] || []), newTask];
    }

    const remainingFuture = futureTasks.filter((t) => !weekDateMap[t.date]);
    onSaveQuiet({ ...data, tasks: newTasks, futureTasks: remainingFuture });
    onSaveFuture(remainingFuture);
  }, []); // Run once on load

  // Auto-generate birthday reminders from contacts (shows up 2 weeks before, dated on actual birthday)
  useEffect(() => {
    if (!contacts || contacts.length === 0 || !futureTasks) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthNames = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

    const parseBirthday = (str) => {
      if (!str) return null;
      const s = str.trim().toLowerCase();
      const match = s.match(/^([a-z]+)\s+(\d{1,2})/);
      if (match) {
        const m = monthNames[match[1]];
        if (m !== undefined) return { month: m, day: parseInt(match[2]) };
      }
      const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})/);
      if (slashMatch) return { month: parseInt(slashMatch[1]) - 1, day: parseInt(slashMatch[2]) };
      return null;
    };

    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);
    const threeMonths = new Date(today);
    threeMonths.setMonth(today.getMonth() + 3);

    const newReminders = [];
    for (const c of contacts) {
      const bd = parseBirthday(c.birthday);
      if (!bd) continue;
      const alreadyExists = futureTasks.some((t) => t.text.includes(c.name) && t.text.includes("birthday"));
      if (alreadyExists) continue;
      // Check this year and next year
      for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        const bdDate = new Date(year, bd.month, bd.day);
        // Only create if: birthday is in the future, and it's within 2 weeks from now (the reminder window)
        // but date the task on the actual birthday
        const twoWeeksBefore = new Date(bdDate);
        twoWeeksBefore.setDate(bdDate.getDate() - 14);
        if (twoWeeksBefore <= today && bdDate >= today && bdDate <= threeMonths) {
          const dateStr = formatLocalDate(bdDate);
          const taskText = `\u{1F382} ${c.name}'s birthday (${c.birthday})`;
          newReminders.push({ id: "bday" + Date.now() + "_" + Math.random().toString(36).slice(2, 5), text: taskText, date: dateStr });
          break; // Only one reminder per contact
        }
      }
    }
    if (newReminders.length > 0) {
      const updated = [...futureTasks, ...newReminders];
      update({ futureTasks: updated });
      onSaveFuture(updated);
    }
  }, [contacts?.length]); // Re-run when contacts change

  const handleDrop = useCallback((fromCol, toCol, taskId, beforeTaskId) => {
    const d = dataRef.current;
    const currentTasks = d.tasks;
    const currentFuture = d.futureTasks || [];
    const currentCats = d.categories || [];
    if (fromCol === "future") {
      const task = currentFuture.find((t) => t.id === taskId);
      if (!task) return;
      const newTasks = {};
      Object.keys(currentTasks).forEach((k) => { newTasks[k] = [...currentTasks[k]]; });
      const detectedCat = autoDetectCategory(task.text, currentCats);
      const newTask = makeTask(task.text, { category: detectedCat });
      if (beforeTaskId) { const toList = newTasks[toCol] || []; const idx = toList.findIndex((t) => t.id === beforeTaskId); toList.splice(idx, 0, newTask); newTasks[toCol] = toList; }
      else { newTasks[toCol] = [...(newTasks[toCol] || []), newTask]; }
      const newFuture = currentFuture.filter((t) => t.id !== taskId);
      onSave({ ...d, tasks: newTasks, futureTasks: newFuture });
      onSaveFuture(newFuture);
      return;
    }
    const newTasks = {};
    Object.keys(currentTasks).forEach((k) => { newTasks[k] = [...currentTasks[k]]; });
    const fromList = newTasks[fromCol];
    if (!fromList) return;
    const taskIdx = fromList.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) return;
    const [task] = fromList.splice(taskIdx, 1);
    if (!task.category || task.category === "cat_none") {
      task.category = autoDetectCategory(task.text, currentCats);
    }
    const toList = newTasks[toCol] || [];
    if (beforeTaskId) {
      const insertIdx = toList.findIndex((t) => t.id === beforeTaskId);
      if (insertIdx !== -1) toList.splice(insertIdx, 0, task);
      else toList.push(task);
      newTasks[toCol] = toList;
    } else { newTasks[toCol] = [...toList, task]; }
    update({ tasks: newTasks });
  }, []);

  const moveTask = useCallback((col, taskId, direction) => {
    const currentTasks = dataRef.current.tasks;
    const newTasks = {};
    Object.keys(currentTasks).forEach((k) => { newTasks[k] = [...currentTasks[k]]; });
    const list = newTasks[col];
    const idx = list.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    update({ tasks: newTasks });
  }, []);

  const toggleDone = useCallback((col, id) => {
    const d = dataRef.current;
    const currentTasks = d.tasks;
    const currentArchive = d.archive || [];
    const task = currentTasks[col]?.find((t) => t.id === id);
    if (!task) return;
    const nowDone = !task.done;
    const newTasks = {};
    Object.keys(currentTasks).forEach((k) => { newTasks[k] = [...currentTasks[k]]; });
    newTasks[col] = newTasks[col].map((t) => (t.id === id ? { ...t, done: nowDone } : t));
    const laterLenBefore = currentTasks?.later?.length || 0;
    if (nowDone) {
      const dayMap = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
      const dayIdx = dayMap[col];
      const dateStr = dayIdx !== undefined ? getWeekDates()[dayIdx]?.fullDate : null;
      const entry = { id: "a" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), text: task.text, category: task.category, completedAt: new Date().toISOString(), assignedDay: col, assignedDate: dateStr || "later" };
      const newArchive = [entry, ...currentArchive];
      // #region agent log toggleDone -> nowDone
      fetch("http://127.0.0.1:7349/ingest/33b1731a-45e3-48ae-9ad6-aa14cf816181", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "12cfe4" },
        body: JSON.stringify({
          sessionId: "12cfe4",
          runId: "sync_debug_pre",
          hypothesisId: "H2_state_overwrite",
          location: "Planner.jsx:toggleDone(nowDone)",
          message: "User toggled a task done; about to write tasks + archive",
          data: {
            taskId: id,
            col,
            nowDone,
            laterLenBefore,
            laterLenAfter: newTasks?.later?.length || 0,
            archiveLenBefore: currentArchive.length,
            archiveLenAfter: newArchive.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      update({ tasks: newTasks, archive: newArchive }); onSaveArchive(newArchive);
    } else {
      const newArchive = [...currentArchive]; const idx = newArchive.findIndex((a) => a.text === task.text && a.assignedDay === col);
      if (idx !== -1) newArchive.splice(idx, 1);
      // #region agent log toggleDone -> nowUndone
      fetch("http://127.0.0.1:7349/ingest/33b1731a-45e3-48ae-9ad6-aa14cf816181", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "12cfe4" },
        body: JSON.stringify({
          sessionId: "12cfe4",
          runId: "sync_debug_pre",
          hypothesisId: "H2_state_overwrite",
          location: "Planner.jsx:toggleDone(nowUndone)",
          message: "User toggled a task undone; about to write tasks + archive",
          data: {
            taskId: id,
            col,
            nowDone,
            laterLenBefore,
            laterLenAfter: newTasks?.later?.length || 0,
            archiveLenBefore: currentArchive.length,
            archiveLenAfter: newArchive.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      update({ tasks: newTasks, archive: newArchive }); onSaveArchive(newArchive);
    }
  }, []);

  const deleteTask = useCallback((col, id) => { const t = dataRef.current.tasks; update({ tasks: { ...t, [col]: t[col].filter((x) => x.id !== id) } }); }, []);
  const editTask = useCallback((col, id, text) => { const t = dataRef.current.tasks; update({ tasks: { ...t, [col]: t[col].map((x) => (x.id === id ? { ...x, text } : x)) } }); }, []);
  const addTask = useCallback((col, text, catId) => {
    const t = dataRef.current.tasks;
    const task = makeTask(text, { category: catId || "cat_none" });
    const laterLenBefore = t?.later?.length || 0;
    const nextList = [...t[col], task];
    // #region agent log addTask to later
    if (col === "later") {
      fetch("http://127.0.0.1:7349/ingest/33b1731a-45e3-48ae-9ad6-aa14cf816181", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "12cfe4" },
        body: JSON.stringify({
          sessionId: "12cfe4",
          runId: "sync_debug_pre",
          hypothesisId: "H2_state_overwrite",
          location: "Planner.jsx:addTask(later)",
          message: "User added a task to Later; about to write week tasks",
          data: { taskId: task.id, laterLenBefore, laterLenAfter: (laterLenBefore + 1), col },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    update({ tasks: { ...t, [col]: nextList } });
  }, []);
  const changeCategory = useCallback((col, id, catId) => { const t = dataRef.current.tasks; update({ tasks: { ...t, [col]: t[col].map((x) => (x.id === id ? { ...x, category: catId } : x)) } }); }, []);
  const setRecurring = useCallback((col, id, rule) => {
    const t = dataRef.current.tasks;
    const task = t[col]?.find((x) => x.id === id);
    const newTasks = { ...t, [col]: t[col].map((x) => x.id === id ? { ...x, recurring: rule || undefined } : x) };
    update({ tasks: newTasks });
    // Save to persistent recurring rules immediately
    if (task && onSaveRecurringRules) {
      import('firebase/firestore').then(({ getDoc: gd, doc: d }) => {
        gd(d(db, `users/${userId}/meta/recurringRules`)).then((snap) => {
          const existing = snap.exists() ? (snap.data().items || []) : [];
          // Remove any old rule for this task text + day
          const filtered = existing.filter((r) => !(r.text === task.text && r.day === (rule?.day || col)));
          if (rule) {
            // Adding/updating a rule
            filtered.push({ ...rule, text: task.text, category: task.category || "cat_none" });
          }
          onSaveRecurringRules(filtered);
        }).catch(() => {
          if (rule) onSaveRecurringRules([{ ...rule, text: task.text, category: task.category || "cat_none" }]);
        });
      });
    }
  }, [userId, onSaveRecurringRules]);
  const toggleDaily = (hid, day) => { const updated = dailyHabits.map((h) => h.id === hid ? { ...h, checks: { ...h.checks, [day]: !h.checks[day] } } : h); update({ dailyHabits: updated }); onSaveDailyHabits(updated); };
  const toggleWeekly = (hid) => { const updated = weeklyHabits.map((h) => h.id === hid ? { ...h, done: !h.done } : h); update({ weeklyHabits: updated }); onSaveWeeklyHabits(updated); };
  const addDailyHabit = (name) => { const updated = [...dailyHabits, { id: "dh" + Date.now(), name, checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } }]; update({ dailyHabits: updated }); onSaveDailyHabits(updated); };
  const addWeeklyHabit = (name) => { const updated = [...weeklyHabits, { id: "wh" + Date.now(), name, done: false }]; update({ weeklyHabits: updated }); onSaveWeeklyHabits(updated); };
  const deleteDaily = (id) => { const updated = dailyHabits.filter((h) => h.id !== id); update({ dailyHabits: updated }); onSaveDailyHabits(updated); };
  const deleteWeekly = (id) => { const updated = weeklyHabits.filter((h) => h.id !== id); update({ weeklyHabits: updated }); onSaveWeeklyHabits(updated); };
  const editDaily = (id, name) => { const updated = dailyHabits.map((h) => h.id === id ? { ...h, name } : h); update({ dailyHabits: updated }); onSaveDailyHabits(updated); };
  const editWeekly = (id, name) => { const updated = weeklyHabits.map((h) => h.id === id ? { ...h, name } : h); update({ weeklyHabits: updated }); onSaveWeeklyHabits(updated); };
  const reorderDaily = (items) => { update({ dailyHabits: items }); onSaveDailyHabits(items); };
  const reorderWeekly = (items) => { update({ weeklyHabits: items }); onSaveWeeklyHabits(items); };
  const addFuture = (text, date) => { const nf = [...futureTasks, { id: "f" + Date.now(), text, date }]; update({ futureTasks: nf }); onSaveFuture(nf); };
  const deleteFuture = (id) => { const nf = futureTasks.filter((t) => t.id !== id); update({ futureTasks: nf }); onSaveFuture(nf); };
  const editFuture = (id, text) => { const nf = futureTasks.map((t) => t.id === id ? { ...t, text } : t); update({ futureTasks: nf }); onSaveFuture(nf); };
  const updateNotebooks = (nbs) => { update({ notebooks: nbs }); onSaveNotebooks(nbs); };
  const updateJournal = (j) => { update({ journal: j }); onSaveJournal(j); };
  const updateContacts = (c) => { update({ contacts: c }); onSaveContacts(c); };
  const updateCategories = (cats) => { update({ categories: cats }); onSaveSettings({ categories: cats, layout, notes, darkMode, taskFontSize }); };

  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase(); const results = [];
    Object.entries(tasks).forEach(([col, list]) => { list.forEach((t) => { if (t.text.toLowerCase().includes(q)) results.push({ type: "Task", section: col.toUpperCase(), text: t.text, nav: { view: "planner", day: col } }); }); });
    archive.forEach((a) => { if (a.text.toLowerCase().includes(q)) results.push({ type: "Completed", section: a.assignedDate || "later", text: a.text, nav: { view: "archive" } }); });
    futureTasks.forEach((t) => { if (t.text.toLowerCase().includes(q)) results.push({ type: "Upcoming", section: t.date, text: t.text, nav: { view: "planner" } }); });
    notebooks.forEach((nb) => { const p = nb.content?.replace(/<[^>]*>/g, "") || ""; if (nb.title.toLowerCase().includes(q) || p.toLowerCase().includes(q)) results.push({ type: "Notebook", section: nb.title, text: p.slice(0, 100), nav: { view: "notebooks", noteId: nb.id } }); });
    Object.entries(journal).forEach(([date, html]) => { const p = html?.replace(/<[^>]*>/g, "") || ""; if (p.toLowerCase().includes(q)) results.push({ type: "Journal", section: date, text: p.slice(0, 100), nav: { view: "journal", date } }); });
    contacts.forEach((c) => { const b = [c.name, c.likes, c.dislikes, c.notes, c.relationship, c.birthday].join(" ").toLowerCase(); if (b.includes(q)) results.push({ type: "Person", section: c.relationship || "", text: c.name, nav: { view: "contacts", contactId: c.id } }); });
    if (notes?.toLowerCase().includes(q)) results.push({ type: "Quick Notes", section: "", text: notes.slice(0, 100), nav: { view: "planner", scrollTo: "notes" } });
    dailyHabits.forEach((h) => { if (h.name.toLowerCase().includes(q)) results.push({ type: "Daily Habit", section: "", text: h.name, nav: { view: "planner" } }); });
    weeklyHabits.forEach((h) => { if (h.name.toLowerCase().includes(q)) results.push({ type: "Weekly Habit", section: "", text: h.name, nav: { view: "planner" } }); });
    return results;
  };

  const navigateToResult = (result) => {
    const query = searchQuery;
    setSearchOpen(false);
    setSearchQuery("");
    setHighlightQuery(query);
    if (!result.nav) return;
    const { view, noteId, date, contactId } = result.nav;
    setActiveView(view);
    if (view === "notebooks" && noteId) { try { localStorage.setItem("planner_activeNote", noteId); } catch {} }
    if (view === "journal" && date) { try { localStorage.setItem("planner_journalNav", date); } catch {} }
    if (view === "contacts" && contactId) { try { localStorage.setItem("planner_contactNav", contactId); } catch {} }
    setTimeout(() => highlightInDOM(query), 250);
  };

  const clearDOMHighlights = () => {
    document.querySelectorAll("mark[data-search-highlight]").forEach((m) => {
      const parent = m.parentNode;
      if (parent) { parent.replaceChild(document.createTextNode(m.textContent), m); parent.normalize(); }
    });
  };

  const highlightInDOM = (query) => {
    if (!query) return;
    clearDOMHighlights();
    const qLower = query.toLowerCase();
    const root = document.getElementById("root");
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const tag = node.parentElement?.tagName;
        if (!tag || tag === "SCRIPT" || tag === "STYLE" || tag === "INPUT" || tag === "TEXTAREA" || tag === "MARK") return NodeFilter.FILTER_REJECT;
        if (node.textContent.toLowerCase().includes(qLower)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let firstMark = null;
    for (const textNode of nodes) {
      const text = textNode.textContent;
      const idx = text.toLowerCase().indexOf(qLower);
      if (idx === -1 || !textNode.parentNode) continue;
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + query.length);
      const after = text.slice(idx + query.length);
      const mark = document.createElement("mark");
      mark.setAttribute("data-search-highlight", "true");
      mark.style.cssText = "background:#c9a227;color:#1a1a1a;border-radius:2px;padding:0 2px;";
      mark.textContent = match;
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));
      textNode.parentNode.replaceChild(frag, textNode);
      if (!firstMark) firstMark = mark;
    }
    // For textareas (quick notes): scroll to and select the match
    if (!firstMark) {
      const textareas = root.querySelectorAll("textarea");
      for (const ta of textareas) {
        const idx = ta.value.toLowerCase().indexOf(qLower);
        if (idx !== -1) {
          ta.scrollIntoView({ behavior: "smooth", block: "center" });
          ta.focus();
          ta.setSelectionRange(idx, idx + query.length);
          firstMark = ta;
          break;
        }
      }
    }
    if (firstMark) firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!highlightQuery) return;
    const clear = () => { setHighlightQuery(""); clearDOMHighlights(); };
    const timer = setTimeout(() => {
      document.addEventListener("keydown", clear, { once: true });
      document.addEventListener("mousedown", clear, { once: true });
    }, 400);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", clear); document.removeEventListener("mousedown", clear); };
  }, [highlightQuery]);

  const navItems = isMobile ? [
    { id: "planner", icon: "\u{1F4C5}", label: "Planner" },
    { id: "habits", icon: "\u{1F4CA}", label: "Habits" },
    { id: "notebooks", icon: "\u{1F4D3}", label: "Notes" },
    { id: "journal", icon: "\u{1F4DD}", label: "Journal" },
    { id: "contacts", icon: "\u{1F465}", label: "People" },
    { id: "categories", icon: "\u{2699}", label: "Settings" },
  ] : [
    { id: "planner", icon: "\u{1F4C5}", label: "Planner" },
    { id: "notebooks", icon: "\u{1F4D3}", label: "Notes" },
    { id: "journal", icon: "\u{1F4DD}", label: "Journal" },
    { id: "contacts", icon: "\u{1F465}", label: "People" },
    { id: "archive", icon: "\u2705", label: "Archive" },
    { id: "categories", icon: "\u{2699}", label: "Settings" },
  ];

  const mFS = isMobile ? 15 : 13; // mobile font size for tasks
  const mPad = isMobile ? "12px" : "8px";

  return (
    <DragContext.Provider value={isDragging}>
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "var(--bg)", color: "var(--text)" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />

      {/* Desktop: left sidebar nav */}
      {!isMobile && (
        <div style={{ width: 68, minWidth: 68, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 2 }}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveView(item.id)} title={item.label}
              style={{ width: 56, height: 48, borderRadius: 8, border: "none", cursor: "pointer", background: activeView === item.id ? "var(--border)" : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 18, color: activeView === item.id ? "var(--text)" : "var(--text-muted)", transition: "all 0.15s", gap: 2 }}>
              <span>{item.icon}</span><span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>{item.label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(""); }} title="Search"
            style={{ width: 42, height: 42, borderRadius: 8, border: "none", cursor: "pointer", background: searchOpen ? "var(--border)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: searchOpen ? "var(--text)" : "var(--text-muted)" }}>{"\u{1F50D}"}</button>
          <button onClick={onLogout} title={`Sign out (${userEmail})`}
            style={{ width: 42, height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", fontSize: 8, color: "var(--text-faint)", fontWeight: 600, letterSpacing: 0.3 }}>Sign out</button>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {searchOpen && (
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--input-bg)" }}>
            <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setSearchOpen(false); } }}
              placeholder="Search everything..." style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 10px", fontSize: isMobile ? 16 : 12, outline: "none", background: "var(--bg-card)", color: "var(--text)", boxSizing: "border-box" }} />
            {searchQuery.trim() && (() => {
              const results = getSearchResults();
              return (<div style={{ maxHeight: 200, overflowY: "auto", marginTop: 6 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>{results.length} result{results.length !== 1 ? "s" : ""}</div>
                {results.map((r, i) => (<div key={i} onClick={() => navigateToResult(r)} style={{ padding: "4px 8px", marginBottom: 2, borderRadius: 4, background: "var(--bg-card)", fontSize: isMobile ? 14 : 11, cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-card)"}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#8B6914", background: "rgba(139,105,20,0.08)", padding: "1px 4px", borderRadius: 2, marginRight: 6 }}>{r.type}</span>
                  {r.section && <span style={{ fontSize: 9, color: "var(--text-faint)", marginRight: 6 }}>{r.section}</span>}
                  <span style={{ color: "var(--text)" }}>{r.text}</span></div>))}
                {results.length === 0 && <div style={{ fontSize: 11, color: "var(--text-faint)" }}>No results found</div>}
              </div>);
            })()}
          </div>
        )}

        {activeView === "planner" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: isMobile ? "8px 12px 4px" : "10px 16px 6px", borderBottom: "1px solid var(--border)" }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 18, fontWeight: 700, letterSpacing: -0.5 }}>Weekly Planner</h1>
              <span style={{ fontSize: isMobile ? 13 : 11, color: "var(--text-muted)" }}>{weekDates[0]?.date} , {weekDates[6]?.date}</span>
            </div>
            {!isMobile && layout !== "horizontal" && (
              <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "0 12px" }}>
                <button onClick={() => setHabitsOpen(!habitsOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, padding: "6px 0", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 8, transition: "transform 0.2s", transform: habitsOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Habits</span>
                </button>
              </div>
            )}
            {!isMobile && layout !== "horizontal" && habitsOpen && (
              <HabitsTracker dailyHabits={dailyHabits} weeklyHabits={weeklyHabits} habitHistory={habitHistory || {}} onToggleDaily={toggleDaily} onToggleWeekly={toggleWeekly}
                onAddDaily={addDailyHabit} onAddWeekly={addWeeklyHabit} onDeleteDaily={deleteDaily} onDeleteWeekly={deleteWeekly} onEditDaily={editDaily} onEditWeekly={editWeekly} onReorderDaily={reorderDaily} onReorderWeekly={reorderWeekly} />
            )}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <div ref={scrollRef} onDragOver={(e) => {
                e.preventDefault();
                const el = scrollRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const y = e.clientY;
                const edgeSize = 60;
                if (y - rect.top < edgeSize) el.scrollTop -= 8;
                else if (rect.bottom - y < edgeSize) el.scrollTop += 8;
              }} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {(isMobile || layout === "vertical") ? (
                  <div style={{ padding: isMobile ? "4px 4px" : "4px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
                    {DAYS.map((day, i) => (
                      <DaySection key={day} dayInfo={weekDates[i]} columnId={day.toLowerCase()} tasks={tasks[day.toLowerCase()]} categories={categories}
                        onDragStart={() => {}} onDrop={handleDrop} onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} isMobile={isMobile} onMove={moveTask} onSetRecurring={setRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
                    ))}
                    {isMobile && (
                      <DaySection dayInfo={null} columnId="later" tasks={tasks.later} categories={categories} onDragStart={() => {}} onDrop={handleDrop}
                        onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} isMobile={isMobile} onMove={moveTask} onSetRecurring={setRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
                    )}
                    {/* Mobile upcoming section */}
                    {isMobile && futureTasks.length > 0 && (() => {
                      const grouped = {};
                      futureTasks.forEach((t) => { if (!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });
                      const sortedDates = Object.keys(grouped).sort();
                      return (
                        <div style={{ padding: "8px 4px" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: "var(--text-muted)", letterSpacing: 0.5, textTransform: "uppercase", padding: "4px 6px 6px" }}>Upcoming</div>
                          {sortedDates.map((date) => {
                            const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                            return (
                              <div key={date} style={{ marginBottom: 8, padding: "0 6px" }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
                                {grouped[date].map((task) => (
                                  <div key={task.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 10px", marginBottom: 4, fontSize: 15, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ flex: 1, wordBreak: "break-word" }}>{task.text}</span>
                                    <button onClick={() => deleteFuture(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 18, padding: "0 4px", fontWeight: 600 }}>&times;</button>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {/* Mobile quick notes inside scroll */}
                    {isMobile && (
                    <div style={{ padding: "8px 6px 12px" }}>
                      <textarea value={notes} onChange={(e) => { const val = e.target.value; update({ notes: val }); onSaveSettings({ categories, layout, notes: val, darkMode, taskFontSize }); }} placeholder="Quick notes..."
                        style={{ width: "100%", minHeight: 50, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 15, lineHeight: 1.5, outline: "none", background: "var(--input-bg)", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", resize: "none", boxSizing: "border-box", overflow: "hidden" }}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(50, el.scrollHeight) + "px"; } }} />
                    </div>
                    )}
                  </div>
                ) : (
                  <>
                  {/* Time Block Calendar View */}
                  {(() => {
                    const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
                    const HOUR_HEIGHT = 48;
                    const HALF = HOUR_HEIGHT / 2;
                    const dayKeys = ["mon","tue","wed","thu","fri","sat","sun"];

                    const getTasksForDay = (col) => {
                      const timed = (tasks[col] || []).filter((t) => t.startTime && !t.done);
                      const untimed = (tasks[col] || []).filter((t) => !t.startTime && !t.done);
                      const done = (tasks[col] || []).filter((t) => t.done);
                      return { timed, untimed, done };
                    };

                    const timeToMin = (t) => { const [h, m] = (t || "09:00").split(":").map(Number); return h * 60 + (m || 0); };
                    const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                    const minToTop = (m) => ((m / 60) - 6) * HOUR_HEIGHT;

                    const handleTimeDrop = (e, col, minuteOfDay) => {
                      e.preventDefault();
                      try {
                        const d = JSON.parse(e.dataTransfer.getData("text/plain"));
                        if (!d) return;
                        const startMin = Math.round(minuteOfDay / 15) * 15;
                        const timeStr = minToTime(startMin);
                        const task = (dataRef.current.tasks[d.from] || []).find((x) => x.id === d.taskId);
                        const duration = task?.endTime ? timeToMin(task.endTime) - timeToMin(task.startTime) : 30;
                        const endStr = minToTime(startMin + Math.max(15, duration));
                        if (d.from === col) {
                          const t = dataRef.current.tasks;
                          update({ tasks: { ...t, [col]: t[col].map((x) => x.id === d.taskId ? { ...x, startTime: timeStr, endTime: endStr } : x) } });
                        } else {
                          handleDrop(d.from, col, d.taskId, null);
                          setTimeout(() => {
                            const t = dataRef.current.tasks;
                            update({ tasks: { ...t, [col]: t[col].map((x) => x.id === d.taskId ? { ...x, startTime: timeStr, endTime: endStr } : x) } });
                          }, 50);
                        }
                      } catch {}
                      setDragTime(null);
                    };

                    const handleUntimedDrop = (e, col) => {
                      e.preventDefault();
                      try {
                        const d = JSON.parse(e.dataTransfer.getData("text/plain"));
                        if (!d) return;
                        if (d.from === col) {
                          const t = dataRef.current.tasks;
                          update({ tasks: { ...t, [col]: t[col].map((x) => x.id === d.taskId ? { ...x, startTime: undefined, endTime: undefined } : x) } });
                        } else {
                          handleDrop(d.from, col, d.taskId, null);
                          setTimeout(() => {
                            const t = dataRef.current.tasks;
                            update({ tasks: { ...t, [col]: t[col].map((x) => x.id === d.taskId ? { ...x, startTime: undefined, endTime: undefined } : x) } });
                          }, 50);
                        }
                      } catch {}
                    };

                    const removeTime = (col, taskId) => {
                      const t = dataRef.current.tasks;
                      update({ tasks: { ...t, [col]: t[col].map((x) => x.id === taskId ? { ...x, startTime: undefined, endTime: undefined } : x) } });
                    };

                    const resizeTask = (col, taskId, newEndMin) => {
                      const t = dataRef.current.tasks;
                      const endStr = minToTime(Math.max(newEndMin, timeToMin(t[col].find((x) => x.id === taskId)?.startTime || "09:00") + 15));
                      update({ tasks: { ...t, [col]: t[col].map((x) => x.id === taskId ? { ...x, endTime: endStr } : x) } });
                    };

                    const TimedTask = ({ task, col }) => {
                      const [expanded, setExpanded] = React.useState(false);
                      const startMin = timeToMin(task.startTime);
                      const endMin = task.endTime ? timeToMin(task.endTime) : startMin + 30;
                      const top = minToTop(startMin);
                      const height = Math.max(16, ((endMin - startMin) / 60) * HOUR_HEIGHT);
                      const catColor = getCatColor(categories, task.category);
                      const endLabel = task.endTime || minToTime(startMin + 30);

                      const startResize = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const startY = e.clientY;
                        const startEndMin = endMin;
                        const onMove = (e2) => {
                          const dy = e2.clientY - startY;
                          const deltaMin = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15;
                          const newEnd = Math.max(startMin + 15, startEndMin + deltaMin);
                          resizeTask(col, task.id, newEnd);
                        };
                        const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; };
                        document.addEventListener("mousemove", onMove);
                        document.addEventListener("mouseup", onUp);
                        document.body.style.cursor = "ns-resize";
                      };

                      return (
                        <div draggable
                          onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: task.id, from: col })); }}
                          onContextMenu={(e) => { e.preventDefault(); removeTime(col, task.id); }}
                          onClick={() => setExpanded(!expanded)}
                          style={{
                            position: "absolute", top, left: 1, right: 1, height: expanded ? "auto" : height,
                            minHeight: 16, maxHeight: expanded ? "none" : height,
                            background: `${catColor}40`, borderLeft: `3px solid ${catColor}`, borderRadius: 3,
                            padding: "1px 3px", fontSize: taskFontSize ? taskFontSize - 2 : 11, lineHeight: 1.2,
                            cursor: "grab", overflow: "hidden", color: "var(--text)", zIndex: expanded ? 10 : 2,
                            boxShadow: expanded ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                          }}>
                          <div style={{ fontSize: 7, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{task.startTime} - {endLabel}</div>
                          <div style={{ wordBreak: "break-word" }}>{task.text}</div>
                          {task.done && <span style={{ fontSize: 8, color: "var(--text-faint)" }}>(done)</span>}
                          {/* Resize handle */}
                          {!expanded && (
                            <div onMouseDown={startResize}
                              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, cursor: "ns-resize", borderRadius: "0 0 3px 3px" }}
                              onClick={(e) => e.stopPropagation()} />
                          )}
                        </div>
                      );
                    };

                    return (
                      <div style={{ flex: "none" }}>
                        {/* Day headers */}
                        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 5, background: "var(--bg)" }}>
                          <div style={{ width: 44, flexShrink: 0 }} />
                          {DAYS.map((day, i) => {
                            const info = weekDates[i];
                            const isToday = info?.isToday;
                            return (
                              <div key={day} style={{ flex: 1, textAlign: "center", padding: "6px 2px 4px", borderLeft: "1px solid var(--border-light)" }}>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: isToday ? "var(--accent)" : "var(--text-muted)", letterSpacing: 0.5 }}>{day}</div>
                                <div style={{ fontSize: isToday ? 18 : 14, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--accent)" : "var(--text)", lineHeight: 1.2 }}>{info?.date?.split(" ")[1]}</div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Time grid */}
                        <div style={{ display: "flex", position: "relative" }}>
                          {/* Hour labels */}
                          <div style={{ width: 44, flexShrink: 0 }}>
                            {HOURS.map((h) => (
                              <div key={h} style={{ height: HOUR_HEIGHT, fontSize: 9, color: "var(--text-faint)", textAlign: "right", paddingRight: 6, paddingTop: 0, fontFamily: "'JetBrains Mono', monospace", borderTop: "1px solid var(--border-light)" }}>
                                {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                              </div>
                            ))}
                          </div>
                          {/* Day columns */}
                          {dayKeys.map((col, di) => {
                            const { timed } = getTasksForDay(col);
                            return (
                              <div key={col} style={{ flex: 1, position: "relative", borderLeft: "1px solid var(--border-light)", minWidth: 0 }}>
                                {/* Half-hour drop zones */}
                                {HOURS.map((h) => (
                                  <div key={h} style={{ height: HOUR_HEIGHT, borderTop: "1px solid var(--border-light)", display: "flex", flexDirection: "column" }}>
                                    {[0, 30].map((halfMin) => {
                                      const totalMin = h * 60 + halfMin;
                                      const isOver = dragTime?.col === col && dragTime?.min === totalMin;
                                      return (
                                        <div key={halfMin}
                                          onDragOver={(e) => { e.preventDefault(); setDragTime({ col, min: totalMin }); }}
                                          onDragLeave={() => setDragTime(null)}
                                          onDrop={(e) => handleTimeDrop(e, col, totalMin)}
                                          style={{
                                            flex: 1, background: isOver ? "rgba(139,105,20,0.12)" : "transparent",
                                            borderTop: halfMin === 30 ? "1px dashed var(--border-light)" : "none",
                                          }} />
                                      );
                                    })}
                                  </div>
                                ))}
                                {/* Positioned task blocks */}
                                {timed.map((task) => <TimedTask key={task.id} task={task} col={col} />)}
                                {/* Current time indicator */}
                                {weekDates[di]?.isToday && (() => {
                                  const now = new Date();
                                  const nowH = now.getHours(), nowM = now.getMinutes();
                                  if (nowH < 6 || nowH > 23) return null;
                                  const top = minToTop(nowH * 60 + nowM);
                                  return <div style={{ position: "absolute", top, left: 0, right: 0, height: 2, background: "#c44", zIndex: 3, borderRadius: 1, pointerEvents: "none" }}>
                                    <div style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#c44" }} />
                                  </div>;
                                })()}
                              </div>
                            );
                          })}
                        </div>
                        {/* Unscheduled tasks section */}
                        <div style={{ borderTop: "2px solid var(--border)", padding: "0 0 4px" }}>
                          <div style={{ padding: "4px 8px 2px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 8, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>Unscheduled</div>
                          <div style={{ display: "flex" }}>
                            <div style={{ width: 44, flexShrink: 0 }} />
                            {dayKeys.map((col) => {
                              const { untimed, done } = getTasksForDay(col);
                              return (
                                <div key={col} style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--border-light)", padding: "2px 2px" }}
                                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleUntimedDrop(e, col)}>
                                  {untimed.map((task) => {
                                    const catColor = getCatColor(categories, task.category);
                                    return (
                                      <div key={task.id} draggable
                                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: task.id, from: col })); }}
                                        style={{ padding: "2px 4px", borderLeft: `3px solid ${catColor}`, background: `${catColor}18`, marginBottom: 2, fontSize: taskFontSize ? taskFontSize - 2 : 11, lineHeight: 1.3, cursor: "grab", borderRadius: 2, overflow: "hidden" }}>
                                        <input type="checkbox" checked={task.done} onChange={() => toggleDone(col, task.id)}
                                          style={{ float: "left", width: 13, height: 13, marginRight: 4, marginTop: 1, cursor: "pointer", accentColor: "#5a5a5a" }} />
                                        <span style={{ wordBreak: "break-word", color: "var(--text)" }}>{task.text}</span>
                                      </div>
                                    );
                                  })}
                                  {done.length > 0 && (
                                    <div style={{ fontSize: 8, color: "var(--text-faint)", textAlign: "center", padding: "1px 0" }}>{done.length} done</div>
                                  )}
                                  <div onClick={() => { const text = prompt("New task:"); if (text?.trim()) addTask(col, text.trim(), autoDetectCategory(text, categories)); }}
                                    style={{ fontSize: 9, color: "var(--text-faint)", cursor: "pointer", textAlign: "center", padding: "2px 0" }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-muted)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-faint)"}>
                                    + Add
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  </>
                )}
                {/* Below time grid: 2-column layout for horizontal mode */}
                {!isMobile && layout === "horizontal" && (
                  <div style={{ display: "flex", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Habits */}
                      <div style={{ borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", padding: "0 12px" }}>
                          <button onClick={() => setHabitsOpen(!habitsOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, padding: "6px 0", display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 8, transition: "transform 0.2s", transform: habitsOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Habits</span>
                          </button>
                        </div>
                        {habitsOpen && (
                          <HabitsTracker dailyHabits={dailyHabits} weeklyHabits={weeklyHabits} habitHistory={habitHistory || {}} onToggleDaily={toggleDaily} onToggleWeekly={toggleWeekly}
                            onAddDaily={addDailyHabit} onAddWeekly={addWeeklyHabit} onDeleteDaily={deleteDaily} onDeleteWeekly={deleteWeekly} onEditDaily={editDaily} onEditWeekly={editWeekly} onReorderDaily={reorderDaily} onReorderWeekly={reorderWeekly} />
                        )}
                      </div>
                      {/* Later */}
                      <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        <button onClick={() => setLaterOpen(!laterOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, width: "100%", textAlign: "left" }}>
                          <span style={{ fontSize: 8, transition: "transform 0.2s", transform: laterOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Later</span>
                          <span style={{ fontSize: 9, color: "var(--text-faint)" }}>({tasks.later?.length || 0})</span>
                        </button>
                        {laterOpen && (
                          <div style={{ padding: "0px 8px 6px" }}>
                            <DaySection dayInfo={null} columnId="later" tasks={tasks.later} categories={categories} onDragStart={() => {}} onDrop={handleDrop}
                              onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} onMove={moveTask} onSetRecurring={setRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
                          </div>
                        )}
                      </div>
                      {/* Quick Notes */}
                      <div>
                        <button onClick={() => setNotesOpen(!notesOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, width: "100%", textAlign: "left" }}>
                          <span style={{ fontSize: 8, transition: "transform 0.2s", transform: notesOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Quick Notes</span>
                        </button>
                        {notesOpen && (
                          <div style={{ padding: "0 12px 12px" }}>
                            <textarea value={notes} onChange={(e) => { const val = e.target.value; update({ notes: val }); onSaveSettings({ categories, layout, notes: val, darkMode, taskFontSize }); }} placeholder="Quick notes..."
                              style={{ width: "100%", minHeight: 50, border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1.5, outline: "none", background: "var(--input-bg)", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", resize: "none", boxSizing: "border-box", overflow: "hidden", height: "auto" }}
                              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(50, el.scrollHeight) + "px"; } }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <FutureSidebar futureTasks={futureTasks} onAddFuture={addFuture} onDeleteFuture={deleteFuture} onEditFuture={editFuture} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
                  </div>
                )}
                {/* Vertical layout: Later, Notes as before */}
                {!isMobile && layout !== "horizontal" && (
                  <>
                {/* Collapsible Later section */}
                <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
                    <button onClick={() => setLaterOpen(!laterOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, width: "100%", textAlign: "left" }}>
                      <span style={{ fontSize: 8, transition: "transform 0.2s", transform: laterOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Later</span>
                      <span style={{ fontSize: 9, color: "var(--text-faint)" }}>({tasks.later?.length || 0})</span>
                    </button>
                    {laterOpen && (
                      <div style={{ padding: "0px 8px 6px" }}>
                        <DaySection dayInfo={null} columnId="later" tasks={tasks.later} categories={categories} onDragStart={() => {}} onDrop={handleDrop}
                          onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} onMove={moveTask} onSetRecurring={setRecurring} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />
                      </div>
                    )}
                </div>
                {/* Collapsible Quick Notes */}
                <div style={{ borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => setNotesOpen(!notesOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, width: "100%", textAlign: "left" }}>
                      <span style={{ fontSize: 8, transition: "transform 0.2s", transform: notesOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Quick Notes</span>
                    </button>
                    {notesOpen && (
                      <div style={{ padding: "0 12px 12px" }}>
                        <textarea value={notes} onChange={(e) => { const val = e.target.value; update({ notes: val }); onSaveSettings({ categories, layout, notes: val, darkMode, taskFontSize }); }} placeholder="Quick notes..."
                          style={{ width: "100%", minHeight: 50, border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1.5, outline: "none", background: "var(--input-bg)", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", resize: "none", boxSizing: "border-box", overflow: "hidden", height: "auto" }}
                          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(50, el.scrollHeight) + "px"; } }} />
                      </div>
                    )}
                </div>
                  </>
                )}
              </div>
              {!isMobile && layout !== "horizontal" && <FutureSidebar futureTasks={futureTasks} onAddFuture={addFuture} onDeleteFuture={deleteFuture} onEditFuture={editFuture} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />}
            </div>
          </div>
        )}

        {activeView === "notebooks" && <NotebooksPanel notebooks={notebooks} onChange={updateNotebooks} userId={userId} isMobile={isMobile} />}
        {activeView === "journal" && <JournalPanel journal={journal} onChange={updateJournal} userId={userId} isMobile={isMobile} />}
        {activeView === "contacts" && <ContactsPanel contacts={contacts} onChange={updateContacts} highlightQuery={highlightQuery} taskFontSize={taskFontSize} />}
        {activeView === "categories" && <CategoryManager categories={categories} onChange={updateCategories} layout={layout} onLayoutChange={(l) => { update({ layout: l }); onSaveSettings({ categories, layout: l, notes, darkMode, taskFontSize }); }} darkMode={darkMode} onDarkModeChange={(dm) => { update({ darkMode: dm }); onSaveSettings({ categories, layout, notes, darkMode: dm, taskFontSize }); }} taskFontSize={taskFontSize} onTaskFontSizeChange={(sz) => { update({ taskFontSize: sz }); onSaveSettings({ categories, layout, notes, darkMode, taskFontSize: sz }); }} onGetBackups={onGetBackups} onRestoreBackup={onRestoreBackup} onExportData={onExportData} />}

        {activeView === "habits" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Habits</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Daily Habits</div>
                {dailyHabits.map((h) => {
                  const cnt = Object.values(h.checks).filter(Boolean).length;
                  return (
                    <div key={h.id} style={{ marginBottom: 10, padding: "8px 10px", background: "var(--bg-surface)", borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 15, color: "var(--text)", fontWeight: 500 }}>{h.name}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cnt}/7</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {DAYS.map((d) => (
                          <div key={d} onClick={() => toggleDaily(h.id, d.toLowerCase())}
                            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
                            <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>{d.slice(0,2)}</span>
                            <div style={{
                              width: 28, height: 28, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                              background: h.checks[d.toLowerCase()] ? "#6a9955" : "transparent",
                              border: h.checks[d.toLowerCase()] ? "none" : "1.5px solid var(--border)",
                              color: "#fff", fontSize: 14, fontWeight: 700,
                            }}>{h.checks[d.toLowerCase()] && "\u2713"}</div>
                          </div>
                        ))}
                        <button onClick={() => deleteDaily(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 16, padding: "0 4px", alignSelf: "flex-end" }}>&times;</button>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => { const name = prompt("Daily habit name:"); if (name?.trim()) addDailyHabit(name.trim()); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 14, padding: "4px 0" }}>+ Add daily habit</button>
              </div>

              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Weekly Habits</div>
                {weeklyHabits.map((h) => (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", background: "var(--bg-surface)", borderRadius: 6, marginBottom: 6 }}>
                    <div onClick={() => toggleWeekly(h.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 5, cursor: "pointer", flexShrink: 0,
                        background: h.done ? "#6a9955" : "transparent",
                        border: h.done ? "none" : "1.5px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 14, fontWeight: 700,
                      }}>{h.done && "\u2713"}</div>
                    <span style={{ flex: 1, fontSize: 15, color: h.done ? "var(--text-muted)" : "var(--text)", textDecoration: h.done ? "line-through" : "none" }}>{h.name}</span>
                    <button onClick={() => deleteWeekly(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 16, padding: 0 }}>&times;</button>
                  </div>
                ))}
                <button onClick={() => { const name = prompt("Weekly habit name:"); if (name?.trim()) addWeeklyHabit(name.trim()); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 14, padding: "4px 0" }}>+ Add weekly habit</button>
              </div>

              {/* Mobile streaks */}
              {(() => {
                const hh = habitHistory || {};
                const weeks = Object.keys(hh).sort().reverse();
                const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
                const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
                const todayIdx = (() => { const d = new Date().getDay(); return (d + 6) % 7; })();

                const dailyByDay = dayKeys.map((d) => {
                  const done = dailyHabits.filter((h) => h.checks[d]).length;
                  return { done, total: dailyHabits.length };
                });

                const circle = (pct, isFuture, isToday) => {
                  const size = 30; const r = 12; const circ = 2 * Math.PI * r; const offset = circ * (1 - pct);
                  const color = pct >= 0.8 ? "#6a9955" : pct >= 0.5 ? "#c9a227" : pct > 0 ? "#c47a20" : "var(--border)";
                  return (
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={isFuture ? "var(--bg-hover)" : "var(--border)"} strokeWidth={3} />
                      {!isFuture && pct > 0 && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
                        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />}
                      {isToday && <circle cx={size/2} cy={size/2} r={2} fill="var(--accent)" />}
                    </svg>
                  );
                };

                const dailyStreaks = dailyHabits.map((h) => {
                  let streak = 0;
                  if (Object.values(h.checks).filter(Boolean).length >= 5) streak++;
                  else return { name: h.name, streak: 0 };
                  for (const wk of weeks) {
                    const wData = hh[wk]?.daily;
                    if (!wData) break;
                    const match = wData.find((hh2) => hh2.id === h.id || hh2.name === h.name);
                    if (match && Object.values(match.checks || {}).filter(Boolean).length >= 5) streak++;
                    else break;
                  }
                  return { name: h.name, streak };
                });

                const prev = weeks[0] ? hh[weeks[0]] : null;
                const prevTotal = prev?.daily ? prev.daily.reduce((s, h) => s + Object.values(h.checks || {}).filter(Boolean).length, 0) : 0;
                const curTotal = dailyHabits.reduce((s, h) => s + Object.values(h.checks).filter(Boolean).length, 0);
                const daysElapsed = todayIdx + 1;
                const curPace = daysElapsed > 0 ? Math.round(curTotal / daysElapsed * 7) : 0;
                let paceMsg = "";
                if (prev && daysElapsed >= 2) {
                  if (curPace > prevTotal) paceMsg = `On pace to beat last week!`;
                  else if (curTotal >= prevTotal) paceMsg = "Already passed last week's total!";
                }

                const spotlights = [];
                const longestStreak = dailyStreaks.reduce((best, s) => s.streak > best.streak ? s : best, { name: "", streak: 0 });
                if (longestStreak.streak >= 2) spotlights.push(`\uD83D\uDD25 ${longestStreak.name}: ${longestStreak.streak}w streak`);
                dailyHabits.filter((h) => Object.values(h.checks).filter(Boolean).length === 7).forEach((h) => spotlights.push(`\u2B50 ${h.name}: perfect week!`));

                return (
                  <div style={{ marginTop: 20, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>This Week</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                      {dayKeys.map((d, i) => {
                        const dd = dailyByDay[i];
                        const pct = dd.total > 0 ? dd.done / dd.total : 0;
                        return (
                          <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <span style={{ fontSize: 10, color: i === todayIdx ? "var(--accent)" : "var(--text-faint)", fontWeight: i === todayIdx ? 700 : 400, fontFamily: "'JetBrains Mono', monospace" }}>{dayLabels[i]}</span>
                            {circle(pct, i > todayIdx, i === todayIdx)}
                            {i <= todayIdx && <span style={{ fontSize: 9, color: pct >= 0.8 ? "#6a9955" : "var(--text-faint)" }}>{dd.done}/{dd.total}</span>}
                          </div>
                        );
                      })}
                    </div>
                    {paceMsg && <div style={{ textAlign: "center", fontSize: 13, color: "#6a9955", fontWeight: 600, marginBottom: 6 }}>{paceMsg}</div>}
                    {spotlights.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                        {spotlights.map((s, i) => (
                          <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "var(--bg-surface)", color: "var(--text-muted)", fontWeight: 500 }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {weeks.length === 0 && spotlights.length === 0 && !paceMsg && <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>History starts after your first full week</div>}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeView === "archive" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Archive</span>
            </div>

            {/* Task completion stats */}
            {archive.length > 0 && (() => {
              const now = new Date();
              const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
              const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
              const pastWeek = archive.filter((a) => new Date(a.completedAt) >= weekAgo);
              const pastMonth = archive.filter((a) => new Date(a.completedAt) >= monthAgo);

              // Category breakdown for past week
              const weekByCat = {};
              pastWeek.forEach((a) => { const cat = a.category || "cat_none"; weekByCat[cat] = (weekByCat[cat] || 0) + 1; });
              const monthByCat = {};
              pastMonth.forEach((a) => { const cat = a.category || "cat_none"; monthByCat[cat] = (monthByCat[cat] || 0) + 1; });

              return (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", maxWidth: 600 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Productivity</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 6, padding: "8px 14px", textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{pastWeek.length}</div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Past 7 Days</div>
                    </div>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 6, padding: "8px 14px", textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{pastMonth.length}</div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Past 30 Days</div>
                    </div>
                    {pastMonth.length > 0 && (() => {
                      // Calculate actual days of data (from oldest archived task to now, capped at 30)
                      const oldest = archive.reduce((min, a) => { const d = new Date(a.completedAt); return d < min ? d : min; }, now);
                      const actualDays = Math.min(30, Math.max(1, Math.ceil((now - oldest) / 86400000)));
                      const avg = Math.round(pastMonth.length / actualDays * 7);
                      return (
                      <div style={{ background: "var(--bg-surface)", borderRadius: 6, padding: "8px 14px", textAlign: "center", flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{avg}</div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Avg / Week</div>
                      </div>
                      );
                    })()}
                  </div>
                  {Object.keys(weekByCat).length > 0 && (
                    <>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Past 7 Days by Category</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                        {Object.entries(weekByCat).sort((a, b) => b[1] - a[1]).map(([catId, count]) => {
                          const catColor = getCatColor(categories, catId);
                          const catName = getCatName(categories, catId);
                          return (
                            <span key={catId} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: catColor + "30", borderLeft: `3px solid ${catColor}`, color: "var(--text)", fontWeight: 500 }}>
                              {catName}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Habit Progress */}
            {(() => {
              const hh = habitHistory || {};
              const weeks = Object.keys(hh).sort().reverse();
              if (weeks.length === 0 && dailyHabits.length === 0) return null;

              const recent4 = weeks.slice(0, 4);
              const dayLabels = ["M","T","W","T","F","S","S"];
              const dayKeys = ["mon","tue","wed","thu","fri","sat","sun"];

              // Build per-habit grid data: rows = habits, cols = weeks (newest first), cells = day checks
              const allHabitNames = new Set();
              recent4.forEach((wk) => { (hh[wk]?.daily || []).forEach((h) => allHabitNames.add(h.name)); });
              dailyHabits.forEach((h) => allHabitNames.add(h.name));
              const habitNames = [...allHabitNames];

              // Week labels
              const weekLabels = recent4.map((wk) => {
                const d = new Date(wk + "T12:00:00");
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              });

              // Weekly habits: per-week detail
              const allWeeklyNames = new Set();
              recent4.forEach((wk) => { (hh[wk]?.weekly || []).forEach((h) => allWeeklyNames.add(h.name)); });
              weeklyHabits.forEach((h) => allWeeklyNames.add(h.name));
              const weeklyNames = [...allWeeklyNames];

              // 4-week averages
              let total4Daily = 0, possible4Daily = 0, total4Weekly = 0, possible4Weekly = 0;
              recent4.forEach((wk) => {
                const w = hh[wk];
                if (w?.daily) { total4Daily += w.daily.reduce((s, h) => s + Object.values(h.checks || {}).filter(Boolean).length, 0); possible4Daily += w.daily.length * 7; }
                if (w?.weekly) { total4Weekly += w.weekly.filter((h) => h.done).length; possible4Weekly += w.weekly.length; }
              });

              const dot = (on) => (
                <div style={{ width: 10, height: 10, borderRadius: 2, background: on ? "#6a9955" : "var(--border)", opacity: on ? 1 : 0.4 }} />
              );

              const sLabel = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 };

              return (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", maxWidth: 700 }}>
                  <div style={sLabel}>Habit Progress</div>

                  {/* Daily habits heat map with integrated progress bars */}
                  {habitNames.length > 0 && recent4.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>Daily Habits ({recent4.length} week{recent4.length > 1 ? "s" : ""})</div>
                      <div style={{ overflowX: "auto", marginBottom: 10 }}>
                        <table style={{ borderCollapse: "collapse", fontSize: 9 }}>
                          <thead>
                            <tr>
                              <td style={{ padding: "0 6px 0 0", minWidth: 80 }} />
                              {recent4.map((wk, wi) => {
                                const wd = hh[wk]?.daily || [];
                                const done = wd.reduce((s, h) => s + Object.values(h.checks || {}).filter(Boolean).length, 0);
                                const total = wd.length * 7;
                                const pct = total > 0 ? Math.round(done / total * 100) : 0;
                                return (
                                  <td key={wk} colSpan={7} style={{ padding: "0 2px 3px", borderLeft: wi > 0 ? "1px solid var(--border)" : "none" }}>
                                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: 8, marginBottom: 2 }}>{weekLabels[wi]}</div>
                                    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                                      <div style={{ width: `${pct}%`, height: "100%", background: "#6a9955", borderRadius: 2 }} />
                                    </div>
                                    <div style={{ textAlign: "center", fontSize: 7, color: "var(--text-faint)", marginTop: 1 }}>{pct}%</div>
                                  </td>
                                );
                              })}
                            </tr>
                            <tr>
                              <td />
                              {recent4.map((wk, wi) => dayLabels.map((d, di) => (
                                <td key={wk+d+di} style={{ textAlign: "center", padding: "0 1px", color: "var(--text-faint)", fontSize: 7, borderLeft: di === 0 && wi > 0 ? "1px solid var(--border)" : "none" }}>{d}</td>
                              )))}
                            </tr>
                          </thead>
                          <tbody>
                            {habitNames.map((name) => (
                              <tr key={name}>
                                <td style={{ padding: "1px 6px 1px 0", color: "var(--text)", fontSize: 10, whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</td>
                                {recent4.map((wk, wi) => {
                                  const weekData = hh[wk]?.daily || [];
                                  const habit = weekData.find((h) => h.name === name);
                                  const existed = !!habit;
                                  return dayKeys.map((dk, di) => {
                                    const on = existed ? !!habit.checks?.[dk] : false;
                                    return (
                                      <td key={wk+dk} style={{ padding: "1px 1px", textAlign: "center", borderLeft: di === 0 && wi > 0 ? "1px solid var(--border)" : "none" }}>
                                        {existed ? dot(on) : <div style={{ width: 10, height: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "var(--text-faint)" }}>&ndash;</div>}
                                      </td>
                                    );
                                  });
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Weekly habits detail */}
                  {weeklyNames.length > 0 && recent4.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>Weekly Habits</div>
                      <div style={{ overflowX: "auto", marginBottom: 10 }}>
                        <table style={{ borderCollapse: "collapse", fontSize: 9 }}>
                          <thead>
                            <tr>
                              <td style={{ padding: "0 6px 0 0", minWidth: 80 }} />
                              {recent4.map((wk, wi) => (
                                <td key={wk} style={{ textAlign: "center", padding: "0 8px 2px", color: "var(--text-muted)", fontWeight: 600, fontSize: 8, borderLeft: wi > 0 ? "1px solid var(--border)" : "none" }}>
                                  {weekLabels[wi]}
                                </td>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {weeklyNames.map((name) => (
                              <tr key={name}>
                                <td style={{ padding: "1px 6px 1px 0", color: "var(--text)", fontSize: 10, whiteSpace: "nowrap" }}>{name}</td>
                                {recent4.map((wk, wi) => {
                                  const weekData = hh[wk]?.weekly || [];
                                  const habit = weekData.find((h) => h.name === name);
                                  const existed = !!habit;
                                  return (
                                    <td key={wk} style={{ textAlign: "center", padding: "1px 8px", borderLeft: wi > 0 ? "1px solid var(--border)" : "none" }}>
                                      {existed ? <span style={{ fontSize: 11, color: habit.done ? "#6a9955" : "#c47a20" }}>{habit.done ? "\u2713" : "\u2717"}</span> : <span style={{ fontSize: 9, color: "var(--text-faint)" }}>&ndash;</span>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* 4-week averages */}
                  {recent4.length > 0 && (
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ background: "var(--bg-surface)", borderRadius: 6, padding: "8px 14px", textAlign: "center", flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#6a9955" }}>{possible4Daily > 0 ? Math.round(total4Daily / possible4Daily * 100) : 0}%</div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Daily Avg</div>
                      </div>
                      <div style={{ background: "var(--bg-surface)", borderRadius: 6, padding: "8px 14px", textAlign: "center", flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#5b8fb9" }}>{possible4Weekly > 0 ? Math.round(total4Weekly / possible4Weekly * 100) : 0}%</div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Weekly Avg</div>
                      </div>
                    </div>
                  )}

                  {weeks.length === 0 && <div style={{ fontSize: 10, color: "var(--text-faint)" }}>Habit history will appear after your first full week</div>}
                </div>
              );
            })()}

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", maxWidth: 600 }}>
              {archive.length === 0 && <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 20 }}>No completed tasks yet</div>}
              {archive.map((entry) => {
                const dateObj = entry.assignedDate && entry.assignedDate !== "later" ? new Date(entry.assignedDate + "T12:00:00") : null;
                const dateLabel = dateObj ? dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Later";
                const completedLabel = new Date(entry.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const catColor = getCatColor(categories, entry.category);
                return (
                  <div key={entry.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 8px", marginBottom: 4, fontSize: isMobile ? 14 : 11, borderLeft: `3px solid ${catColor}`, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "var(--text)", fontWeight: 500 }}><HighlightText text={entry.text} query={highlightQuery} /></div>
                      <div style={{ fontSize: isMobile ? 11 : 9, color: "var(--text-muted)", marginTop: 3 }}>
                        {entry.category && <span style={{ background: catColor, padding: "1px 4px", borderRadius: 2, marginRight: 4, color: "var(--text)", fontSize: 8 }}>{getCatName(categories, entry.category)}</span>}
                        Assigned: {dateLabel} &middot; Done: {completedLabel}
                      </div>
                    </div>
                    <button onClick={() => { const newArchive = archive.filter((a) => a.id !== entry.id); update({ archive: newArchive }); onSaveArchive(newArchive); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 14, padding: "0 2px", lineHeight: 1, fontWeight: 600, flexShrink: 0 }}
                      onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "var(--text-faint)")}>&times;</button>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "6px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-faint)" }}>{archive.length} completed {archive.length === 1 ? "task" : "tasks"}</div>
          </div>
        )}

        {/* Mobile notes now inside scroll area above */}
      </div>

      {/* Mobile: bottom nav bar */}
      {isMobile && (
        <div style={{
          display: "flex", background: "var(--bg-surface)", borderTop: "1px solid var(--border)",
          padding: "4px 0 2px", flexShrink: 0, justifyContent: "space-around", alignItems: "center",
        }}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                color: activeView === item.id ? "var(--accent)" : "var(--text-muted)",
                fontSize: 18, padding: "4px 8px",
              }}>
              <span>{item.icon}</span>
              <span style={{ fontSize: 8, fontWeight: 600 }}>{item.label}</span>
            </button>
          ))}
          <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, color: searchOpen ? "var(--accent)" : "var(--text-muted)", fontSize: 18, padding: "4px 8px" }}>
            <span>{"\u{1F50D}"}</span><span style={{ fontSize: 8, fontWeight: 600 }}>Search</span>
          </button>
        </div>
      )}
    </div>
    </DragContext.Provider>
  );
}
