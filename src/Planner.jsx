import { useState, useRef, useCallback, useEffect } from "react";
import { makeTask, getWeekDates, getUpcomingDates, DEFAULT_CATEGORIES } from "./usePlannerData";
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
  cat_learning: ["learn", "study", "course", "lecture", "class", "homework", "research", "practice", "lesson", "tutorial", "certificate", "training", "coursera", "udemy"],
  cat_crafts: ["read", "book", "draw", "paint", "craft", "art", "sketch", "sew", "knit", "crochet", "journal", "write", "pottery", "collage", "creative"],
  cat_sporas: ["sporas", "poetry", "land day", "olive branch", "magazine", "diaspora", "abulhawa", "book club"],
  cat_events: ["event", "party", "birthday", "dinner party", "gathering", "celebration", "concert", "show", "festival", "conference", "workshop"],
  cat_volunteering: ["volunteer", "red raccoon", "bike rescue", "house of friendship", "community", "donate", "fundraise", "advocacy"],
  cat_gardening: ["garden", "plant", "seed", "water", "prune", "harvest", "compost", "soil", "flower", "weed", "transplant", "mulch", "jerash"],
};

function autoDetectCategory(text, categories) {
  const lower = text.toLowerCase();
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (categories.find((c) => c.id === catId)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) return catId;
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
function CategoryManager({ categories, onChange, layout, onLayoutChange, darkMode, onDarkModeChange }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#B7D5E8");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
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
      onChange([...categories, { id: "cat_" + Date.now(), name: newName.trim(), color: newColor }]);
      setNewName(""); setNewColor("#B7D5E8");
    }
    setAdding(false);
  };

  const saveEdit = () => {
    if (editName.trim()) {
      onChange(categories.map((c) => c.id === editingId ? { ...c, name: editName.trim(), color: editColor } : c));
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
                    style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", fontSize: 13, outline: "none" }} />
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
                <span style={{ flex: 1, fontSize: 14, color: "var(--text)" }}>{cat.name}</span>
                <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); }}
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
                placeholder="Category name..." style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", fontSize: 13, outline: "none" }} />
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
    </div>
  );
}

