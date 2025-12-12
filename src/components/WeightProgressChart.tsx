import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface WeightEntry {
  id: string;
  weight_kg: number;
  recorded_at: string;
}

interface WeightProgressChartProps {
  data: WeightEntry[];
  heightCm: number | null;
  goalWeight: number | null;
}

export function WeightProgressChart({ data, heightCm, goalWeight }: WeightProgressChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];
    
    return data
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map(entry => {
        const bmi = heightCm ? (entry.weight_kg / Math.pow(heightCm / 100, 2)) : null;
        return {
          date: format(new Date(entry.recorded_at), 'MMM d'),
          weight: Math.round(entry.weight_kg * 10) / 10,
          bmi: bmi ? Math.round(bmi * 10) / 10 : null,
          goal: goalWeight ? Math.round(goalWeight * 10) / 10 : null
        };
      });
  }, [data, heightCm, goalWeight]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No weight history yet. Update your weight to start tracking progress.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Weight Progress</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="date" 
              className="text-xs" 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs" 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="weight" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))' }}
              name="Weight (kg)"
            />
            {goalWeight && (
              <Line 
                type="monotone" 
                dataKey="goal" 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Goal (kg)"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {heightCm && (
        <div>
          <h4 className="text-sm font-medium mb-3">BMI Progress</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="date" 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[15, 35]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line 
                type="monotone" 
                dataKey="bmi" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-2))' }}
                name="BMI"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Underweight: &lt;18.5</span>
            <span>Normal: 18.5-24.9</span>
            <span>Overweight: 25-29.9</span>
            <span>Obese: ≥30</span>
          </div>
        </div>
      )}
    </div>
  );
}