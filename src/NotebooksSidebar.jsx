import { useState, useRef, useEffect } from "react";
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const HIGHLIGHT_COLORS = [
  { label: "Yellow", color: "#fff3a8" },
  { label: "Green", color: "#c8f7c5" },
  { label: "Blue", color: "#c5e0f7" },
  { label: "Pink", color: "#f7c5d5" },
  { label: "Orange", color: "#f7dfc5" },
  { label: "None", color: "transparent" },
];

const TEXT_COLORS = [
  { label: "Default", color: "#333333" },
  { label: "Red", color: "#c44040" },
  { label: "Blue", color: "#2e6da4" },
  { label: "Green", color: "#4a8c5c" },
  { label: "Purple", color: "#7b5ea7" },
  { label: "Orange", color: "#c47a20" },
  { label: "Gray", color: "#888888" },
];

function ToolbarButton({ icon, title, onClick, active, style: extraStyle }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: active ? "var(--border)" : hover ? "var(--border-light)" : "none",
        border: "none", borderRadius: 3, cursor: "pointer",
        width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: "var(--text)", fontWeight: active ? 700 : 400,
        transition: "all 0.1s", ...extraStyle,
      }}
    >
      {icon}
    </button>
  );
}

function ColorPicker({ colors, onSelect, buttonIcon, title }) {
  const [open, setOpen] = useState(false);
  const ref2 = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref2.current && !ref2.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref2} style={{ position: "relative" }}>
      <ToolbarButton icon={buttonIcon} title={title} onClick={() => setOpen(!open)} active={open} />
      {open && (
        <div style={{
          position: "absolute", top: 30, left: 0, background: "var(--bg-card)",
          border: "1px solid var(--border)", borderRadius: 6, padding: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100,
          display: "flex", gap: 4, flexWrap: "wrap", width: 120,
        }}>
          {colors.map((c) => (
            <div
              key={c.color}
              onMouseDown={(e) => { e.preventDefault(); onSelect(c.color); setOpen(false); }}
              title={c.label}
              style={{
                width: 22, height: 22, borderRadius: 4, cursor: "pointer",
                background: c.color === "transparent" ? "#fff" : c.color,
                border: c.color === "transparent" ? "1.5px dashed #ccc" : "1.5px solid rgba(0,0,0,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: "var(--text-muted)",
              }}
            >
              {c.color === "transparent" && "\u2715"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RichEditor({ content, onChange, userId }) {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || "";
      }
    }
    isInternalChange.current = false;
  }, [content]);

  const handleInput = () => {
    isInternalChange.current = true;
    onChange(editorRef.current.innerHTML);
  };

  const exec = (cmd, val = null) => {
    editorRef.current.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const insertTable = () => {
    const tid = "t" + Date.now();
    const table = `<table data-tid="${tid}" style="border-collapse:collapse;margin:8px 0;table-layout:auto;">
      <tr><td style="border:1px solid #999;padding:6px 8px;min-width:60px;">&nbsp;</td><td style="border:1px solid #999;padding:6px 8px;min-width:60px;">&nbsp;</td></tr>
      <tr><td style="border:1px solid #999;padding:6px 8px;min-width:60px;">&nbsp;</td><td style="border:1px solid #999;padding:6px 8px;min-width:60px;">&nbsp;</td></tr>
    </table><p></p>`;
    exec("insertHTML", table);
  };

  const insertHeader = () => {
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const block = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
      const tag = block?.tagName?.toLowerCase();
      if (tag === "h2") {
        document.execCommand("formatBlock", false, "p");
      } else {
        document.execCommand("formatBlock", false, "h2");
      }
      handleInput();
    }
  };

  const insertDivider = () => {
    exec("insertHTML", '<hr style="border:none;border-top:1px solid #999;margin:12px 0;">');
  };

  const addTableRow = () => {
    const sel = window.getSelection();
    const td = sel?.anchorNode?.closest ? sel.anchorNode.closest("td") : sel?.anchorNode?.parentElement?.closest("td");
    const table = td?.closest("table");
    if (!table) return;
    const cols = table.rows[0]?.cells.length || 2;
    const row = table.insertRow(-1);
    for (let i = 0; i < cols; i++) {
      const cell = row.insertCell(-1);
      cell.innerHTML = "&nbsp;";
      cell.style.cssText = "border:1px solid #999;padding:6px 8px;min-width:40px;";
    }
    handleInput();
  };

  const addTableCol = () => {
    const sel = window.getSelection();
    const td = sel?.anchorNode?.closest ? sel.anchorNode.closest("td") : sel?.anchorNode?.parentElement?.closest("td");
    const table = td?.closest("table");
    if (!table) return;
    for (let r = 0; r < table.rows.length; r++) {
      const cell = table.rows[r].insertCell(-1);
      cell.innerHTML = "&nbsp;";
      cell.style.cssText = "border:1px solid #999;padding:6px 8px;min-width:40px;";
    }
    handleInput();
  };

  const removeTableRow = () => {
    const sel = window.getSelection();
    const td = sel?.anchorNode?.closest ? sel.anchorNode.closest("td") : sel?.anchorNode?.parentElement?.closest("td");
    const tr = td?.closest("tr");
    const table = td?.closest("table");
    if (!table || !tr) return;
    if (table.rows.length <= 1) { table.remove(); } else { tr.remove(); }
    handleInput();
  };

  const removeTableCol = () => {
    const sel = window.getSelection();
    const td = sel?.anchorNode?.closest ? sel.anchorNode.closest("td") : sel?.anchorNode?.parentElement?.closest("td");
    const table = td?.closest("table");
    if (!table || !td) return;
    const colIdx = td.cellIndex;
    if (table.rows[0].cells.length <= 1) { table.remove(); } else {
      for (let r = 0; r < table.rows.length; r++) { if (table.rows[r].cells[colIdx]) table.rows[r].deleteCell(colIdx); }
    }
    handleInput();
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) exec("createLink", url);
  };

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
    const filename = `${userId}/images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    return getDownloadURL(storageRef);
  };

  const insertImageFromFile = async (file) => {
    const pid = "img-uploading-" + Date.now();
    document.execCommand("insertHTML", false,
      `<span id="${pid}" style="display:inline-block;background:var(--border-light);border-radius:4px;padding:8px 12px;margin:6px 0;font-size:11px;color:#999;">Uploading image...</span>`);
    handleInput();
    try {
      const url = await uploadToStorage(file);
      const el = editorRef.current.querySelector(`#${pid}`);
      if (el) {
        const img = document.createElement("img");
        img.src = url;
        img.style.cssText = "max-width:100%;border-radius:4px;margin:6px 0;";
        el.replaceWith(img);
        handleInput();
      }
    } catch (err) {
      console.error("Upload failed:", err);
      const el = editorRef.current.querySelector(`#${pid}`);
      if (el) { el.textContent = "Image upload failed"; el.style.color = "#c44"; handleInput(); }
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await insertImageFromFile(file);
        return;
      }
    }
    // Fix pasted tables: add visible borders
    const html = e.clipboardData?.getData("text/html");
    if (html && html.includes("<table")) {
      e.preventDefault();
      const div = document.createElement("div");
      div.innerHTML = html;
      div.querySelectorAll("table").forEach((t) => {
        t.style.borderCollapse = "collapse";
        t.style.margin = "8px 0";
        t.style.tableLayout = "auto";
        t.removeAttribute("width");
        t.style.width = "";
      });
      div.querySelectorAll("td, th").forEach((cell) => {
        cell.style.border = "1px solid #999";
        cell.style.padding = "6px 8px";
        cell.style.minWidth = "40px";
      });
      document.execCommand("insertHTML", false, div.innerHTML);
      handleInput();
    }
  };

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) { editorRef.current.focus(); await insertImageFromFile(file); }
    };
    input.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{
        display: "flex", gap: 2, padding: "4px 6px", borderBottom: "1px solid var(--border)",
        flexWrap: "wrap", alignItems: "center", background: "var(--input-bg)",
      }}>
        <ToolbarButton icon={<b>B</b>} title="Bold" onClick={() => exec("bold")} />
        <ToolbarButton icon={<i>I</i>} title="Italic" onClick={() => exec("italic")} />
        <ToolbarButton icon={<u>U</u>} title="Underline" onClick={() => exec("underline")} />
        <ToolbarButton icon={<s>S</s>} title="Strikethrough" onClick={() => exec("strikeThrough")} />
        <ToolbarButton icon={<span style={{ fontSize: 12, fontWeight: 700 }}>H</span>} title="Toggle heading" onClick={insertHeader} />
        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 3px" }} />
        <ColorPicker colors={HIGHLIGHT_COLORS} onSelect={(c) => exec("hiliteColor", c)}
          buttonIcon={<span style={{ background: "#fff3a8", padding: "0 3px", borderRadius: 2, fontSize: 11, fontWeight: 600 }}>H</span>} title="Highlight" />
        <ColorPicker colors={TEXT_COLORS} onSelect={(c) => exec("foreColor", c)}
          buttonIcon={<span style={{ fontSize: 12, fontWeight: 700 }}>A<span style={{ display: "block", height: 2, background: "#c44040", borderRadius: 1, marginTop: -2 }} /></span>} title="Text color" />
        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 3px" }} />
        <ToolbarButton icon={<span style={{ fontSize: 12 }}>&#128279;</span>} title="Insert link" onClick={insertLink} />
        <ToolbarButton icon={<span style={{ fontSize: 12 }}>&#128444;</span>} title="Insert image" onClick={insertImage} />
        <ToolbarButton icon={<span style={{ fontSize: 10, fontFamily: "monospace" }}>&#9638;</span>} title="Insert table" onClick={insertTable} />
        <ToolbarButton icon={<span style={{ fontSize: 9, fontFamily: "monospace" }}>+R</span>} title="Add row (click in table first)" onClick={addTableRow} />
        <ToolbarButton icon={<span style={{ fontSize: 9, fontFamily: "monospace" }}>+C</span>} title="Add column (click in table first)" onClick={addTableCol} />
        <ToolbarButton icon={<span style={{ fontSize: 9, fontFamily: "monospace", color: "#c44" }}>{"\u2212"}R</span>} title="Remove row" onClick={removeTableRow} />
        <ToolbarButton icon={<span style={{ fontSize: 9, fontFamily: "monospace", color: "#c44" }}>{"\u2212"}C</span>} title="Remove column" onClick={removeTableCol} />
        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 3px" }} />
        <ToolbarButton icon={<span style={{ fontSize: 10 }}>&bull; &ndash;</span>} title="Bullet list" onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton icon={<span style={{ fontSize: 10 }}>1. &ndash;</span>} title="Numbered list" onClick={() => exec("insertOrderedList")} />
        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 3px" }} />
        <ToolbarButton icon={<span style={{ fontSize: 11 }}>&mdash;</span>} title="Insert divider" onClick={insertDivider} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        [contenteditable] table { table-layout: auto; }
        [contenteditable] td { resize: horizontal; overflow: auto; min-width: 40px; }
        [contenteditable] td:hover { outline: 1px dashed #8B6914; outline-offset: -1px; }
        [contenteditable] h2 { font-size: 18px; font-weight: 700; margin: 12px 0 6px; color: var(--text); }
        [contenteditable] hr { border: none; border-top: 1px solid var(--text-faint); margin: 12px 0; }
      `}} />
      <div ref={editorRef} contentEditable onInput={handleInput} onBlur={handleInput} onPaste={handlePaste}
        suppressContentEditableWarning
        style={{ flex: 1, overflowY: "auto", padding: "14px 24px", fontSize: 13, lineHeight: 1.6, outline: "none", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", minHeight: 100 }} />
    </div>
  );
}

export default function NotebooksPanel({ notebooks, onChange, userId }) {
  const [activeTab, setActiveTab] = useState(notebooks?.[0]?.id || null);
  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState("");
  const [dragId, setDragId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const renameRef = useRef(null);

  useEffect(() => { if (renaming && renameRef.current) renameRef.current.focus(); }, [renaming]);
  useEffect(() => {
    if (notebooks && notebooks.length > 0 && !notebooks.find((n) => n.id === activeTab)) setActiveTab(notebooks[0].id);
  }, [notebooks, activeTab]);

  if (!notebooks) return null;

  const activeNotebook = notebooks.find((n) => n.id === activeTab);

  const updateContent = (html) => {
    onChange(notebooks.map((n) => (n.id === activeTab ? { ...n, content: html } : n)));
  };

  const addNotebook = () => {
    const id = "nb" + Date.now();
    onChange([...notebooks, { id, title: "New Note", content: "<p></p>" }]);
    setActiveTab(id);
  };

  const deleteNotebook = (id) => {
    if (notebooks.length <= 1) return;
    const filtered = notebooks.filter((n) => n.id !== id);
    onChange(filtered);
    if (activeTab === id) setActiveTab(filtered[0]?.id);
  };

  const startRename = (nb) => { setRenaming(nb.id); setRenameText(nb.title); };
  const finishRename = () => {
    if (renameText.trim()) onChange(notebooks.map((n) => (n.id === renaming ? { ...n, title: renameText.trim() } : n)));
    setRenaming(null);
  };

  // Drag to reorder
  const handleNoteDragStart = (id) => setDragId(id);
  const handleNoteDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const items = [...notebooks];
    const fromIdx = items.findIndex((n) => n.id === dragId);
    const toIdx = items.findIndex((n) => n.id === targetId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    onChange(items);
    setDragId(null);
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Collapsible note list */}
      <div style={{
        width: sidebarOpen ? 180 : 32, minWidth: sidebarOpen ? 180 : 32, background: "var(--bg-surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s, min-width 0.2s",
      }}>
        <div style={{
          padding: sidebarOpen ? "10px 10px 6px" : "10px 4px 6px", display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Hide notes list" : "Show notes list"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: 0, lineHeight: 1 }}>
            {sidebarOpen ? "\u25C0" : "\u25B6"}
          </button>
          {sidebarOpen && (
            <>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", flex: 1, marginLeft: 6 }}>Notes</span>
              <button onClick={addNotebook} title="Add note" style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
                color: "var(--text-muted)", fontSize: 14, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
              }}>+</button>
            </>
          )}
        </div>
        {sidebarOpen && (
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {notebooks.map((nb) => (
            <div
              key={nb.id}
              draggable
              onDragStart={() => handleNoteDragStart(nb.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleNoteDrop(nb.id)}
              onClick={() => setActiveTab(nb.id)}
              onDoubleClick={() => startRename(nb)}
              style={{
                padding: "7px 10px", cursor: "pointer", fontSize: 12,
                background: nb.id === activeTab ? "#fff" : "transparent",
                color: nb.id === activeTab ? "#444" : "#888",
                fontWeight: nb.id === activeTab ? 600 : 400,
                borderLeft: nb.id === activeTab ? "3px solid #8B6914" : "3px solid transparent",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "all 0.1s",
              }}
            >
              {renaming === nb.id ? (
                <input ref={renameRef} value={renameText} onChange={(e) => setRenameText(e.target.value)}
                  onBlur={finishRename} onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setRenaming(null); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ border: "none", background: "transparent", font: "inherit", outline: "none", padding: 0, width: "100%", fontSize: 12 }} />
              ) : (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{nb.title}</span>
              )}
              {notebooks.length > 1 && nb.id === activeTab && (
                <button onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 12, padding: 0, fontWeight: 600, flexShrink: 0, marginLeft: 4 }}
                  onMouseEnter={(e) => (e.target.style.color = "#c44")} onMouseLeave={(e) => (e.target.style.color = "#ccc")}
                >&times;</button>
              )}
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {activeNotebook ? (
          <RichEditor key={activeNotebook.id} content={activeNotebook.content} onChange={updateContent} userId={userId} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>Select or create a note</div>
        )}
      </div>
    </div>
  );
}