/* ─── Resize Handle ─── */
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
function HabitsTracker({ dailyHabits, weeklyHabits, onToggleDaily, onToggleWeekly, onAddDaily, onAddWeekly, onDeleteDaily, onDeleteWeekly }) {
  const [addingDaily, setAddingDaily] = useState(false);
  const [addingWeekly, setAddingWeekly] = useState(false);
  const [newDaily, setNewDaily] = useState("");
  const [newWeekly, setNewWeekly] = useState("");
  const dailyRef = useRef(null);
  const weeklyRef = useRef(null);
  useEffect(() => { if (addingDaily && dailyRef.current) dailyRef.current.focus(); }, [addingDaily]);
  useEffect(() => { if (addingWeekly && weeklyRef.current) weeklyRef.current.focus(); }, [addingWeekly]);
  const addDH = () => { if (newDaily.trim()) { onAddDaily(newDaily.trim()); setNewDaily(""); } setAddingDaily(false); };
  const addWH = () => { if (newWeekly.trim()) { onAddWeekly(newWeekly.trim()); setNewWeekly(""); } setAddingWeekly(false); };
  const sLabel = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 };
  const chk = (on) => ({ width: 16, height: 16, borderRadius: 3, cursor: "pointer", border: on ? "none" : "1.5px solid #ccc", background: on ? "#6a9955" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0, fontSize: 10, color: "#fff", fontWeight: 700 });
  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px", display: "flex", gap: 16, overflow: "hidden" }}>
      <div style={{ flex: "1 1 50%", minWidth: 0, overflow: "hidden" }}>
        <div style={sLabel}>Daily Habits</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: "0 0 140px" }} />
            {DAYS.map((d) => (<div key={d} style={{ width: 28, textAlign: "center", fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.5, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{d.slice(0,2)}</div>))}
            <div style={{ width: 18, flexShrink: 0 }} />
          </div>
          {dailyHabits.map((h) => {
            const cnt = Object.values(h.checks).filter(Boolean).length;
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ flex: "0 0 140px", fontSize: 12, color: "var(--text)", paddingRight: 4, wordBreak: "break-word", lineHeight: 1.3 }}>{h.name}<span style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: 4 }}>{cnt}/7</span></div>
                {DAYS.map((d) => (<div key={d} style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}><div onClick={() => onToggleDaily(h.id, d.toLowerCase())} style={chk(h.checks[d.toLowerCase()])}>{h.checks[d.toLowerCase()] && "\u2713"}</div></div>))}
                <button onClick={() => onDeleteDaily(h.id)} style={{ width: 18, flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13, padding: 0, fontWeight: 600 }} onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "#ccc")}>&times;</button>
              </div>);
          })}
          {addingDaily ? (<div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><input ref={dailyRef} value={newDaily} onChange={(e) => setNewDaily(e.target.value)} onBlur={addDH} onKeyDown={(e) => { if (e.key === "Enter") addDH(); if (e.key === "Escape") setAddingDaily(false); }} placeholder="Habit name..." style={{ width: 140, border: "1px solid var(--border)", borderRadius: 4, padding: "3px 6px", fontSize: 11, outline: "none", background: "var(--input-bg)" }} /></div>
          ) : (<button onClick={() => setAddingDaily(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 11, padding: "2px 0", textAlign: "left" }} onMouseEnter={(e) => (e.target.style.color = "#777")} onMouseLeave={(e) => (e.target.style.color = "#bbb")}>+ Add daily habit</button>)}
        </div>
      </div>
      <div style={{ flex: "1 1 50%", minWidth: 0, overflow: "hidden" }}>
        <div style={sLabel}>Weekly Habits</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {weeklyHabits.map((h) => (<div key={h.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><div onClick={() => onToggleWeekly(h.id)} style={chk(h.done)}>{h.done && "\u2713"}</div><span style={{ fontSize: 12, color: h.done ? "#aaa" : "#555", textDecoration: h.done ? "line-through" : "none", wordBreak: "break-word", minWidth: 0 }}>{h.name}</span><button onClick={() => onDeleteWeekly(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13, padding: 0, marginLeft: "auto", fontWeight: 600, flexShrink: 0 }} onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "#ccc")}>&times;</button></div>))}
          {addingWeekly ? (<input ref={weeklyRef} value={newWeekly} onChange={(e) => setNewWeekly(e.target.value)} onBlur={addWH} onKeyDown={(e) => { if (e.key === "Enter") addWH(); if (e.key === "Escape") setAddingWeekly(false); }} placeholder="Habit name..." style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "3px 6px", fontSize: 11, outline: "none", background: "var(--input-bg)" }} />
          ) : (<button onClick={() => setAddingWeekly(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 11, padding: "2px 0", textAlign: "left" }} onMouseEnter={(e) => (e.target.style.color = "#777")} onMouseLeave={(e) => (e.target.style.color = "#bbb")}>+ Add weekly habit</button>)}
        </div>
      </div>
    </div>
  );
}

/* ─── Notes ─── */
function NotesSection({ notes, onChange }) {
  return (
    <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, flexShrink: 0 }}>Notes</div>
      <textarea value={notes} onChange={(e) => onChange(e.target.value)} placeholder="Jot things down here..."
        style={{ width: "100%", flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1.5, outline: "none", background: "var(--input-bg)", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", resize: "none", boxSizing: "border-box" }} />
    </div>
  );
}

