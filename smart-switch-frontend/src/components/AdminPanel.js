import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const AdminPanel = () => {
  const [allDevices, setAllDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, online, offline
  const [sortBy, setSortBy] = useState('name'); // name, user, lastSeen, current, deviceId
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc

  useEffect(() => {
    fetchAllDevices();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAllDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Apply filters whenever search criteria change
  useEffect(() => {
    applyFilters();
  }, [allDevices, searchText, statusFilter, sortBy, sortOrder]);

  const fetchAllDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllDevices(data);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...allDevices];

    // Text search (device name, device ID, username)
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(device => 
        device.name.toLowerCase().includes(searchLower) ||
        device.id.toLowerCase().includes(searchLower) ||
        device.username.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(device => {
        if (statusFilter === 'online') return device.is_online;
        if (statusFilter === 'offline') return !device.is_online;
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'user':
          aValue = a.username.toLowerCase();
          bValue = b.username.toLowerCase();
          break;
        case 'deviceId':
          aValue = a.id.toLowerCase();
          bValue = b.id.toLowerCase();
          break;
        case 'lastSeen':
          aValue = new Date(a.last_seen || 0);
          bValue = new Date(b.last_seen || 0);
          break;
        case 'current':
          aValue = parseFloat(a.current_reading) || 0;
          bValue = parseFloat(b.current_reading) || 0;
          break;
        case 'status':
          aValue = a.is_online ? 1 : 0;
          bValue = b.is_online ? 1 : 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredDevices(filtered);
  };

  const controlDevice = async (deviceId, action, value) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/devices/${deviceId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, value })
      });
      
      if (response.ok) {
        setTimeout(fetchAllDevices, 1000);
      }
    } catch (error) {
      console.error('Error controlling device:', error);
    }
  };

  const clearAllFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setSortBy('name');
    setSortOrder('asc');
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Statistics
  const stats = {
    total: allDevices.length,
    online: allDevices.filter(d => d.is_online).length,
    offline: allDevices.filter(d => !d.is_online).length,
    filtered: filteredDevices.length
  };

  if (loading) {
    return <div className="loading">Loading admin panel...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Admin Panel - Device Management</h2>
        <div className="stats">
          <span>Total: {stats.total}</span>
          <span>Online: {stats.online}</span>
          <span>Offline: {stats.offline}</span>
          {stats.filtered !== stats.total && (
            <span className="filtered-count">Showing: {stats.filtered}</span>
          )}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="admin-controls">
        <div className="search-section">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Search by device name, device ID, or username..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
            {searchText && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchText('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Devices</option>
              <option value="online">Online Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="name">Device Name</option>
              <option value="user">User Name</option>
              <option value="deviceId">Device ID</option>
              <option value="status">Status</option>
              <option value="lastSeen">Last Seen</option>
              <option value="current">Current Reading</option>
            </select>
          </div>

          <button 
            className="sort-order-btn"
            onClick={toggleSortOrder}
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <button 
            className="clear-filters-btn"
            onClick={clearAllFilters}
            title="Clear all filters"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Results Info */}
      {searchText || statusFilter !== 'all' ? (
        <div className="search-info">
          Showing {filteredDevices.length} of {allDevices.length} devices
          {searchText && (
            <span> matching "{searchText}"</span>
          )}
          {statusFilter !== 'all' && (
            <span> ({statusFilter} devices)</span>
          )}
        </div>
      ) : null}

      <div className="admin-devices-table">
        <table>
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Name</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Switch</th>
              <th>Current (A)</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(device => (
              <tr key={device.id}>
                <td>
                  <span className="device-id-cell">{device.id}</span>
                </td>
                <td>
                  <span className="device-name-cell">{device.name}</span>
                </td>
                <td>
                  <span className="username-cell">{device.username}</span>
                </td>
                <td>
                  <span className={`status ${device.is_online ? 'online' : 'offline'}`}>
                    {device.is_online ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td>
                  <span className={`switch-status ${device.switch_state ? 'on' : 'off'}`}>
                    {device.switch_state ? 'ON' : 'OFF'}
                  </span>
                </td>
                <td>{(parseFloat(device.current_reading) || 0).toFixed(2)}</td>
                <td>
                  {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
                </td>
                <td>
                  <div className="admin-actions">
                    <button 
                      className="control-btn"
                      onClick={() => controlDevice(device.id, 'switch', !device.switch_state)}
                      disabled={!device.is_online}
                    >
                      {device.switch_state ? 'Turn OFF' : 'Turn ON'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredDevices.length === 0 && !loading && (
        <div className="no-results">
          {allDevices.length === 0 ? (
            <h3>No devices registered yet</h3>
          ) : (
            <div>
              <h3>No devices match your search criteria</h3>
              <p>Try adjusting your search terms or filters</p>
              <button onClick={clearAllFilters} className="clear-filters-btn">
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;