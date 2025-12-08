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
            innerRadius={80}
            outerRadius={120}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
            cornerRadius={8}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                className="hover:opacity-80 transition-opacity cursor-pointer filter drop-shadow-md"
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? 'rgba(20, 20, 20, 0.8)' : 'rgba(255, 255, 255, 0.8)', 
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderRadius: '16px',
              color: isDark ? '#FFF' : '#000',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
              padding: '12px'
            }} 
            itemStyle={{ color: isDark ? '#FFF' : '#000', fontWeight: 600, fontSize: '14px' }}
            cursor={false}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="mx-2 font-bold text-sm text-neutral-600 dark:text-neutral-300">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};