/* ─── Task Card ─── */
function TaskCard({ task, columnId, categories, onDragStart, onToggle, onDelete, onEdit, onChangeCategory, isMobile }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [hover, setHover] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => {
    if (!showCatPicker) return;
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowCatPicker(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showCatPicker]);
  const save = () => { if (editText.trim()) onEdit(columnId, task.id, editText.trim()); setEditing(false); };
  const catColor = getCatColor(categories, task.category);

  return (
    <div draggable={!editing}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: task.id, from: columnId })); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: isMobile ? 10 : 8, padding: isMobile ? "8px 12px" : "3px 10px",
        borderLeft: `4px solid ${catColor}`,
        background: hover ? "var(--bg-hover)" : `${catColor}18`,
        cursor: editing ? "text" : "grab",
        opacity: task.done ? 0.45 : 1, transition: "opacity 0.2s, background 0.15s",
        fontSize: isMobile ? 16 : 13, lineHeight: 1.4, userSelect: "none", position: "relative",
      }}>
      <input type="checkbox" checked={task.done} onChange={() => onToggle(columnId, task.id)}
        style={{ cursor: "pointer", accentColor: "#5a5a5a", flexShrink: 0, width: isMobile ? 20 : 15, height: isMobile ? 20 : 15 }} />
      {editing ? (
        <input ref={inputRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          style={{ flex: 1, border: "none", background: "transparent", font: "inherit", outline: "none", padding: 0, fontSize: 13 }} />
      ) : (
        <span onDoubleClick={() => { setEditing(true); setEditText(task.text); }}
          style={{ flex: 1, textDecoration: task.done ? "line-through" : "none", cursor: "pointer", color: task.done ? "var(--text-muted)" : "var(--text)" }}>{task.text}</span>
      )}
      {(hover || showCatPicker) && !editing && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => setShowCatPicker(!showCatPicker)} title="Change category"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1, color: "var(--text-muted)" }}>{"\u{1F3A8}"}</button>
          <button onClick={() => onDelete(columnId, task.id)} title="Remove"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#c44", fontSize: 14, padding: 0, lineHeight: 1, fontWeight: 600 }}>&times;</button>
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
    </div>
  );
}

/* ─── Drop Zone ─── */
function DropZone({ onDrop }) {
  const [over, setOver] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={(e) => { e.stopPropagation(); setOver(false); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onDrop(e); }}
      style={{ height: over ? 3 : 0, margin: "0", background: over ? "#8B6914" : "transparent", transition: "all 0.1s" }} />
  );
}

/* ─── Day Section ─── */
function DaySection({ dayInfo, columnId, tasks, categories, onDragStart, onDrop, onToggle, onDelete, onEdit, onAdd, onChangeCategory, isMobile }) {
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
        padding: isMobile ? "10px 10px 4px" : "8px 10px 4px", display: "flex", alignItems: "baseline", gap: 8,
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
            <TaskCard task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} isMobile={isMobile} />
          </div>
        ))}
        <DropZone onDrop={(e) => handleDropAtIndex(e, null)} />
        {doneTasks.length > 0 && doneTasks.map((task) => (
          <TaskCard key={task.id} task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} isMobile={isMobile} />
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
function DayColumn({ dayInfo, columnId, tasks, categories, onDragStart, onDrop, onToggle, onDelete, onEdit, onAdd, onChangeCategory }) {
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

  return (
    <div onDragOver={(e) => { e.preventDefault(); }}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); }}
      onDragLeave={(e) => { dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); } }}
      onDrop={handleDropEnd}
      style={{
        flex: isLater ? "0 0 100%" : "1 1 0%", minWidth: isLater ? "auto" : 0,
        background: dragOver ? "rgba(139,105,20,0.04)" : isToday ? "rgba(180,140,80,0.06)" : "transparent",
        borderRadius: 8, padding: "6px 4px", transition: "background 0.2s", display: "flex", flexDirection: "column",
        border: isToday ? "1.5px solid rgba(180,140,80,0.25)" : dragOver ? "1.5px dashed rgba(139,105,20,0.3)" : "1.5px solid transparent",
        overflow: "hidden",
      }}>
      <div style={{ flexShrink: 0, marginBottom: 4, padding: "0 2px" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "clamp(9px, 1.1vw, 12px)", color: isToday ? "#8B6914" : "#555", letterSpacing: 0.5 }}>
          {isLater ? "LATER" : dayInfo?.label}
        </div>
        {!isLater && <div style={{ fontSize: "clamp(8px, 0.9vw, 10px)", color: "var(--text-muted)", fontWeight: 400 }}>{dayInfo?.date}</div>}
        {isToday && <span style={{ fontSize: 7, background: "#8B6914", color: "#fff", padding: "1px 3px", borderRadius: 2, fontWeight: 600 }}>TODAY</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {incompleteTasks.map((task, idx) => (
          <div key={task.id}>
            <DropZone onDrop={(e) => handleDropAtIndex(e, task.id)} />
            <TaskCard task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} />
          </div>
        ))}
        <DropZone onDrop={(e) => handleDropAtIndex(e, null)} />
        {doneTasks.length > 0 && (
          <>
            <div style={{ borderTop: "1px dashed var(--border)", margin: "4px 4px 2px", fontSize: 8, color: "var(--text-faint)", textAlign: "center", position: "relative" }}>
              <span style={{ background: isToday ? "rgba(180,140,80,0.06)" : "var(--bg)", padding: "0 3px", position: "relative", top: -5 }}>done</span>
            </div>
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} columnId={columnId} categories={categories} onDragStart={onDragStart} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onChangeCategory={onChangeCategory} />
            ))}
          </>
        )}
      </div>
      {adding ? (
        <div style={{ marginTop: 2, flexShrink: 0 }}>
          <input ref={addRef} value={newText} onChange={isLater ? (e) => setNewText(e.target.value) : handleTextChange}
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Task..." style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", fontSize: 11, outline: "none", background: "var(--input-bg)", boxSizing: "border-box", marginBottom: 2 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {!isLater && <CategoryDot categories={categories} selected={newCat} onSelect={handleManualCat} />}
            <button onClick={submitAdd} style={{ background: "#555", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 9 }}>Add</button>
            <button onClick={() => { setAdding(false); setCatManuallySet(false); }} style={{ background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: "3px 6px", cursor: "pointer", fontSize: 9 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, padding: "3px 0", cursor: "pointer", color: "var(--text-muted)", fontSize: "clamp(9px, 1vw, 11px)", marginTop: 2, width: "100%", flexShrink: 0 }}
          onMouseEnter={(e) => { e.target.style.borderColor = "#999"; e.target.style.color = "#777"; }}
          onMouseLeave={(e) => { e.target.style.borderColor = "#ccc"; e.target.style.color = "#aaa"; }}>+ Add</button>
      )}
    </div>
  );
}

