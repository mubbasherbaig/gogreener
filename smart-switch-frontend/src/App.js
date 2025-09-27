import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import './App.css';
import logo from './assets/logo.png';
import DeviceSetup from './components/DeviceSetup';
import SetupGuide from './components/SetupGuide'
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        {user && (
          <nav className="navbar">
            <div className="nav-content">
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <img src={logo} alt="Smart Switch" style={{height: '100px'}} />
              </div>
              <div className="nav-right">
                <span>Welcome, {user.username}</span>
                {/* Remove the admin panel link since admins go directly to admin panel */}
                {user.role === 'admin' && (
                  <span style={{ color: '#3182ce', fontWeight: 'bold' }}>
                    (Administrator)
                  </span>
                )}
                <button onClick={handleLogout} className="logout-btn">Logout</button>
              </div>
            </div>
          </nav>
        )}

        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/" 
            element={
              user ? (
                user.role === 'admin' ? (
                  <AdminPanel />
                ) : (
                  <Dashboard />
                )
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
          <Route path="/device-setup" element={<DeviceSetup />} />
          <Route path="/setup-guide" element={<SetupGuide />} />
          <Route 
            path="/admin" 
            element={user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;