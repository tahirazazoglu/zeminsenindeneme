import Feather from '@expo/vector-icons/Feather'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { applicationLabels, dayKey, dayLabel, money, movementLabels, timeLabel, type Dashboard } from '@zemin/pilot'
import { Button, SectionTabs } from './student-controls'
import { color, displayFont } from './theme'

const filters = ['Tümü', 'Girişler', 'Çıkışlar'] as const

export function Wallet({ data, openApplications }: { data: Dashboard; openApplications: () => void }) {
  const [filter, setFilter] = useState<typeof filters[number]>('Tümü')
  const held = data.applications.filter(item => item.mine && (item.status === 'pending' || item.status === 'accepted'))
  const heldTotal = held.reduce((total, item) => total + item.price, 0)
  const listings = new Map(data.listings.map(item => [item.id, item]))
  const movements = data.movements.filter(item => filter === 'Tümü' || (filter === 'Girişler' ? item.amount > 0 : item.amount < 0))
  const byDay = new Map<string, Dashboard['movements']>()
  for (const move of movements) {
    const day = dayKey(move.created_at)
    const group = byDay.get(day)
    if (group) group.push(move)
    else byDay.set(day, [move])
  }

  return <View style={styles.stack}>
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>Kullanılabilir test bakiyesi</Text>
      <Text style={styles.balance}>{money(data.balance)}</Text>
      <View style={styles.balanceDivider}>
        <Text style={styles.balanceLabel}>Bloke tutarı</Text>
        <Text style={styles.heldTotal}>{money(heldTotal)}</Text>
      </View>
    </View>

    {held.length > 0 && <View style={styles.stack}>
      <Text accessibilityRole="header" style={styles.heading}>Açık blokeler</Text>
      <View style={styles.list}>
        {held.map(request => <View style={styles.line} key={request.id}>
          <View style={styles.lineCopy}>
            <Text style={styles.lineTitle}>{listings.get(request.listing)?.facility_name ?? 'Katılım blokesi'}</Text>
            <Text style={styles.muted}>{applicationLabels[request.status]}</Text>
          </View>
          <Text style={styles.value}>{money(request.price)}</Text>
        </View>)}
      </View>
      <Button secondary label="Başvurularımı gör" onPress={openApplications} />
    </View>}

    <View style={styles.stack}>
      <Text accessibilityRole="header" style={styles.heading}>Son hareketler</Text>
      <SectionTabs items={filters} selected={filter} onSelect={setFilter} />
      {movements.length === 0 && <Text style={styles.muted}>Bu görünümde hareket yok.</Text>}
      {Array.from(byDay, ([id, entries]) => <View key={id} style={styles.ledgerGroup}>
        <Text accessibilityRole="header" style={styles.day}>{dayLabel(entries[0].created_at)}</Text>
        <View style={styles.list}>
          {entries.map(move => <View style={styles.line} key={move.id}>
            <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
              <Feather name={move.amount > 0 ? 'arrow-down-left' : move.amount < 0 ? 'arrow-up-right' : 'minus'}
                size={16} color={color.action} />
            </View>
            <View style={styles.lineCopy}>
              <Text style={styles.lineTitle}>{movementLabels[move.kind] ?? move.kind}</Text>
              <Text style={styles.muted}>{timeLabel(move.created_at)}</Text>
            </View>
            <Text style={[styles.value, move.amount > 0 && styles.credit]}>
              {move.amount > 0 ? '+' : ''}{money(move.amount)}
            </Text>
          </View>)}
        </View>
      </View>)}
    </View>
  </View>
}

const styles = StyleSheet.create({
  stack: { gap: 13 },
  heading: { color: color.ink, fontFamily: displayFont, fontSize: 25 },
  balanceCard: { backgroundColor: color.forest, borderRadius: 15, padding: 18, gap: 3 },
  balanceLabel: { color: color.onDark, fontSize: 14 },
  balance: { color: color.accent, fontFamily: displayFont, fontSize: 45, fontVariant: ['tabular-nums'] },
  balanceDivider: { borderTopColor: '#526857', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 7, paddingTop: 9, marginTop: 7 },
  heldTotal: { color: color.surface, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
  ledgerGroup: { gap: 6 },
  day: { color: color.muted, fontWeight: '800', fontSize: 13 },
  list: { borderTopColor: color.line, borderTopWidth: 1 },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 56, paddingVertical: 8, borderBottomColor: color.line, borderBottomWidth: 1 },
  lineCopy: { flexGrow: 1, flexShrink: 1, minWidth: 105, gap: 2 },
  lineTitle: { color: color.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: color.muted, fontSize: 13, lineHeight: 18 },
  value: { color: color.ink, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  icon: { backgroundColor: color.tint, borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  credit: { color: color.action },
})
