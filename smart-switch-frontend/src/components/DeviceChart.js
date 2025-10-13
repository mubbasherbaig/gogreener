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

  // Format time based on selected range - MUCH MORE PROMINENT
  const formatTimeForRange = (timestamp, hours) => {
    const date = new Date(timestamp);
    
    if (hours <= 6) {
      // For short ranges: show only time
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      // For longer ranges: show date AND time on separate lines
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
          fullTime: new Date(item.timestamp).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
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

  // BOLD Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          padding: '12px 16px', 
          border: '2px solid #4CAF50',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
            📅 {data.fullTime}
          </p>
          <p style={{ margin: 0, color: '#4CAF50', fontSize: '14px', fontWeight: 'bold' }}>
            ⚡ State: {data.stateText}
          </p>
        </div>
      );
    }
    return null;
  };

  // BOLD Current tooltip
  const CurrentTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          padding: '12px 16px', 
          border: '2px solid #2196F3',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
            📅 {data.fullTime}
          </p>
          <p style={{ margin: 0, color: '#2196F3', fontSize: '14px', fontWeight: 'bold' }}>
            ⚡ Current: {data.current.toFixed(2)} A
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate tick count based on screen size
  const getTickCount = () => {
    const isMobile = window.innerWidth < 768;
    const dataLength = telemetryData.length;
    
    if (isMobile) {
      return Math.min(5, dataLength);
    } else {
      return Math.min(10, dataLength);
    }
  };

  // Custom tick component for BOLD labels
  const CustomAxisTick = ({ x, y, payload }) => {
    const lines = payload.value.split('\n');
    
    return (
      <g transform={`translate(${x},${y})`}>
        {lines.map((line, index) => (
          <text
            key={index}
            x={0}
            y={index * 16 + 10}
            textAnchor="middle"
            fill="#000"
            fontSize="13px"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  // Custom Y-axis tick for BOLD labels
  const CustomYAxisTick = ({ x, y, payload }) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={-5}
          y={0}
          dy={4}
          textAnchor="end"
          fill="#000"
          fontSize="13px"
          fontWeight="700"
          fontFamily="Arial, sans-serif"
        >
          {payload.value}
        </text>
      </g>
    );
  };

  // Custom Y-axis tick for switch state
  const CustomStateYAxisTick = ({ x, y, payload }) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={-5}
          y={0}
          dy={4}
          textAnchor="end"
          fill="#000"
          fontSize="14px"
          fontWeight="900"
          fontFamily="Arial, sans-serif"
        >
          {payload.value === 1 ? 'ON' : 'OFF'}
        </text>
      </g>
    );
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
            <h4 style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3', marginBottom: '15px' }}>
              ⚡ Current Reading (A)
            </h4>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart 
                data={telemetryData}
                margin={{ top: 10, right: 20, left: 10, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd" strokeWidth={1.5} />
                <XAxis 
                  dataKey="time"
                  tick={<CustomAxisTick />}
                  height={70}
                  interval={Math.floor(telemetryData.length / getTickCount())}
                  stroke="#000"
                  strokeWidth={2}
                />
                <YAxis 
                  tick={<CustomYAxisTick />}
                  width={50}
                  stroke="#000"
                  strokeWidth={2}
                />
                <Tooltip content={<CurrentTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#2196F3" 
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>

            <h4 style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50', marginTop: '30px', marginBottom: '15px' }}>
              🔌 Switch State
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart 
                data={telemetryData}
                margin={{ top: 10, right: 20, left: 10, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd" strokeWidth={1.5} />
                <XAxis 
                  dataKey="time"
                  tick={<CustomAxisTick />}
                  height={70}
                  interval={Math.floor(telemetryData.length / getTickCount())}
                  stroke="#000"
                  strokeWidth={2}
                />
                <YAxis 
                  domain={[0, 1]} 
                  ticks={[0, 1]}
                  tick={<CustomStateYAxisTick />}
                  width={50}
                  stroke="#000"
                  strokeWidth={2}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="stepAfter" 
                  dataKey="state" 
                  stroke="#4CAF50" 
                  strokeWidth={4}
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