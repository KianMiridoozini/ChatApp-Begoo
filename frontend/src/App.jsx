import Navbar from "./components/Navbar";
import { Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";

import { useAuthStore } from "./store/useAuthStore";
import { useEffect, useState } from "react";
import {Loader} from "lucide-react";
import { Toaster } from "react-hot-toast";
import { useThemeStore } from "./store/useThemeStore";
import { useChatStore } from "./store/useChatStore";

const App = () => {
  const {authUser, checkAuth, isCheckingAuth, socket} = useAuthStore();
  const {theme} = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { subscribeToGlobalEvents, unsubscribeFromGlobalEvents, loadSeenMessages } = useChatStore();

  // Initialize auth and socket connection
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Subscribe to global events when socket is connected
  useEffect(() => {
    if (socket && authUser) {
      loadSeenMessages(); // Load seen messages from localStorage on app start
      subscribeToGlobalEvents();
      return () => unsubscribeFromGlobalEvents();
    }
  }, [socket, authUser, subscribeToGlobalEvents, unsubscribeFromGlobalEvents, loadSeenMessages]);

  // console.log({onlineUsers})

  if (isCheckingAuth && !authUser) return (
    <div className="flex items-center justify-center h-screen">
      <Loader className="size-10 animate-spin"/>
    </div>
  )
  return (
    <div data-theme={theme}>
    <Navbar onSidebarToggle={() => setSidebarOpen(true)} />
    <Routes>
      <Route path="/" element={authUser ? <HomePage sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> : <Navigate to="/login" />} />
      <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
      <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
    </Routes>

    <Toaster></Toaster>
    </div>
    
  );
}
export default App;