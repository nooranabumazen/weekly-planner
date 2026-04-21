import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { usePlannerData } from './usePlannerData';
import { useLocalData } from './useLocalData';
import LoginScreen from './LoginScreen';
import Planner from './Planner';

function useAuthMode() {
  return useMemo(() => {
    // Check URL triggers first
    const isCloudUrl = window.location.pathname === '/cloud' || window.location.pathname === '/cloud/';
    const params = new URLSearchParams(window.location.search);
    const isAuthParam = params.get('auth') === 'true';
    // If URL says cloud, set the flag for future visits (PWA install strips URL)
    if (isCloudUrl || isAuthParam) {
      try { localStorage.setItem('planner_cloud_mode', 'true'); } catch {}
      return true;
    }
    // Otherwise check the persistent flag
    try { return localStorage.getItem('planner_cloud_mode') === 'true'; } catch { return false; }
  }, []);
}

function CloudApp() {
  const { user, loading: authLoading, login, signup, logout } = useAuth();
  const { data, loading: dataLoading, save, saveQuiet, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveProjects, saveDailyHabits, saveWeeklyHabits, saveSettings, saveRecurringRules, saveMoods, loadWeekTasks, saveWeekTasks, getBackups, restoreBackup, exportData } = usePlannerData(user?.uid);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fdfcf8', color: '#999', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} onSignup={signup} />;
  }

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fdfcf8', color: '#999', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
        Loading your planner...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fdfcf8', color: '#666', fontFamily: "'DM Sans', sans-serif", fontSize: 14, gap: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#c44' }}>Could not load your data</div>
        <div>Check your internet connection and try again.</div>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', background: '#555', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600, marginTop: 8 }}>Retry</button>
      </div>
    );
  }

  return (
    <Planner
      data={data} onSave={save} onSaveQuiet={saveQuiet} onSaveFuture={saveFuture}
      onSaveNotebooks={saveNotebooks} onSaveJournal={saveJournal} onSaveContacts={saveContacts}
      onSaveArchive={saveArchive} onSaveProjects={saveProjects} onSaveDailyHabits={saveDailyHabits}
      onSaveWeeklyHabits={saveWeeklyHabits} onSaveSettings={saveSettings}
      onSaveRecurringRules={saveRecurringRules} onSaveMoods={saveMoods}
      onLoadWeekTasks={loadWeekTasks} onSaveWeekTasks={saveWeekTasks}
      onGetBackups={getBackups} onRestoreBackup={restoreBackup} onExportData={exportData}
      onLogout={() => { try { localStorage.removeItem('planner_cloud_mode'); } catch {} logout(); }} userEmail={user.email} userId={user.uid}
    />
  );
}

function LocalApp() {
  const { data, loading, save, saveQuiet, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveProjects, saveDailyHabits, saveWeeklyHabits, saveSettings, saveRecurringRules, saveMoods, loadWeekTasks, saveWeekTasks, getBackups, restoreBackup, exportData } = useLocalData();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a', color: '#999', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
        Loading your planner...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a', color: '#999', fontFamily: "'DM Sans', sans-serif", fontSize: 14, gap: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#c44' }}>Could not load data</div>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', background: '#555', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600, marginTop: 8 }}>Retry</button>
      </div>
    );
  }

  return (
    <Planner
      data={data} onSave={save} onSaveQuiet={saveQuiet} onSaveFuture={saveFuture}
      onSaveNotebooks={saveNotebooks} onSaveJournal={saveJournal} onSaveContacts={saveContacts}
      onSaveArchive={saveArchive} onSaveProjects={saveProjects} onSaveDailyHabits={saveDailyHabits}
      onSaveWeeklyHabits={saveWeeklyHabits} onSaveSettings={saveSettings}
      onSaveRecurringRules={saveRecurringRules} onSaveMoods={saveMoods}
      onLoadWeekTasks={loadWeekTasks} onSaveWeekTasks={saveWeekTasks}
      onGetBackups={getBackups} onRestoreBackup={restoreBackup} onExportData={exportData}
      onLogout={() => { window.location.href = window.location.pathname; }}
      userEmail="local" userId="local"
    />
  );
}

export default function App() {
  const authMode = useAuthMode();
  return authMode ? <CloudApp /> : <LocalApp />;
}
