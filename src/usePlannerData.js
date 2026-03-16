import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

let _id = 0;
export function makeTask(text, opts = {}) {
  return { id: "t" + Date.now() + "_" + ++_id, text, done: false, ...opts };
}

function getWeekKey() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return monday.toISOString().split("T")[0];
}

export function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label,
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullDate: d.toISOString().split("T")[0],
      isToday: d.toDateString() === today.toDateString(),
    };
  });
}

export function getUpcomingDates() {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + (7 - ((day + 6) % 7)));
  const dates = [];
  for (let i = 1; i <= 21; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullDate: d.toISOString().split("T")[0],
    });
  }
  return dates;
}

const DEFAULT_DAILY_HABITS = [
  { id: "dh1", name: "Read 20 min", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
  { id: "dh2", name: "Exercise", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
  { id: "dh3", name: "Journal", checks: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } },
];

const DEFAULT_WEEKLY_HABITS = [
  { id: "wh1", name: "Meal prep", done: false },
  { id: "wh2", name: "Deep clean one room", done: false },
  { id: "wh3", name: "Call family", done: false },
];

const defaultData = () => ({
  tasks: {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    later: [],
  },
  futureTasks: [],
  dailyHabits: DEFAULT_DAILY_HABITS,
  weeklyHabits: DEFAULT_WEEKLY_HABITS,
  notes: "",
});

function getPrevWeekKey() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  return prevMonday.toISOString().split("T")[0];
}

