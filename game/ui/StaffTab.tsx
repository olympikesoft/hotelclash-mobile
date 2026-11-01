// Staff: staffing needs, the team (train / let go) and hiring
// (port of the web's components/game/StaffTab.js).
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { engineData, insights, type StaffRole, type TrainingProgram } from '../catalog';
import type { GameState, Staff } from '../types';
import { Button, C, Card, Meter, Pill, Section, Stat, StatRow, TabHeader, s, usd } from './kit';

// Roles the engine rewards directly when guests decide to book (tick.js staffBonus).
const BOOKING_ROLES: Record<string, string> = {
  Receptionist: '+12% bookings',
  'Marketing Director': '+15% bookings',
  Concierge: '+10% bookings',
  Manager: '+8% bookings',
};

function TeamMember({ e, money, trainingPrograms, onTrain, onFire, last }: { e: Staff; money: number; trainingPrograms: TrainingProgram[]; onTrain: (t: string, id: number) => void; onFire: (id: number) => void; last: boolean }) {
  const [panel, setPanel] = useState<'train' | 'fire' | null>(null);
  return (
    <Card>
      <View style={s.between}>
        <View style={[s.row, { flex: 1 }]}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
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
          <Button variant="danger" onPress={() => setPanel(panel === 'fire' ? null : 'fire')}>
            ✕
          </Button>
        </View>
      </View>
      <View style={[s.row, { gap: 12, marginTop: 10 }]}>
        {[
          ['Skill', e.skill, C.indigo],
          ['Morale', e.happiness, undefined],
        ].map(([label, v, tone]) => (
          <View key={label as string} style={{ flex: 1 }}>
            <View style={[s.between, { marginBottom: 4 }]}>
              <Text style={s.tiny}>{label}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>{(v as number).toFixed(1)}</Text>
            </View>
            <Meter value={v as number} tone={tone as string | undefined} />
          </View>
        ))}
      </View>
      {panel === 'train' && (
        <View style={{ marginTop: 10, gap: 6 }}>
          {trainingPrograms.map((t) => {
            const maxed = e.skill >= 5 && e.happiness >= 5;
            return (
              <Pressable
                key={t.id}
                disabled={money < t.cost || maxed}
                onPress={() => {
                  onTrain(t.id, e.id);
                  setPanel(null);
                }}
                style={[s.between, { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, opacity: money < t.cost || maxed ? 0.5 : 1 }]}
              >
                <Text style={{ flex: 1, fontSize: 12 }}>
                  <Text style={{ fontWeight: '700', color: '#1e293b' }}>{t.name}</Text>
                  <Text style={{ color: C.faint }}>
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
            {last ? `\n⚠ ${e.name} is your only staff member — with nobody working, your rating and bookings collapse.` : ''}
          </Text>
          <View style={[s.row, { gap: 8, marginTop: 8, justifyContent: 'flex-end' }]}>
            <Button variant="ghost" onPress={() => setPanel(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                onFire(e.id);
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
}

export default function StaffTab({
  game,
  staffRoles,
  trainingPrograms,
  hireStaff,
  fireStaff,
  conductTraining,
}: {
  game: GameState;
  staffRoles: StaffRole[];
  trainingPrograms: TrainingProgram[];
  hireStaff: (role: string) => void;
  fireStaff: (id: number) => void;
  conductTraining: (trainingId: string, staffId: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const money = game.money;
  const staff = game.staff;
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
  const visible = showAll ? ranked : ranked.filter((r) => BOOKING_ROLES[r.role] || unlocks[r.role] || counts[r.role]).slice(0, 9);

  return (
    <View>
      <TabHeader icon="👥" title="Staff" subtitle={ratioState.hint} />
      <StatRow>
        <Stat label="Team" value={staff.length} sub={`${game.rooms.length} rooms`} />
        <Stat label="Payroll" value={usd(payroll)} sub="per day" />
        <Stat label="Service level" value={`${Math.round(service * 100)}%`} sub={ratioState.label} tone={ratioState.tone} />
        <Stat label="Skill · morale" value={`${avg((e) => e.skill).toFixed(1)} · ${avg((e) => e.happiness).toFixed(1)}`} sub="out of 5" />
      </StatRow>

      {needs.some((n) => n.need > 0) && (
        <Section icon="🔧" title="Staffing needs">
          {needs.map((n) => (
            <Card key={n.id}>
              <View style={s.between}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }}>{n.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: n.have >= n.need ? C.green : C.red }}>{n.need ? `${n.have} / ${n.need}` : 'not needed yet'}</Text>
              </View>
              {n.need > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Meter value={n.coverage} max={1} />
                </View>
              )}
              {n.have < n.need && (
                <Button style={{ marginTop: 8 }} disabled={money < (staffRoles.find((r) => r.role === n.roles[0])?.baseSalary ?? Infinity)} onPress={() => hireStaff(n.roles[0])}>
                  ➕ Hire {n.roles[0]}
                </Button>
              )}
            </Card>
          ))}
        </Section>
      )}

      <Section icon="👥" title="Your team">
        {staff.length === 0 ? (
          <Text style={{ backgroundColor: C.redSoft, color: '#be123c', borderRadius: 12, padding: 14, fontSize: 13 }}>
            Nobody works here! Hire a Receptionist first — guests won't book an unstaffed hotel.
          </Text>
        ) : (
          staff.map((e) => <TeamMember key={e.id} e={e} money={money} trainingPrograms={trainingPrograms} onTrain={conductTraining} onFire={fireStaff} last={staff.length === 1} />)
        )}
      </Section>

      <Section
        icon="➕"
        title="Hire"
        hint="Hiring pays the first day's salary. You need 5 days of salary in the bank."
        action={
          <Pressable onPress={() => setShowAll((v) => !v)}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.indigo }}>{showAll ? 'Show recommended' : `All ${staffRoles.length} roles`}</Text>
          </Pressable>
        }
      >
        {visible.map((r) => {
          const need = r.baseSalary * 5;
          const can = money >= need;
          return (
            <Card key={r.role}>
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
        })}
      </Section>
    </View>
  );
}
