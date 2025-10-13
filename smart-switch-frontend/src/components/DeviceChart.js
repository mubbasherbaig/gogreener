import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../config';

const DeviceChart = ({ device, onClose }) => {
  const [telemetryData, setTelemetryData] = useState([]);
  const [timeRange, setTimeRange] = useState('24');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTelemetry();
  }, [device.id, timeRange]);

  // Format time based on selected range
  const formatTimeForRange = (timestamp, hours) => {
    const date = new Date(timestamp);
    
    if (hours <= 6) {
      // For short ranges (1-6 hours): show only time
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (hours <= 24) {
      // For 24 hours: show date + time
      return date.toLocaleString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      // For week: show date + time (more compact)
      return date.toLocaleString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        hour12: false 
      });
    }
  };

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/telemetry?hours=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const hoursInt = parseInt(timeRange, 10);
        
        const formattedData = data.map(item => ({
          time: formatTimeForRange(item.timestamp, hoursInt),
          fullTime: new Date(item.timestamp).toLocaleString(), // For tooltip
          current: parseFloat(item.current_reading) || 0,
          voltage: parseFloat(item.voltage) || 0,
          state: item.switch_state ? 1 : 0,
          stateText: item.switch_state ? 'ON' : 'OFF'
        }));
        
        setTelemetryData(formattedData.reverse());
      }
    } catch (error) {
      console.error('Error fetching telemetry:', error);
    }
    setLoading(false);
  };

  // Custom tooltip for better display
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '10px', 
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontSize: '12px' }}><strong>Time:</strong> {data.fullTime}</p>
          <p style={{ margin: 0, color: payload[0].color, fontSize: '12px' }}>
            <strong>State:</strong> {data.stateText}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for current reading
  const CurrentTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '10px', 
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontSize: '12px' }}><strong>Time:</strong> {data.fullTime}</p>
          <p style={{ margin: 0, color: '#2196F3', fontSize: '12px' }}>
            <strong>Current:</strong> {data.current.toFixed(2)} A
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate tick count based on data length and screen size
  const getTickCount = () => {
    const isMobile = window.innerWidth < 768;
    const dataLength = telemetryData.length;
    
    if (isMobile) {
      return Math.min(4, dataLength); // Show fewer ticks on mobile
    } else {
      return Math.min(8, dataLength); // Show more ticks on desktop
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{device.name} - Telemetry</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="chart-controls">
          <label>Time Range:</label>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="1">Last Hour</option>
            <option value="6">Last 6 Hours</option>
            <option value="24">Last 24 Hours</option>
            <option value="168">Last Week</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading chart data...</div>
        ) : telemetryData.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>No telemetry data available for the selected time range.</p>
          </div>
        ) : (
          <div className="chart-container">
            <h4>Current Reading (A)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart 
                data={telemetryData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={Math.floor(telemetryData.length / getTickCount())}
                />
                <YAxis tick={{ fontSize: 12 }} width={40} />
                <Tooltip content={<CurrentTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#2196F3" 
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>

            <h4>Switch State</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart 
                data={telemetryData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={Math.floor(telemetryData.length / getTickCount())}
                />
                <YAxis 
                  domain={[0, 1]} 
                  ticks={[0, 1]}
                  tickFormatter={(value) => value === 1 ? 'ON' : 'OFF'}
                  tick={{ fontSize: 12 }}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="stepAfter" 
                  dataKey="state" 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceChart;