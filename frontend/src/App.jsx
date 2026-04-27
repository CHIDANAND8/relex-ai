import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import UserChat from "./pages/UserChat";
import AdminChat from "./pages/AdminChat";
import ContextPage from "./pages/ContextPage";   // ✅ NEW
import AdminDashboard from "./pages/AdminDashboard";
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* AUTH */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* USER */}
        <Route path="/chat" element={<UserChat />} />

        {/* ADMIN */}
        <Route path="/admin" element={<AdminChat />} />

        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* AI CONTEXT PAGE */}
        <Route path="/context" element={<ContextPage />} />  {/* ✅ NEW */}

      </Routes>
    </BrowserRouter>
  );
}

export default App;