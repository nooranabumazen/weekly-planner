import { useState, useRef, useEffect } from "react";

function ContactCard({ contact, onUpdate, onDelete, expanded, onToggle, autoEdit }) {
  const [editing, setEditing] = useState(autoEdit || false);
  const [form, setForm] = useState(contact);
  const nameRef = useRef(null);
  const notesRef = useRef(null);

  useEffect(() => { if (editing && nameRef.current) { nameRef.current.focus(); nameRef.current.select(); } }, [editing]);

  // Persist notes textarea height per-contact in localStorage.
  useEffect(() => {
    if (!editing || !notesRef.current) return;
    try {
      const saved = localStorage.getItem(`contactNotesHeight_${contact.id}`);
      if (saved) notesRef.current.style.height = saved + "px";
    } catch {}
    const el = notesRef.current;
    const handleMouseUp = () => {
      if (!el) return;
      try { localStorage.setItem(`contactNotesHeight_${contact.id}`, String(el.offsetHeight)); } catch {}
    };
    el.addEventListener("mouseup", handleMouseUp);
    return () => { el.removeEventListener("mouseup", handleMouseUp); };
  }, [editing, contact.id]);

  const save = () => { if (form.name.trim()) onUpdate({ ...form, name: form.name.trim() }); setEditing(false); };

  const field = (label, key, placeholder, multiline = false) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.5, marginBottom: 2, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>{label}</div>
      {multiline ? (
        <textarea ref={key === "notes" ? notesRef : null} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 7px", fontSize: 14, outline: "none", background: "var(--bg-card)", fontFamily: "'DM Sans', sans-serif", resize: "vertical", minHeight: 50, boxSizing: "border-box", lineHeight: 1.5 }} />
      ) : (
        <input ref={key === "name" ? nameRef : null} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 7px", fontSize: 14, outline: "none", background: "var(--bg-card)", boxSizing: "border-box" }} />
      )}
    </div>
  );

  if (editing) {
    return (
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: 10, marginBottom: 6 }}>
        {field("Name", "name", "Name")}
        {field("Birthday", "birthday", "e.g. March 15")}
        {field("Likes", "likes", "Things they enjoy...")}
        {field("Dislikes", "dislikes", "Things they don't like...")}
        {field("Relationship", "relationship", "e.g. Friend, Colleague, Family")}
        {field("Notes", "notes", "General notes...", true)}
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button onClick={save} style={{ flex: 1, background: "#555", color: "#fff", border: "none", borderRadius: 4, padding: "5px 0", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>Save</button>
          <button onClick={() => { setForm(contact); setEditing(false); }} style={{ flex: 1, background: "var(--border)", color: "var(--text-muted)", border: "none", borderRadius: 4, padding: "5px 0", cursor: "pointer", fontSize: 10 }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 4, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "8px 10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{contact.name}</span>
          {contact.relationship && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 6, fontWeight: 500, background: "var(--border-light)", padding: "1px 5px", borderRadius: 3 }}>{contact.relationship}</span>}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-faint)", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "0 10px 8px", borderTop: "1px solid var(--border-light)" }}>
          {contact.birthday && <div style={{ fontSize: 14, color: "var(--text)", marginTop: 6 }}><span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Birthday:</span> {contact.birthday}</div>}
          {contact.likes && <div style={{ fontSize: 14, color: "var(--text)", marginTop: 5 }}><span style={{ color: "#6a9955", fontWeight: 600 }}>Likes:</span> {contact.likes}</div>}
          {contact.dislikes && <div style={{ fontSize: 14, color: "var(--text)", marginTop: 5 }}><span style={{ color: "#c47a20", fontWeight: 600 }}>Dislikes:</span> {contact.dislikes}</div>}
          {contact.notes && <div style={{ fontSize: 14, color: "var(--text)", marginTop: 5, lineHeight: 1.5 }}><span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Notes:</span> {contact.notes}</div>}
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <button onClick={() => { setForm(contact); setEditing(true); }} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>Edit</button>
            <button onClick={() => { if (window.confirm("Are you sure you want to delete this contact?")) onDelete(); }} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "var(--text-faint)" }}
              onMouseEnter={(e) => { e.target.style.borderColor = "#c44"; e.target.style.color = "#c44"; }}
              onMouseLeave={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "#ccc"; }}
            >Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactsPanel({ contacts, onChange }) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [autoEditId, setAutoEditId] = useState(null);
  const listRef = useRef(null);

  if (!contacts) return null;

  const filtered = (contacts || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.relationship || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.notes || "").toLowerCase().includes(search.toLowerCase())
  );

  const addContact = () => {
    const newContact = { id: "c" + Date.now(), name: "New Contact", birthday: "", likes: "", dislikes: "", relationship: "", notes: "" };
    onChange([...contacts, newContact]);
    setExpandedId(newContact.id);
    setAutoEditId(newContact.id);
    setSearch("");
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      setAutoEditId(null);
    }, 50);
  };

  const updateContact = (id, updated) => { onChange(contacts.map((c) => (c.id === id ? { ...c, ...updated } : c))); };
  const deleteContact = (id) => { onChange(contacts.filter((c) => c.id !== id)); if (expandedId === id) setExpandedId(null); };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 500, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden", padding: "0 16px" }}>
        <div style={{ padding: "12px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>People</span>
          <button onClick={addContact}
            style={{ background: "var(--accent)", border: "none", borderRadius: 5, cursor: "pointer", color: "#fff", fontSize: 13, padding: "6px 14px", display: "flex", alignItems: "center", gap: 5, fontWeight: 600, lineHeight: 1 }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            title="Add new person">
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            <span>Add person</span>
          </button>
        </div>
        <div style={{ padding: "8px 0" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..."
            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 8px", fontSize: 14, outline: "none", background: "var(--input-bg)", boxSizing: "border-box" }} />
        </div>
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
          {filtered.length === 0 && <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 20 }}>{contacts.length === 0 ? "No contacts yet" : "No matches"}</div>}
          {filtered.map((contact) => (
            <ContactCard key={contact.id} contact={contact} expanded={expandedId === contact.id}
              autoEdit={autoEditId === contact.id}
              onToggle={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
              onUpdate={(updated) => updateContact(contact.id, updated)}
              onDelete={() => deleteContact(contact.id)} />
          ))}
        </div>
        <div style={{ padding: "6px 0", fontSize: 10, color: "var(--text-faint)", borderTop: "1px solid var(--border)" }}>
          {contacts.length} {contacts.length === 1 ? "person" : "people"}
        </div>
      </div>
    </div>
  );
}
