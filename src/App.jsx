import { useAuth } from './useAuth';
import { usePlannerData } from './usePlannerData';
import LoginScreen from './LoginScreen';
import Planner from './Planner';

export default function App() {
  const { user, loading: authLoading, login, signup, logout } = useAuth();
  const { data, loading: dataLoading, save, saveQuiet, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveDailyHabits, saveWeeklyHabits, saveSettings, saveRecurringRules, saveMoods, getBackups, restoreBackup, exportData } = usePlannerData(user?.uid);

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#fdfcf8', color: '#999',
        fontFamily: "'DM Sans', sans-serif", fontSize: 14,
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} onSignup={signup} />;
  }

  if (dataLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#fdfcf8', color: '#999',
        fontFamily: "'DM Sans', sans-serif", fontSize: 14,
      }}>
        Loading your planner...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#fdfcf8', color: '#666',
        fontFamily: "'DM Sans', sans-serif", fontSize: 14, gap: 12, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#c44' }}>Could not load your data</div>
        <div>Check your internet connection and try again.</div>
        <button onClick={() => window.location.reload()} style={{
          padding: '10px 24px', background: '#555', color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600, marginTop: 8,
        }}>Retry</button>
      </div>
    );
  }

  return (
    <Planner
      data={data}
      onSave={save}
      onSaveQuiet={saveQuiet}
      onSaveFuture={saveFuture}
      onSaveNotebooks={saveNotebooks}
      onSaveJournal={saveJournal}
      onSaveContacts={saveContacts}
      onSaveArchive={saveArchive}
      onSaveDailyHabits={saveDailyHabits}
      onSaveWeeklyHabits={saveWeeklyHabits}
      onSaveSettings={saveSettings}
      onSaveRecurringRules={saveRecurringRules}
      onSaveMoods={saveMoods}
      onGetBackups={getBackups}
      onRestoreBackup={restoreBackup}
      onExportData={exportData}
      onLogout={logout}
      userEmail={user.email}
      userId={user.uid}
    />
  );
}
