import Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { View } from 'react-native'
import { color, displayFont } from '../components/theme'

export default function Layout() {
  const [loaded, error] = useFonts({
    [displayFont]: require('../assets/BarlowCondensed-Bold.ttf'),
    ...Feather.font,
  })

  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: color.paper }} />

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }} />
}
