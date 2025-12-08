import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Data represents a standard fair launch distribution
const data = [
  { name: '自然流动', value: 76, color: '#FFD700' }, // Gold
  { name: '社区激励/空投', value: 15, color: '#F59E0B' }, // Orange
  { name: '营销', value: 9, color: '#3B82F6' }, // Blue
];

interface StatsChartProps {
  isDark: boolean;
}

export const StatsChart: React.FC<StatsChartProps> = ({ isDark }) => {
  return (
    <div className="w-full h-[300px] md:h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            className="text-xs md:text-sm font-bold font-sans"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                className="hover:opacity-80 transition-opacity cursor-pointer"
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
              borderColor: 'transparent',
              borderRadius: '16px',
              color: isDark ? '#FFF' : '#000',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }} 
            itemStyle={{ color: isDark ? '#FFF' : '#000', fontWeight: 600 }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="mx-2 font-medium">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};