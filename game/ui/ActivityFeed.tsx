// Game log: repeated messages collapse into one row (×N), grouped by game day
// (port of the web's components/game/ActivityFeed.js).
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, Chips, Empty, TabHeader, s } from './kit';

export type Note = { id: string; message: string; day: number; isSpecial: boolean; type: string };

const FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'special' as const, label: 'Important' },
  { id: 'achievement' as const, label: 'Wins' },
  { id: 'marketing' as const, label: 'Marketing' },
  { id: 'facility' as const, label: 'Facilities' },
  { id: 'guest_review' as const, label: 'Reviews' },
];

const toneFor = (n: Note): [string, string] => {
  if (n.type === 'urgent' || n.type === 'error') return ['#fb7185', C.redSoft];
  if (n.type === 'warning') return ['#fbbf24', C.amberSoft];
  if (n.type === 'achievement' || n.type === 'levelup') return ['#facc15', '#fefce8'];
  if (n.isSpecial) return ['#818cf8', C.indigoSoft];
  return [C.line, '#fff'];
};

export default function ActivityFeed({ notifications, onClear }: { notifications: Note[]; onClear: () => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');

  const groups = useMemo(() => {
    const list = filter === 'all' ? notifications : notifications.filter((n) => (filter === 'special' ? n.isSpecial : n.type === filter));
    const byDay = new Map<number, (Note & { count: number })[]>();
    for (const n of [...list].sort((a, b) => b.day - a.day)) {
      if (!byDay.has(n.day)) byDay.set(n.day, []);
      const rows = byDay.get(n.day)!;
      const same = rows.find((r) => r.message === n.message);
      if (same) same.count += 1;
      else rows.push({ ...n, count: 1 });
    }
    return [...byDay.entries()].slice(0, 30);
  }, [notifications, filter]);

  return (
    <View>
      <View style={s.between}>
        <TabHeader icon="🔔" title="Activity" />
        {notifications.length > 0 && (
          <Pressable onPress={onClear}>
            <Text style={{ fontSize: 12, color: C.faint }}>Clear</Text>
          </Pressable>
        )}
      </View>
      <View style={{ marginBottom: 12 }}>
        <Chips options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      {groups.length === 0 ? (
        <Empty>Nothing here yet. Press Play to open your doors!</Empty>
      ) : (
        groups.map(([day, rows]) => (
          <View key={day} style={{ marginBottom: 12 }}>
            <Text style={[s.tiny, { fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 }]}>DAY {day}</Text>
            {rows.map((n) => {
              const [border, bg] = toneFor(n);
              return (
                <Text key={n.id} style={{ backgroundColor: bg, borderLeftWidth: 4, borderLeftColor: border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#334155', marginBottom: 4 }}>
                  {n.message}
                  {n.count > 1 ? <Text style={{ fontSize: 11, fontWeight: '700', color: C.sub }}>{`  ×${n.count}`}</Text> : null}
                </Text>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}
