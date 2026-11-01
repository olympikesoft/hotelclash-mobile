// Coin shop (Google Play). Coins need an account: the server verifies every
// purchase and keeps the balance, so guests are asked to create one first.
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COIN_PACKS, buyCoins, useCoinShop } from '../platform/coinShop';
import { Button, C, s } from './kit';

export default function CoinShop({ open, signedIn, coins, onSignUp, onClose }: { open: boolean; signedIn: boolean; coins: number; onSignUp: () => void; onClose: () => void }) {
  const shop = useCoinShop();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.head}>
            <View style={s.between}>
              <Text style={st.title}>💎 Coins</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={st.sub}>You have {Math.round(coins).toLocaleString('en-US')} coins. Coins unlock premium facilities and count as cash when you buy something — even to clear debt.</Text>
          </View>
          <View style={{ padding: 16, gap: 10 }}>
            {!signedIn ? (
              <>
                <Text style={s.small}>Coins are kept in your account so they're never lost. Create a free account (and get 10,000 coins) to buy more.</Text>
                <Button big onPress={onSignUp}>
                  Create free account
                </Button>
              </>
            ) : (
              <>
                {COIN_PACKS.map((p) => {
                  const price = shop.prices[p.sku];
                  return (
                    <View key={p.sku} style={[st.pack, p.popular && st.popular]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.title}>
                          {p.label}
                          {p.popular ? '  ⭐ Popular' : ''}
                        </Text>
                        <Text style={s.tiny}>{p.coins.toLocaleString('en-US')} coins</Text>
                      </View>
                      <Button disabled={!price || Boolean(shop.busy)} busy={shop.busy === p.sku} onPress={() => buyCoins(p.sku)}>
                        {price || 'Unavailable'}
                      </Button>
                    </View>
                  );
                })}
                {shop.error ? <Text style={{ color: C.red, fontSize: 13 }}>{shop.error}</Text> : null}
                <Text style={s.tiny}>Paid with Google Play. Coins arrive in your hotel a moment after the purchase is confirmed.</Text>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', paddingBottom: 16 },
  head: { backgroundColor: '#86198f', paddingHorizontal: 18, paddingVertical: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  sub: { color: '#f5d0fe', fontSize: 13, marginTop: 4 },
  pack: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  popular: { borderColor: '#e879f9', backgroundColor: '#fdf4ff' },
});