/* ─── Future Sidebar ─── */
function FutureSidebar({ futureTasks, onAddFuture, onDeleteFuture }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);
  const [newText, setNewText] = useState("");
  const [newDate, setNewDate] = useState("");
  const addRef = useRef(null);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);
  const grouped = {};
  futureTasks.forEach((t) => { if (!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });
  const sortedDates = Object.keys(grouped).sort();
  const submitAdd = () => { if (newText.trim() && newDate) { onAddFuture(newText.trim(), newDate); setNewText(""); setNewDate(""); } setAdding(false); };
  const count = futureTasks.length;

  return (
    <div style={{ width: open ? 190 : 36, minWidth: open ? 190 : 36, background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s ease, min-width 0.2s ease" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: "var(--text-muted)" }}>
        <span style={{ fontSize: 12 }}>{open ? "\u25B6" : "\u25C0"}</span>
        {!open && (<><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 7, letterSpacing: 1, textTransform: "uppercase", writingMode: "vertical-lr" }}>Upcoming</span>{count > 0 && <span style={{ fontSize: 9, fontWeight: 600, background: "var(--border)", borderRadius: 8, padding: "1px 4px", marginTop: 4 }}>{count}</span>}</>)}
        {open && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Upcoming</span>}
      </button>
      {open && (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
            {sortedDates.map((date) => {
              const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              return (<div key={date} style={{ marginBottom: 8 }}><div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                {grouped[date].map((task) => (<div key={task.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: task.id, from: "future", futureText: task.text })); }}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", marginBottom: 2, fontSize: 10, cursor: "grab", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                  <span style={{ flex: 1, wordBreak: "break-word" }}>{task.text}</span>
                  <button onClick={() => onDeleteFuture(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 11, padding: 0, marginLeft: 3, fontWeight: 600, lineHeight: 1 }} onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "#bbb")}>&times;</button>
                </div>))}</div>);
            })}
            {sortedDates.length === 0 && <div style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "center", marginTop: 16 }}>No upcoming</div>}
          </div>
          {adding ? (
            <div style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
              <input ref={addRef} value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Task..." style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", fontSize: 10, outline: "none", marginBottom: 2, background: "var(--bg-card)", boxSizing: "border-box" }} />
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", fontSize: 10, outline: "none", marginBottom: 2, background: "var(--bg-card)", boxSizing: "border-box" }} />
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
export default function Planner({ data, onSave, onSaveFuture, onSaveNotebooks, onSaveJournal, onSaveContacts, onSaveArchive, onSaveDailyHabits, onSaveWeeklyHabits, onSaveSettings, onLogout, userEmail, userId }) {
  const isMobile = useIsMobile();
  const weekDates = getWeekDates();
  const { tasks, futureTasks, dailyHabits, weeklyHabits, notes } = data;
  const [activeView, setActiveView] = useState("planner");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [laterHeight, setLaterHeight] = useState(50);
  const [notesHeight, setNotesHeight] = useState(70);
  const notebooks = data.notebooks || [];
  const journal = data.journal || {};
  const contacts = data.contacts || [];
  const archive = data.archive || [];
  const categories = data.categories || [];
  const layout = data.layout || "vertical";
  const darkMode = data.darkMode || false;

  // Inject CSS variables for theming
  useEffect(() => {
    const r = document.documentElement.style;
    if (darkMode) {
      r.setProperty("--bg", "#1a1a1e");
      r.setProperty("--bg-surface", "#222226");
      r.setProperty("--bg-card", "#2a2a2e");
      r.setProperty("--bg-hover", "#333338");
      r.setProperty("--text", "#e0e0e0");
      r.setProperty("--text-muted", "#888");
      r.setProperty("--text-faint", "#555");
      r.setProperty("--border", "#3a3a3e");
      r.setProperty("--border-light", "#2e2e32");
      r.setProperty("--input-bg", "#2a2a2e");
      r.setProperty("--accent", "#c9a227");
      r.setProperty("--done-bg", "#fdfcf8");
    } else {
      r.setProperty("--bg", "#fdfcf8");
      r.setProperty("--bg-surface", "#f2f1ed");
      r.setProperty("--bg-card", "#fff");
      r.setProperty("--bg-hover", "var(--bg-hover)");
      r.setProperty("--text", "#333");
      r.setProperty("--text-muted", "#999");
      r.setProperty("--text-faint", "#bbb");
      r.setProperty("--border", "var(--border)");
      r.setProperty("--border-light", "var(--border-light)");
      r.setProperty("--input-bg", "#fafaf7");
      r.setProperty("--accent", "#8B6914");
      r.setProperty("--done-bg", "#fdfcf8");
    }
  }, [darkMode]);

  const update = (changes) => onSave({ ...data, ...changes });

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
    onSave({ ...data, tasks: newTasks, futureTasks: remainingFuture });
    onSaveFuture(remainingFuture);
  }, []); // Run once on load

  const handleDrop = useCallback((fromCol, toCol, taskId, beforeTaskId) => {
    if (fromCol === "future") {
      const task = futureTasks.find((t) => t.id === taskId);
      if (!task) return;
      const newTasks = { ...tasks };
      const detectedCat = autoDetectCategory(task.text, categories);
      const newTask = makeTask(task.text, { category: detectedCat });
      if (beforeTaskId) { const idx = newTasks[toCol].findIndex((t) => t.id === beforeTaskId); newTasks[toCol] = [...newTasks[toCol]]; newTasks[toCol].splice(idx, 0, newTask); }
      else { newTasks[toCol] = [...newTasks[toCol], newTask]; }
      const newFuture = futureTasks.filter((t) => t.id !== taskId);
      onSave({ ...data, tasks: newTasks, futureTasks: newFuture });
      onSaveFuture(newFuture);
      return;
    }
    const newTasks = { ...tasks };
    const fromList = [...newTasks[fromCol]];
    const taskIdx = fromList.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) return;
    const [task] = fromList.splice(taskIdx, 1);
    // Auto-detect category if task has none or is "Other"
    if (!task.category || task.category === "cat_none") {
      task.category = autoDetectCategory(task.text, categories);
    }
    newTasks[fromCol] = fromList;
    if (beforeTaskId) { const toList = [...newTasks[toCol]]; const insertIdx = toList.findIndex((t) => t.id === beforeTaskId); toList.splice(insertIdx, 0, task); newTasks[toCol] = toList; }
    else { newTasks[toCol] = [...newTasks[toCol], task]; }
    update({ tasks: newTasks });
  }, [data, tasks, futureTasks, categories]);

  const toggleDone = useCallback((col, id) => {
    const task = tasks[col].find((t) => t.id === id);
    if (!task) return;
    const nowDone = !task.done;
    const newTasks = { ...tasks, [col]: tasks[col].map((t) => (t.id === id ? { ...t, done: nowDone } : t)) };
    if (nowDone) {
      const dayMap = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
      const dayIdx = dayMap[col];
      const dateStr = dayIdx !== undefined ? getWeekDates()[dayIdx]?.fullDate : null;
      const entry = { id: "a" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), text: task.text, category: task.category, completedAt: new Date().toISOString(), assignedDay: col, assignedDate: dateStr || "later" };
      const newArchive = [entry, ...archive].slice(0, 500);
      update({ tasks: newTasks, archive: newArchive }); onSaveArchive(newArchive);
    } else {
      const newArchive = [...archive]; const idx = newArchive.findIndex((a) => a.text === task.text && a.assignedDay === col);
      if (idx !== -1) newArchive.splice(idx, 1);
      update({ tasks: newTasks, archive: newArchive }); onSaveArchive(newArchive);
    }
  }, [data, tasks, archive]);

  const deleteTask = useCallback((col, id) => { update({ tasks: { ...tasks, [col]: tasks[col].filter((t) => t.id !== id) } }); }, [data, tasks]);
  const editTask = useCallback((col, id, text) => { update({ tasks: { ...tasks, [col]: tasks[col].map((t) => (t.id === id ? { ...t, text } : t)) } }); }, [data, tasks]);
  const addTask = useCallback((col, text, catId) => { update({ tasks: { ...tasks, [col]: [...tasks[col], makeTask(text, { category: catId || "cat_none" })] } }); }, [data, tasks]);
  const changeCategory = useCallback((col, id, catId) => { update({ tasks: { ...tasks, [col]: tasks[col].map((t) => (t.id === id ? { ...t, category: catId } : t)) } }); }, [data, tasks]);
  const toggleDaily = (hid, day) => { const updated = dailyHabits.map((h) => h.id === hid ? { ...h, checks: { ...h.checks, [day]: !h.checks[day] } } : h); update({ dailyHabits: updated }); onSaveDailyHabits(updated); };
  const toggleWeekly = (hid) => { const updated = weeklyHabits.map((h) => h.id === hid ? { ...h, done: !h.done } : h); update({ weeklyHabits: updated }); onSaveWeeklyHabits(updated); };
  const addDailyHabit = (name) => { const updated = [...dailyHabits, { id: "dh" + Date.now(), name, checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } }]; update({ dailyHabits: updated }); onSaveDailyHabits(updated); };
  const addWeeklyHabit = (name) => { const updated = [...weeklyHabits, { id: "wh" + Date.now(), name, done: false }]; update({ weeklyHabits: updated }); onSaveWeeklyHabits(updated); };
  const deleteDaily = (id) => { const updated = dailyHabits.filter((h) => h.id !== id); update({ dailyHabits: updated }); onSaveDailyHabits(updated); };
  const deleteWeekly = (id) => { const updated = weeklyHabits.filter((h) => h.id !== id); update({ weeklyHabits: updated }); onSaveWeeklyHabits(updated); };
  const addFuture = (text, date) => { const nf = [...futureTasks, { id: "f" + Date.now(), text, date }]; update({ futureTasks: nf }); onSaveFuture(nf); };
  const deleteFuture = (id) => { const nf = futureTasks.filter((t) => t.id !== id); update({ futureTasks: nf }); onSaveFuture(nf); };
  const updateNotebooks = (nbs) => { update({ notebooks: nbs }); onSaveNotebooks(nbs); };
  const updateJournal = (j) => { update({ journal: j }); onSaveJournal(j); };
  const updateContacts = (c) => { update({ contacts: c }); onSaveContacts(c); };
  const updateCategories = (cats) => { update({ categories: cats }); onSaveSettings({ categories: cats, layout, notes, darkMode }); };

  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase(); const results = [];
    Object.entries(tasks).forEach(([col, list]) => { list.forEach((t) => { if (t.text.toLowerCase().includes(q)) results.push({ type: "Task", section: col.toUpperCase(), text: t.text }); }); });
    archive.forEach((a) => { if (a.text.toLowerCase().includes(q)) results.push({ type: "Completed", section: a.assignedDate || "later", text: a.text }); });
    futureTasks.forEach((t) => { if (t.text.toLowerCase().includes(q)) results.push({ type: "Upcoming", section: t.date, text: t.text }); });
    notebooks.forEach((nb) => { const p = nb.content?.replace(/<[^>]*>/g, "") || ""; if (nb.title.toLowerCase().includes(q) || p.toLowerCase().includes(q)) results.push({ type: "Notebook", section: nb.title, text: p.slice(0, 100) }); });
    Object.entries(journal).forEach(([date, html]) => { const p = html?.replace(/<[^>]*>/g, "") || ""; if (p.toLowerCase().includes(q)) results.push({ type: "Journal", section: date, text: p.slice(0, 100) }); });
    contacts.forEach((c) => { const b = [c.name, c.likes, c.dislikes, c.notes, c.relationship, c.birthday].join(" ").toLowerCase(); if (b.includes(q)) results.push({ type: "Person", section: c.relationship || "", text: c.name }); });
    if (notes?.toLowerCase().includes(q)) results.push({ type: "Quick Notes", section: "", text: notes.slice(0, 100) });
    dailyHabits.forEach((h) => { if (h.name.toLowerCase().includes(q)) results.push({ type: "Daily Habit", section: "", text: h.name }); });
    weeklyHabits.forEach((h) => { if (h.name.toLowerCase().includes(q)) results.push({ type: "Weekly Habit", section: "", text: h.name }); });
    return results;
  };

  const navItems = [
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
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "var(--bg)", color: "var(--text)" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />

      {/* Desktop: left sidebar nav */}
      {!isMobile && (
        <div style={{ width: 56, minWidth: 56, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 2 }}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveView(item.id)} title={item.label}
              style={{ width: 42, height: 42, borderRadius: 8, border: "none", cursor: "pointer", background: activeView === item.id ? "var(--border)" : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 16, color: activeView === item.id ? "var(--text)" : "var(--text-muted)", transition: "all 0.15s", gap: 1 }}>
              <span>{item.icon}</span><span style={{ fontSize: 7, fontWeight: 600, letterSpacing: 0.3 }}>{item.label}</span>
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
                {results.map((r, i) => (<div key={i} style={{ padding: "4px 8px", marginBottom: 2, borderRadius: 4, background: "var(--bg-card)", fontSize: isMobile ? 14 : 11 }}>
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
            {!isMobile && (
              <HabitsTracker dailyHabits={dailyHabits} weeklyHabits={weeklyHabits} onToggleDaily={toggleDaily} onToggleWeekly={toggleWeekly}
                onAddDaily={addDailyHabit} onAddWeekly={addWeeklyHabit} onDeleteDaily={deleteDaily} onDeleteWeekly={deleteWeekly} />
            )}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {(isMobile || layout === "vertical") ? (
                  <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "4px 4px" : "4px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
                    {DAYS.map((day, i) => (
                      <DaySection key={day} dayInfo={weekDates[i]} columnId={day.toLowerCase()} tasks={tasks[day.toLowerCase()]} categories={categories}
                        onDragStart={() => {}} onDrop={handleDrop} onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} isMobile={isMobile} />
                    ))}
                    {/* On mobile, show Later inline at the bottom of the scroll instead of a separate resize section */}
                    {isMobile && (
                      <DaySection dayInfo={null} columnId="later" tasks={tasks.later} categories={categories} onDragStart={() => {}} onDrop={handleDrop}
                        onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} isMobile={isMobile} />
                    )}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", gap: 2, padding: "8px 6px", overflow: "hidden" }}>
                    {DAYS.map((day, i) => (
                      <DayColumn key={day} dayInfo={weekDates[i]} columnId={day.toLowerCase()} tasks={tasks[day.toLowerCase()]} categories={categories}
                        onDragStart={() => {}} onDrop={handleDrop} onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} />
                    ))}
                  </div>
                )}
                {!isMobile && (
                  <>
                    <ResizeHandle currentHeight={laterHeight} minHeight={36} maxHeight={400} onHeightChange={setLaterHeight} />
                    <div style={{ height: laterHeight, flexShrink: 0, padding: "4px 8px", overflowY: "auto", background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
                      {layout === "vertical" ? (
                        <DaySection dayInfo={null} columnId="later" tasks={tasks.later} categories={categories} onDragStart={() => {}} onDrop={handleDrop}
                          onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} />
                      ) : (
                        <DayColumn dayInfo={null} columnId="later" tasks={tasks.later} categories={categories} onDragStart={() => {}} onDrop={handleDrop}
                          onToggle={toggleDone} onDelete={deleteTask} onEdit={editTask} onAdd={addTask} onChangeCategory={changeCategory} />
                      )}
                    </div>
                    <ResizeHandle currentHeight={notesHeight} minHeight={36} maxHeight={300} onHeightChange={setNotesHeight} />
                    <div style={{ height: notesHeight, flexShrink: 0, background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                      <NotesSection notes={notes} onChange={(val) => { update({ notes: val }); onSaveSettings({ categories, layout, notes: val, darkMode }); }} />
                    </div>
                  </>
                )}
              </div>
              {!isMobile && <FutureSidebar futureTasks={futureTasks} onAddFuture={addFuture} onDeleteFuture={deleteFuture} />}
            </div>
          </div>
        )}

        {activeView === "notebooks" && <NotebooksPanel notebooks={notebooks} onChange={updateNotebooks} userId={userId} />}
        {activeView === "journal" && <JournalPanel journal={journal} onChange={updateJournal} userId={userId} />}
        {activeView === "contacts" && <ContactsPanel contacts={contacts} onChange={updateContacts} />}
        {activeView === "categories" && <CategoryManager categories={categories} onChange={updateCategories} layout={layout} onLayoutChange={(l) => { update({ layout: l }); onSaveSettings({ categories, layout: l, notes, darkMode }); }} darkMode={darkMode} onDarkModeChange={(dm) => { update({ darkMode: dm }); onSaveSettings({ categories, layout, notes, darkMode: dm }); }} />}

        {activeView === "archive" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Completed Tasks</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", maxWidth: 600 }}>
              {archive.length === 0 && <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 20 }}>No completed tasks yet</div>}
              {archive.map((entry) => {
                const dateObj = entry.assignedDate && entry.assignedDate !== "later" ? new Date(entry.assignedDate + "T12:00:00") : null;
                const dateLabel = dateObj ? dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Later";
                const completedLabel = new Date(entry.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const catColor = getCatColor(categories, entry.category);
                return (
                  <div key={entry.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 8px", marginBottom: 4, fontSize: isMobile ? 14 : 11, borderLeft: `3px solid ${catColor}` }}>
                    <div style={{ color: "var(--text)", fontWeight: 500 }}>{entry.text}</div>
                    <div style={{ fontSize: isMobile ? 11 : 9, color: "var(--text-muted)", marginTop: 3 }}>
                      {entry.category && <span style={{ background: catColor, padding: "1px 4px", borderRadius: 2, marginRight: 4, color: "var(--text)", fontSize: 8 }}>{getCatName(categories, entry.category)}</span>}
                      Assigned: {dateLabel} &middot; Done: {completedLabel}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "6px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-faint)" }}>{archive.length} completed {archive.length === 1 ? "task" : "tasks"}</div>
          </div>
        )}

        {/* Mobile: habits as a separate tab-like section when on planner view */}
        {isMobile && activeView === "planner" && (
          <div style={{ borderTop: "1px solid var(--border)", maxHeight: 120, overflowY: "auto", padding: "6px 8px" }}>
            <NotesSection notes={notes} onChange={(val) => { update({ notes: val }); onSaveSettings({ categories, layout, notes: val, darkMode }); }} />
          </div>
        )}
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
  );
}
