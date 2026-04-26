import { Tabs } from "expo-router";
import React from "react";


export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="inicio" options={{ title: "Inicio" }} />
      <Tabs.Screen name="movimientos" options={{ title: "Movimientos" }} />
      <Tabs.Screen name="agregar" options={{ title: "Agregar" }} />
      <Tabs.Screen name="reportes" options={{ title: "Reportes" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
