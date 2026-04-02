import { useState, useRef, useEffect } from "react";
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function MiniCalendar({ selectedDate, onSelect, entryDates }) {
  const [viewYear, setViewYear] = useState(new Date(selectedDate).getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate).getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1);
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const cells = [];
  for (let i = 1; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: "2px 6px" }}>{"\u25C0"}</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: "2px 6px" }}>{"\u25B6"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 2 }}>
        {DAY_LABELS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 600, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const hasEntry = entryDates.has(dateStr);
          return (
            <div key={dateStr} onClick={() => onSelect(dateStr)} style={{
              textAlign: "center", fontSize: 11, padding: "3px 0", cursor: "pointer", borderRadius: 4, position: "relative",
              background: isSelected ? "#8B6914" : isToday ? "rgba(139,105,20,0.1)" : "transparent",
              color: isSelected ? "#fff" : isToday ? "#8B6914" : "#555",
              fontWeight: isSelected || isToday ? 600 : 400, transition: "all 0.1s",
            }}>
              {day}
              {hasEntry && (
                <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: isSelected ? "#fff" : "#6a9955" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JournalEditor({ content, onChange, userId }) {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== content) editorRef.current.innerHTML = content || "";
    }
    isInternalChange.current = false;
  }, [content]);

  const handleInput = () => { isInternalChange.current = true; onChange(editorRef.current.innerHTML); };
  const exec = (cmd, val = null) => { editorRef.current.focus(); document.execCommand(cmd, false, val); handleInput(); };

  const compressToBlob = (file, maxWidth = 1200, quality = 0.8) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadToStorage = async (file) => {
    const blob = await compressToBlob(file);
    const filename = `${userId}/journal/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    return getDownloadURL(storageRef);
  };

  const insertImageFromFile = async (file) => {
    const pid = "jimg-" + Date.now();
    document.execCommand("insertHTML", false, `<span id="${pid}" style="display:inline-block;background:var(--border-light);border-radius:4px;padding:6px 10px;margin:4px 0;font-size:11px;color:#999;">Uploading...</span>`);
    handleInput();
    try {
      const url = await uploadToStorage(file);
      const el = editorRef.current.querySelector(`#${pid}`);
      if (el) { const img = document.createElement("img"); img.src = url; img.style.cssText = "max-width:100%;border-radius:4px;margin:4px 0;"; el.replaceWith(img); handleInput(); }
    } catch (err) {
      console.error("Upload failed:", err);
      const el = editorRef.current.querySelector(`#${pid}`);
      if (el) { el.textContent = "Upload failed"; el.style.color = "#c44"; handleInput(); }
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) { e.preventDefault(); const file = item.getAsFile(); if (file) await insertImageFromFile(file); return; }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 2, padding: "4px 6px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", alignItems: "center", background: "var(--input-bg)" }}>
        <button onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, color: "var(--text)", width: 24, height: 24, borderRadius: 3 }}>B</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} style={{ background: "none", border: "none", cursor: "pointer", fontStyle: "italic", fontSize: 13, color: "var(--text)", width: 24, height: 24, borderRadius: 3 }}>I</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 13, color: "var(--text)", width: 24, height: 24, borderRadius: 3 }}>U</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--text)", width: 24, height: 24, borderRadius: 3 }}>{"\u2022"} {"\u2013"}</button>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        [contenteditable] a { color: #5b8fb9 !important; text-decoration: underline; cursor: pointer; }
        [contenteditable] p { margin: 4px 0 8px; }
        [contenteditable] h2 { font-size: 18px; font-weight: 700; margin: 14px 0 8px; color: var(--text); }
        [contenteditable] hr { border: none; border-top: 1px solid var(--text-faint); margin: 14px 0; }
      `}} />
      <div ref={editorRef} contentEditable onInput={handleInput} onBlur={handleInput} onPaste={handlePaste}
        onClick={(e) => { if (e.target.tagName === "A" && e.target.href) { e.preventDefault(); window.open(e.target.href, "_blank"); } }}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const sel = window.getSelection();
            const node = sel?.anchorNode;
            const li = node?.closest ? node.closest("li") : node?.parentElement?.closest("li");
            if (li) {
              document.execCommand(e.shiftKey ? "outdent" : "indent");
            } else {
              document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
            }
            handleInput();
          }
        }}
        suppressContentEditableWarning
        style={{ flex: 1, overflowY: "auto", padding: "14px 24px 14px 48px", fontSize: 13, lineHeight: 1.7, outline: "none", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }} />
    </div>
  );
}

export default function JournalPanel({ journal, onChange, userId, isMobile }) {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(() => {
    try { const d = localStorage.getItem("planner_journalNav"); if (d) { localStorage.removeItem("planner_journalNav"); return d; } } catch {}
    return today;
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileEditing, setMobileEditing] = useState(false);

  if (!journal) return null;

  const entries = journal || {};
  const entryDates = new Set(Object.keys(entries).filter((k) => entries[k] && entries[k].trim() !== "" && entries[k] !== "<p></p>" && entries[k] !== "<br>"));
  const currentContent = entries[selectedDate] || "";
  const updateEntry = (html) => { onChange({ ...entries, [selectedDate]: html }); };

  const selectedDateObj = new Date(selectedDate + "T12:00:00");
  const dateLabel = selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const selectDate = (date) => { setSelectedDate(date); if (isMobile) setMobileEditing(true); };

  // Mobile: calendar first, then editor with back button
  if (isMobile) {
    if (mobileEditing) {
      return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setMobileEditing(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 14, fontWeight: 600, padding: 0 }}>{"\u25C0"} Calendar</button>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)", textAlign: "center" }}>{dateLabel}</span>
            {selectedDate === today && (
              <span style={{ fontSize: 9, background: "#8B6914", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>TODAY</span>
            )}
          </div>
          <JournalEditor key={selectedDate} content={currentContent} onChange={updateEntry} userId={userId} />
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Journal</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          <MiniCalendar selectedDate={selectedDate} onSelect={selectDate} entryDates={entryDates} />
          <div style={{ padding: "10px 0", fontSize: 13, color: "var(--text-faint)" }}>
            {entryDates.size} journal {entryDates.size === 1 ? "entry" : "entries"}
          </div>
          <div style={{ marginTop: 4 }}>
            <button onClick={() => { setSelectedDate(today); setMobileEditing(true); }}
              style={{ width: "100%", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              Write Today's Entry
            </button>
            {[...entryDates].sort().reverse().map((date) => {
              const d = new Date(date + "T12:00:00");
              const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
              return (
                <div key={date} onClick={() => selectDate(date)}
                  style={{ padding: "10px 12px", cursor: "pointer", fontSize: 15, borderBottom: "1px solid var(--border-light)", color: "var(--text)" }}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const [viewMode, setViewMode] = useState("editor"); // "editor" or "feed"
  const [feedEditingDate, setFeedEditingDate] = useState(null);

  const sortedDates = [...entryDates].sort().reverse();

  const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const formatFeedDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    const weekday = WEEKDAYS[d.getDay()];
    const month = MONTH_NAMES[d.getMonth()];
    const day = d.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
    return { weekday, full: `${weekday}, ${month} ${day}${suffix}`, monthShort: month.slice(0, 3).toUpperCase(), day };
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Left: collapsible calendar + entry list */}
      <div style={{ width: sidebarOpen ? 220 : 32, minWidth: sidebarOpen ? 220 : 32, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s, min-width 0.2s" }}>
        <div style={{ padding: sidebarOpen ? "10px 10px 6px" : "10px 4px 6px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Hide calendar" : "Show calendar"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: 0, lineHeight: 1 }}>
            {sidebarOpen ? "\u25C0" : "\u25B6"}
          </button>
          {sidebarOpen && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Calendar</span>}
        </div>
        {sidebarOpen && (
          <>
            <div style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>
              <MiniCalendar selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d); setViewMode("editor"); }} entryDates={entryDates} />
            </div>
            <div style={{ padding: "6px 10px", fontSize: 10, color: "var(--text-faint)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{entryDates.size} {entryDates.size === 1 ? "entry" : "entries"}</span>
              <button onClick={() => setViewMode(viewMode === "feed" ? "editor" : "feed")}
                title={viewMode === "feed" ? "Editor view" : "Feed view"}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer", color: viewMode === "feed" ? "var(--accent)" : "var(--text-faint)", fontSize: 9, padding: "1px 5px", fontWeight: 600 }}>
                {viewMode === "feed" ? "\u{1F4DD}" : "\u{1F4DC}"}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {sortedDates.map((date) => {
                const d = new Date(date + "T12:00:00");
                const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                return (
                  <div key={date} onClick={() => { setSelectedDate(date); if (viewMode === "feed") setViewMode("editor"); }} style={{
                    padding: "6px 10px", cursor: "pointer", fontSize: 11,
                    background: date === selectedDate && viewMode === "editor" ? "var(--bg-card)" : "transparent",
                    color: date === selectedDate && viewMode === "editor" ? "var(--text)" : "var(--text-muted)",
                    fontWeight: date === selectedDate && viewMode === "editor" ? 600 : 400,
                    borderLeft: date === selectedDate && viewMode === "editor" ? "3px solid #8B6914" : "3px solid transparent",
                  }}>{label}</div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Right: editor OR feed view */}
      {viewMode === "editor" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
            {dateLabel}
            {selectedDate === today && (
              <span style={{ fontSize: 8, background: "#8B6914", color: "#fff", padding: "1px 4px", borderRadius: 3, fontWeight: 600, letterSpacing: 0.5 }}>TODAY</span>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={() => setViewMode("feed")} title="Switch to feed view"
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)", fontSize: 9, padding: "3px 8px", fontWeight: 600 }}>
              {"\u{1F4DC}"} Feed
            </button>
          </div>
          <JournalEditor key={selectedDate} content={currentContent} onChange={updateEntry} userId={userId} />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Journal Feed</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setViewMode("editor")} title="Switch to editor view"
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)", fontSize: 9, padding: "3px 8px", fontWeight: 600 }}>
              {"\u{1F4DD}"} Editor
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
            {/* Today's entry or prompt */}
            {!entryDates.has(today) && (
              <div onClick={() => { setSelectedDate(today); setViewMode("editor"); }}
                style={{ maxWidth: 600, margin: "0 auto 20px", padding: "16px 20px", background: "var(--bg-card)", border: "1.5px dashed var(--border)", borderRadius: 10, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>What's on your mind today?</div>
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}>Click to write today's entry</div>
              </div>
            )}
            {sortedDates.map((date) => {
              const { monthShort, day, full } = formatFeedDate(date);
              const html = entries[date];
              const isEditing = feedEditingDate === date;
              return (
                <div key={date} style={{ maxWidth: 600, margin: "0 auto 20px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  {/* Card header */}
                  <div style={{ padding: "10px 16px 8px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-light)" }}>
                    {/* Date badge */}
                    <div style={{ textAlign: "center", minWidth: 36 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{monthShort}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{day}</div>
                    </div>
                    {/* Full date label */}
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text)", fontStyle: "italic" }}>{full}</div>
                    {/* Edit button */}
                    <button onClick={() => { if (isEditing) { setFeedEditingDate(null); } else { setSelectedDate(date); setViewMode("editor"); } }}
                      title="Edit entry"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-faint)", padding: "2px 4px" }}>
                      {"\u270F"}
                    </button>
                    {date === today && (
                      <span style={{ fontSize: 7, background: "#8B6914", color: "#fff", padding: "1px 4px", borderRadius: 3, fontWeight: 700, letterSpacing: 0.5 }}>TODAY</span>
                    )}
                  </div>
                  {/* Card body: rendered HTML */}
                  <div
                    dangerouslySetInnerHTML={{ __html: html }}
                    style={{ padding: "12px 20px 16px", fontSize: 13, lineHeight: 1.7, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}
                  />
                </div>
              );
            })}
            {sortedDates.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text-faint)", fontSize: 13, marginTop: 40 }}>
                No journal entries yet. Click "What's on your mind?" to start writing.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