export function usePlannerData(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimeout = useRef(null);
  const weekKey = getWeekKey();
  const docPath = `users/${userId}/weeks/${weekKey}`;
  const isRemoteUpdate = useRef(false);
  const carryForwardDone = useRef(false);

  // Listen for weekly tasks data
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, docPath), async (snap) => {
      if (snap.exists()) {
        isRemoteUpdate.current = true;
        setData((prev) => ({ ...(prev || defaultData()), ...snap.data() }));
        setLoading(false);
      } else {
        // New week: carry forward incomplete tasks
        if (!carryForwardDone.current) {
          carryForwardDone.current = true;
          const prevWeekKey = getPrevWeekKey();
          const prevDocPath = `users/${userId}/weeks/${prevWeekKey}`;
          try {
            const { getDoc: getDocOnce } = await import('firebase/firestore');
            const prevSnap = await getDocOnce(doc(db, prevDocPath));
            if (prevSnap.exists()) {
              const prevData = prevSnap.data();
              const prevTasks = prevData.tasks || {};
              const carryOver = [];
              const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
              for (const dayKey of dayKeys) {
                for (const task of (prevTasks[dayKey] || [])) {
                  if (!task.done) {
                    carryOver.push({ ...task, id: "t" + Date.now() + "_" + Math.random().toString(36).slice(2, 6) });
                  }
                }
              }
              const weekData = {
                tasks: { mon: carryOver, tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: prevTasks.later || [] },
              };
              setDoc(doc(db, docPath), weekData);
              setData((prev) => ({ ...(prev || defaultData()), ...weekData }));
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error("Error carrying forward tasks:", err);
          }
        }
        const weekData = { tasks: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], later: [] } };
        setDoc(doc(db, docPath), weekData);
        setData((prev) => ({ ...(prev || defaultData()), ...weekData }));
        setLoading(false);
      }
    });
    return unsub;
  }, [userId, docPath]);

  // Save weekly data (tasks only) with debounce
  const save = useCallback(
    (newData) => {
      setData(newData);
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        // Only save tasks to the weekly doc
        setDoc(doc(db, docPath), { tasks: newData.tasks }).catch(console.error);
      }, 500);
    },
    [docPath]
  );

  // ─── Shared meta documents (persist across weeks) ───

  // Future tasks
  const saveFuture = useCallback(
    (futureTasks) => { setDoc(doc(db, `users/${userId}/meta/futureTasks`), { items: futureTasks }).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/futureTasks`), (snap) => {
      if (snap.exists()) setData((prev) => prev ? { ...prev, futureTasks: snap.data().items } : prev);
    });
    return unsub;
  }, [userId]);

  // Notebooks
  const saveNotebooks = useCallback(
    (notebooks) => { setDoc(doc(db, `users/${userId}/meta/notebooks`), { items: notebooks }).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/notebooks`), (snap) => {
      if (snap.exists()) {
        setData((prev) => prev ? { ...prev, notebooks: snap.data().items } : prev);
      } else {
        const defaults = [
          { id: "nb1", title: "Books to Read", content: "<p>Add your reading list here...</p>" },
          { id: "nb2", title: "Cool Ideas", content: "<p>Capture interesting ideas...</p>" },
          { id: "nb3", title: "Things to Cook", content: "<p>Recipes and meal ideas...</p>" },
        ];
        setDoc(doc(db, `users/${userId}/meta/notebooks`), { items: defaults });
        setData((prev) => prev ? { ...prev, notebooks: defaults } : prev);
      }
    });
    return unsub;
  }, [userId]);

  // Journal
  const saveJournal = useCallback(
    (journal) => { setDoc(doc(db, `users/${userId}/meta/journal`), { entries: journal }).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/journal`), (snap) => {
      if (snap.exists()) setData((prev) => prev ? { ...prev, journal: snap.data().entries } : prev);
      else { setDoc(doc(db, `users/${userId}/meta/journal`), { entries: {} }); setData((prev) => prev ? { ...prev, journal: {} } : prev); }
    });
    return unsub;
  }, [userId]);

  // Contacts
  const saveContacts = useCallback(
    (contacts) => { setDoc(doc(db, `users/${userId}/meta/contacts`), { items: contacts }).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/contacts`), (snap) => {
      if (snap.exists()) setData((prev) => prev ? { ...prev, contacts: snap.data().items } : prev);
      else { setDoc(doc(db, `users/${userId}/meta/contacts`), { items: [] }); setData((prev) => prev ? { ...prev, contacts: [] } : prev); }
    });
    return unsub;
  }, [userId]);

  // Archive
  const saveArchive = useCallback(
    (archive) => { setDoc(doc(db, `users/${userId}/meta/archive`), { items: archive }).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/archive`), (snap) => {
      if (snap.exists()) setData((prev) => prev ? { ...prev, archive: snap.data().items } : prev);
      else { setDoc(doc(db, `users/${userId}/meta/archive`), { items: [] }); setData((prev) => prev ? { ...prev, archive: [] } : prev); }
    });
    return unsub;
  }, [userId]);

  // Daily habits (shared, persist across weeks)
  const saveDailyHabits = useCallback(
    (habits) => { setDoc(doc(db, `users/${userId}/meta/dailyHabits`), { items: habits }).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/dailyHabits`), (snap) => {
      if (snap.exists()) setData((prev) => prev ? { ...prev, dailyHabits: snap.data().items } : prev);
      else { setDoc(doc(db, `users/${userId}/meta/dailyHabits`), { items: DEFAULT_DAILY_HABITS }); setData((prev) => prev ? { ...prev, dailyHabits: DEFAULT_DAILY_HABITS } : prev); }
    });
    return unsub;
  }, [userId]);

  // Weekly habits (shared, persist across weeks)
  const saveWeeklyHabits = useCallback(
    (habits) => { setDoc(doc(db, `users/${userId}/meta/weeklyHabits`), { items: habits }).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/weeklyHabits`), (snap) => {
      if (snap.exists()) setData((prev) => prev ? { ...prev, weeklyHabits: snap.data().items } : prev);
      else { setDoc(doc(db, `users/${userId}/meta/weeklyHabits`), { items: DEFAULT_WEEKLY_HABITS }); setData((prev) => prev ? { ...prev, weeklyHabits: DEFAULT_WEEKLY_HABITS } : prev); }
    });
    return unsub;
  }, [userId]);

  // Settings (categories, layout, notes - shared)
  const saveSettings = useCallback(
    (settings) => { setDoc(doc(db, `users/${userId}/meta/settings`), settings).catch(console.error); },
    [userId]
  );
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, `users/${userId}/meta/settings`), (snap) => {
      if (snap.exists()) {
        const s = snap.data();
        setData((prev) => prev ? { ...prev, categories: s.categories, layout: s.layout, notes: s.notes, darkMode: s.darkMode } : prev);
      } else {
        const defaults = { categories: DEFAULT_CATEGORIES, layout: "vertical", notes: "", darkMode: false };
        setDoc(doc(db, `users/${userId}/meta/settings`), defaults);
        setData((prev) => prev ? { ...prev, ...defaults } : prev);
      }
    });
    return unsub;
  }, [userId]);

  return { data, loading, save, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveDailyHabits, saveWeeklyHabits, saveSettings };
}

export const DEFAULT_CATEGORIES = [
  { id: "cat_cleaning", name: "Cleaning", color: "#B7D5E8" },
  { id: "cat_cooking", name: "Cooking", color: "#E8C9B7" },
  { id: "cat_learning", name: "Learning", color: "#D5E8B7" },
  { id: "cat_crafts", name: "Crafts/Art/Reading", color: "#D5B7E8" },
  { id: "cat_sporas", name: "Sporas", color: "#E8B7D5" },
  { id: "cat_events", name: "Events", color: "#B7E8D5" },
  { id: "cat_volunteering", name: "Volunteering", color: "#E8D5B7" },
  { id: "cat_gardening", name: "Gardening", color: "#c8e8b0" },
  { id: "cat_none", name: "Other", color: "#e0ddd6" },
];
