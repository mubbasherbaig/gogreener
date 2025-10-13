// COMPLETELY REDESIGNED MODERN DeviceChart.js
// Location: smart-switch-frontend/src/components/DeviceChart.js

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../config';

const DeviceChart = ({ device, onClose }) => {
  const [telemetryData, setTelemetryData] = useState([]);
  const [timeRange, setTimeRange] = useState('24');
  const [loading, setLoading] = useState(true);

  // Time range options as modern tabs
  const timeRangeOptions = [
    { value: '1', label: '1H', icon: '⏱️' },
    { value: '6', label: '6H', icon: '🕐' },
    { value: '24', label: '24H', icon: '📅' },
    { value: '168', label: '1W', icon: '📆' }
  ];

  useEffect(() => {
    fetchTelemetry();
  }, [device.id, timeRange]);

  const formatTimeForRange = (timestamp, hours) => {
    const date = new Date(timestamp);
    
    if (hours <= 6) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', { 
        hour: '2-digit',
        minute: '2-digit',
        hour12: false 
      });
      return `${dateStr}\n${timeStr}`;
    }
  };

  const sampleData = (data, maxPoints) => {
    if (data.length <= maxPoints) return data;
    
    const step = Math.ceil(data.length / maxPoints);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    
    return sampled;
  };

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/telemetry?hours=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const hoursInt = parseInt(timeRange, 10);
        
        const formattedData = data.map(item => ({
          time: formatTimeForRange(item.timestamp, hoursInt),
          fullTime: new Date(item.timestamp).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true 
          }),
          current: parseFloat(item.current_reading) || 0,
          voltage: parseFloat(item.voltage) || 0,
          state: item.switch_state ? 1 : 0,
          stateText: item.switch_state ? 'ON' : 'OFF'
        }));
        
        const chronologicalData = formattedData.reverse();
        const maxPoints = hoursInt <= 1 ? 360 : hoursInt <= 6 ? 500 : hoursInt <= 24 ? 600 : 800;
        const sampledData = sampleData(chronologicalData, maxPoints);
        
        setTelemetryData(sampledData);
      }
    } catch (error) {
      console.error('Error fetching telemetry:', error);
    }
    setLoading(false);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ 
          backgroundColor: 'rgba(26, 26, 26, 0.95)', 
          padding: '12px 16px', 
          border: '2px solid #4CAF50',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>
            📅 {data.fullTime}
          </p>
          <p style={{ margin: 0, color: '#4CAF50', fontSize: '14px', fontWeight: 'bold' }}>
            State: {data.stateText}
          </p>
        </div>
      );
    }
    return null;
  };

  const CurrentTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ 
          backgroundColor: 'rgba(26, 26, 26, 0.95)', 
          padding: '12px 16px', 
          border: '2px solid #2196F3',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>
            📅 {data.fullTime}
          </p>
          <p style={{ margin: 0, color: '#2196F3', fontSize: '14px', fontWeight: 'bold' }}>
            Current: {data.current.toFixed(2)} A
          </p>
        </div>
      );
    }
    return null;
  };

  const getTickCount = () => {
    const isMobile = window.innerWidth < 768;
    return isMobile ? Math.min(5, telemetryData.length) : Math.min(10, telemetryData.length);
  };

  const CustomAxisTick = ({ x, y, payload }) => {
    const lines = payload.value.split('\n');
    return (
      <g transform={`translate(${x},${y})`}>
        {lines.map((line, index) => (
          <text key={index} x={0} y={index * 16 + 10} textAnchor="middle"
            fill="#000" fontSize="13px" fontWeight="700" fontFamily="Arial, sans-serif">
            {line}
          </text>
        ))}
      </g>
    );
  };

  const CustomYAxisTick = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
      <text x={-5} y={0} dy={4} textAnchor="end"
        fill="#000" fontSize="13px" fontWeight="700" fontFamily="Arial, sans-serif">
        {payload.value}
      </text>
    </g>
  );

  const CustomStateYAxisTick = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
      <text x={-5} y={0} dy={4} textAnchor="end"
        fill="#000" fontSize="14px" fontWeight="900" fontFamily="Arial, sans-serif">
        {payload.value === 1 ? 'ON' : 'OFF'}
      </text>
    </g>
  );

  return (
    <div className="modal-overlay-modern" onClick={onClose}>
      <div className="chart-modal-modern" onClick={(e) => e.stopPropagation()}>
        {/* Modern Gradient Header */}
        <div className="modal-header-modern">
          <div className="header-content">
            <div className="device-icon">📊</div>
            <div className="header-text">
              <h3>{device.name}</h3>
              <span className="subtitle">Telemetry Analytics</span>
            </div>
          </div>
          <button className="close-btn-modern" onClick={onClose}>✕</button>
        </div>

        {/* Modern Tab Selector */}
        <div className="time-range-tabs">
          <div className="tabs-label">Time Range</div>
          <div className="tabs-container">
            {timeRangeOptions.map(option => (
              <button
                key={option.value}
                className={`tab-button ${timeRange === option.value ? 'active' : ''}`}
                onClick={() => setTimeRange(option.value)}
              >
                <span className="tab-icon">{option.icon}</span>
                <span className="tab-label">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chart Content */}
        {loading ? (
          <div className="loading-modern">
            <div className="spinner"></div>
            <p>Loading analytics...</p>
          </div>
        ) : telemetryData.length === 0 ? (
          <div className="no-data-modern">
            <div className="no-data-icon">📭</div>
            <p>No telemetry data available</p>
            <span>Try selecting a different time range</span>
          </div>
        ) : (
          <div className="charts-container-modern">
            {/* Current Reading Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <span className="chart-icon"></span>
                <h4>Current Reading</h4>
                <span className="chart-unit">Amperes</span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={telemetryData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
                  <defs>
                    <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2196F3" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2196F3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" strokeWidth={1} />
                  <XAxis dataKey="time" tick={<CustomAxisTick />} height={70}
                    interval={Math.floor(telemetryData.length / getTickCount())}
                    stroke="#666" strokeWidth={1.5} />
                  <YAxis tick={<CustomYAxisTick />} width={50} stroke="#666" strokeWidth={1.5} />
                  <Tooltip content={<CurrentTooltip />} />
                  <Line type="monotone" dataKey="current" stroke="#2196F3" strokeWidth={3}
                    dot={false} isAnimationActive={false} fill="url(#currentGradient)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Switch State Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <span className="chart-icon"></span>
                <h4>Switch State</h4>
                <span className="chart-unit">ON/OFF</span>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={telemetryData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" strokeWidth={1} />
                  <XAxis dataKey="time" tick={<CustomAxisTick />} height={70}
                    interval={Math.floor(telemetryData.length / getTickCount())}
                    stroke="#666" strokeWidth={1.5} />
                  <YAxis domain={[0, 1]} ticks={[0, 1]} tick={<CustomStateYAxisTick />}
                    width={50} stroke="#666" strokeWidth={1.5} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="stepAfter" dataKey="state" stroke="#4CAF50" strokeWidth={4}
                    dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceChart;