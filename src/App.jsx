import { useAuth } from './useAuth';
import { usePlannerData } from './usePlannerData';
import LoginScreen from './LoginScreen';
import Planner from './Planner';

export default function App() {
  const { user, loading: authLoading, login, signup, logout } = useAuth();
  const { data, loading: dataLoading, save, saveQuiet, saveFuture, saveNotebooks, saveJournal, saveContacts, saveArchive, saveDailyHabits, saveWeeklyHabits, saveSettings } = usePlannerData(user?.uid);

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

  if (dataLoading || !data) {
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
      onLogout={logout}
      userEmail={user.email}
      userId={user.uid}
    />
  );
}
