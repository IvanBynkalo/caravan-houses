import React                                    from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthScreen }      from './screens/AuthScreen.js';
import { MainMenuScreen, JoinRoomScreen } from './screens/MainMenuScreen.js';
import { LobbyScreen }     from './screens/LobbyScreen.js';
import { MatchScreen }     from './screens/MatchScreen.js';
import { ResultsScreen }   from './screens/ResultsScreen.js';

function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/auth" element={<AuthScreen />} />

        {/* Protected routes */}
        <Route path="/" element={
          <RequireAuth><MainMenuScreen /></RequireAuth>
        } />
        <Route path="/join" element={
          <RequireAuth><JoinRoomScreen /></RequireAuth>
        } />
        <Route path="/lobby/:roomId" element={
          <RequireAuth><LobbyScreen /></RequireAuth>
        } />
        <Route path="/match/:matchId" element={
          <RequireAuth><MatchScreen /></RequireAuth>
        } />
        <Route path="/results/:matchId" element={
          <RequireAuth><ResultsScreen /></RequireAuth>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
