// Staff: staffing needs, the team (train / let go) and hiring
// (port of the web's components/game/StaffTab.js).
// Team and Hire are separate views, so hiring doesn't sit below a long team;
// the team is a virtualized FlatList of memoized rows (see RoomsTab for why).
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { engineData, insights, type StaffRole, type TrainingProgram } from '../catalog';
import type { GameState, Staff } from '../types';
import { Button, C, Card, Chips, Meter, Pill, Section, Stat, StatRow, TabHeader, s, usd } from './kit';

// Roles the engine rewards directly when guests decide to book (tick.js staffBonus).
const BOOKING_ROLES: Record<string, string> = {
  Receptionist: '+12% bookings',
  'Marketing Director': '+15% bookings',
  Concierge: '+10% bookings',
  Manager: '+8% bookings',
};

type MemberProps = {
  id: number;
  name: string;
  role: string;
  salary: number;
  skill: number;
  happiness: number;
  /** One flag per training program: can the player afford it right now? */
  affordable: string;
  last: boolean;
  trainingPrograms: TrainingProgram[];
  onTrain: (trainingId: string, staffId: number) => void;
  onFire: (staffId: number) => void;
};

const TeamMember = memo(function TeamMember(e: MemberProps) {
  const [panel, setPanel] = useState<'train' | 'fire' | null>(null);
  const maxed = e.skill >= 5 && e.happiness >= 5;
  return (
    <Card>
      <View style={s.between}>
        <View style={[s.row, { flex: 1 }]}>
          <View style={st.avatar}>
            <Text style={{ fontWeight: '700', color: '#4338ca' }}>{e.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={s.small}>
              {e.role} · {usd(e.salary)}/day
            </Text>
          </View>
        </View>
        <View style={[s.row, { gap: 6 }]}>
          <Button variant="ghost" onPress={() => setPanel(panel === 'train' ? null : 'train')}>
            🎓 Train
          </Button>
          <Button variant="danger" onPress={() => setPanel(panel === 'fire' ? null : 'fire')} accessibilityLabel={`Let ${e.name} go`}>
            ✕
          </Button>
        </View>
      </View>
      <View style={[s.row, { gap: 12, marginTop: 10 }]}>
        {(
          [
            ['Skill', e.skill, C.indigo],
            ['Morale', e.happiness, undefined],
          ] as const
        ).map(([label, v, tone]) => (
          <View key={label} style={{ flex: 1 }}>
            <View style={[s.between, { marginBottom: 4 }]}>
              <Text style={s.tiny}>{label}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>{v.toFixed(1)}</Text>
            </View>
            <Meter value={v} tone={tone} />
          </View>
        ))}
      </View>
      {panel === 'train' && (
        <View style={{ marginTop: 10, gap: 6 }}>
          {e.trainingPrograms.map((t, i) => {
            const off = e.affordable[i] !== '1' || maxed;
            return (
              <Pressable
                key={t.id}
                disabled={off}
                onPress={() => {
                  e.onTrain(t.id, e.id);
                  setPanel(null);
                }}
                style={[s.between, st.option, off && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityState={{ disabled: off }}
              >
                <Text style={{ flex: 1, fontSize: 12 }}>
                  <Text style={{ fontWeight: '700', color: '#1e293b' }}>{t.name}</Text>
                  <Text style={{ color: C.sub }}>
                    {'  '}+{t.skillBoost} skill · +{t.happiness} morale
                  </Text>
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>{usd(t.cost)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {panel === 'fire' && (
        <View style={{ marginTop: 10, backgroundColor: C.redSoft, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: '#9f1239' }}>
            Let {e.name} go? Saves {usd(e.salary)}/day.
            {e.last ? `\n⚠ ${e.name} is your only staff member — with nobody working, your rating and bookings collapse.` : ''}
          </Text>
          <View style={[s.row, { gap: 8, marginTop: 8, justifyContent: 'flex-end' }]}>
            <Button variant="ghost" onPress={() => setPanel(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                e.onFire(e.id);
                setPanel(null);
              }}
            >
              Let go
            </Button>
          </View>
        </View>
      )}
    </Card>
  );
});

const VIEWS = [
  { id: 'team' as const, label: 'Team' },
  { id: 'hire' as const, label: 'Hire' },
];

export default function StaffTab({
  game,
  staffRoles,
  trainingPrograms,
  hireStaff,
  fireStaff,
  conductTraining,
  top,
}: {
  game: GameState;
  staffRoles: StaffRole[];
  trainingPrograms: TrainingProgram[];
  hireStaff: (role: string) => void;
  fireStaff: (id: number) => void;
  conductTraining: (trainingId: string, staffId: number) => void;
  top?: React.ReactNode;
}) {
  const staff = game.staff;
  const [view, setView] = useState<'team' | 'hire'>(staff.length ? 'team' : 'hire');
  const [showAll, setShowAll] = useState(false);
  const [role, setRole] = useState<string>('all');
  const money = game.money;

  const actions = useRef({ fireStaff, conductTraining });
  actions.current = { fireStaff, conductTraining };
  const onFire = useCallback((id: number) => actions.current.fireStaff(id), []);
  const onTrain = useCallback((t: string, id: number) => actions.current.conductTraining(t, id), []);

  const payroll = staff.reduce((t, e) => t + e.salary, 0);
  const avg = (fn: (e: Staff) => number) => (staff.length ? staff.reduce((t, e) => t + fn(e), 0) / staff.length : 0);
  const ratio = game.rooms.length ? staff.length / game.rooms.length : 0;
  const { needs, service } = insights.staffing(game) as { needs: { id: string; label: string; have: number; need: number; coverage: number; roles: string[] }[]; service: number };
  const ratioState =
    service < 0.6
      ? { label: 'Understaffed', tone: C.red, hint: 'Your core team is far too small: guests are unhappy and bookings drop. Hire the roles below.' }
      : service < 0.95
      ? { label: 'Short-handed', tone: C.amber, hint: 'Some core roles are short — guest moods and bookings suffer until you hire.' }
      : ratio > 0.5
      ? { label: 'Overstaffed', tone: C.amber, hint: 'More staff than the rooms need — payroll is eating your profit.' }
      : { label: 'Fully staffed', tone: C.green, hint: 'Core team covers the hotel. Guests book more with a full team.' };

  // Roles that unlock facilities the player doesn't have yet.
  const unlocks = useMemo(() => {
    const built = new Set(game.facilities.map((f) => f.name));
    const out: Record<string, string[]> = {};
    for (const ft of engineData.FACILITY_TYPES) {
      if (built.has(ft.type) || ft.baseCost > Math.max(money * 3, 300000)) continue;
      for (const req of ft.requiredStaff || []) (out[req.role] = out[req.role] || []).push(ft.type);
    }
    return out;
  }, [game.facilities, money]);

  const counts: Record<string, number> = {};
  for (const e of staff) counts[e.role] = (counts[e.role] || 0) + 1;
  const ranked = [...staffRoles].sort((a, b) => {
    const score = (r: StaffRole) => (BOOKING_ROLES[r.role] ? 2 : 0) + (unlocks[r.role] ? 1 : 0);
    return score(b) - score(a) || a.baseSalary - b.baseSalary;
  });
  const visibleRoles = showAll ? ranked : ranked.filter((r) => BOOKING_ROLES[r.role] || unlocks[r.role] || counts[r.role]).slice(0, 9);
  const roleFilters = [{ id: 'all', label: `All ${staff.length}` }, ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([r, n]) => ({ id: r, label: `${r} ${n}` }))];
  const team = role === 'all' ? staff : staff.filter((e) => e.role === role);
  const affordable = trainingPrograms.map((t) => (money >= t.cost ? '1' : '0')).join('');

  const header = (
    <View>
      {top}
      <TabHeader icon="👥" title="Staff" subtitle={ratioState.hint} />
      <StatRow>
        <Stat label="Team" value={staff.length} sub={`${game.rooms.length} rooms`} />
        <Stat label="Payroll" value={usd(payroll)} sub="per day" />
        <Stat label="Service level" value={`${Math.round(service * 100)}%`} sub={ratioState.label} tone={ratioState.tone} />
        <Stat label="Skill · morale" value={`${avg((e) => e.skill).toFixed(1)} · ${avg((e) => e.happiness).toFixed(1)}`} sub="out of 5" />
      </StatRow>

      {needs.some((n) => n.need > 0 && n.have < n.need) && (
        <Section icon="🔧" title="Staffing needs">
          {needs
            .filter((n) => n.need > 0)
            .map((n) => (
              <Card key={n.id}>
                <View style={s.between}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>{n.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: n.have >= n.need ? C.green : C.red }}>
                    {n.have} / {n.need}
                  </Text>
                </View>
                <View style={{ marginTop: 8 }}>
                  <Meter value={n.coverage} max={1} />
                </View>
                {n.have < n.need && (
                  <Button style={{ marginTop: 8 }} disabled={money < (staffRoles.find((r) => r.role === n.roles[0])?.baseSalary ?? Infinity)} onPress={() => hireStaff(n.roles[0])}>
                    ➕ Hire {n.roles[0]}
                  </Button>
                )}
              </Card>
            ))}
        </Section>
      )}

      <View style={{ marginBottom: 10 }}>
        <Chips options={VIEWS} value={view} onChange={setView} />
      </View>
      {view === 'team' && staff.length > 0 && roleFilters.length > 2 && (
        <View style={{ marginBottom: 10 }}>
          <Chips options={roleFilters} value={role} onChange={setRole} />
        </View>
      )}
      {view === 'team' && staff.length === 0 && (
        <Text style={st.nobody}>Nobody works here! Hire a Receptionist first — guests won't book an unstaffed hotel.</Text>
      )}
      {view === 'hire' && (
        <View style={[s.between, { marginBottom: 8 }]}>
          <Text style={[s.small, { flex: 1 }]}>Hiring pays the first day's salary. You need 5 days of salary in the bank.</Text>
          <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.indigo }}>{showAll ? 'Recommended' : `All ${staffRoles.length}`}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (view === 'hire') {
    return (
      <FlatList
        data={visibleRoles}
        keyExtractor={(r) => r.role}
        ListHeaderComponent={header}
        contentContainerStyle={st.list}
        renderItem={({ item: r }) => {
          const need = r.baseSalary * 5;
          const can = money >= need;
          return (
            <Card>
              <View style={s.row}>
                <Text style={s.icon}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{r.role}</Text>
                  <Text style={s.tiny}>
                    {usd(r.baseSalary)}/day{counts[r.role] ? ` · ${counts[r.role]} on team` : ''}
                  </Text>
                </View>
              </View>
              <Text style={[s.small, { marginTop: 6 }]} numberOfLines={2}>
                {r.description}
              </Text>
              <View style={[s.row, { flexWrap: 'wrap', gap: 4, marginTop: 6 }]}>
                {BOOKING_ROLES[r.role] && <Pill tone="green">📈 {BOOKING_ROLES[r.role]}</Pill>}
                {(unlocks[r.role] || []).slice(0, 2).map((f) => (
                  <Pill key={f} tone="violet">
                    🔧 {f}
                  </Pill>
                ))}
              </View>
              <Button style={{ marginTop: 10 }} disabled={!can} onPress={() => hireStaff(r.role)}>
                {can ? `➕ Hire · ${usd(r.baseSalary)}` : `Need ${usd(need)} in bank`}
              </Button>
            </Card>
          );
        }}
      />
    );
  }

  return (
    <FlatList
      data={team}
      keyExtractor={(e) => String(e.id)}
      ListHeaderComponent={header}
      contentContainerStyle={st.list}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews
      renderItem={({ item: e }) => (
        <TeamMember
          id={e.id}
          name={e.name}
          role={e.role}
          salary={e.salary}
          skill={e.skill}
          happiness={e.happiness}
          affordable={affordable}
          last={staff.length === 1}
          trainingPrograms={trainingPrograms}
          onTrain={onTrain}
          onFire={onFire}
        />
      )}
    />
  );
}

const st = StyleSheet.create({
  list: { padding: 12, paddingBottom: 24 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  option: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, minHeight: 44 },
  nobody: { backgroundColor: C.redSoft, color: '#be123c', borderRadius: 12, padding: 14, fontSize: 13 },
});
