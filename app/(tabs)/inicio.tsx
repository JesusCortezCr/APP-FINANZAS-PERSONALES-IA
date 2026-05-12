import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, StatusBar, SafeAreaView } from "react-native";
import { supabase } from "../../lib/supabase";

function normalizarTipo(tipo?: string | null) {
  return String(tipo || "").trim().toLowerCase();
}
function montoAbsoluto(monto: number | string) {
  return Math.abs(Number(monto) || 0);
}
function money(v: number) { return `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`; }

export default function Inicio() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [totalGastos, setTotalGastos] = useState(0);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [ahorroTotal, setAhorroTotal] = useState(0);

  const cargarDatos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfil").select("nombre").eq("id", user.id).single();
    if (perfil?.nombre) setNombre(perfil.nombre);

    const mesActual = new Date().toISOString().slice(0, 7);

    const { data: movs } = await supabase
      .from("movimiento")
      .select("id, categoria_id, tipo, monto, fecha, descripcion, created_at")
      .eq("usuario_id", user.id)
      .order("fecha", { ascending: false });

    const todos = (movs || []);
    const delMes = todos.filter(m => String(m.fecha || "").startsWith(mesActual));

    const ing = delMes.filter(m => normalizarTipo(m.tipo) === "ingreso")
      .reduce((s, m) => s + montoAbsoluto(m.monto), 0);
    const gas = delMes.filter(m => normalizarTipo(m.tipo) === "gasto")
      .reduce((s, m) => s + montoAbsoluto(m.monto), 0);
    const ahorro = todos
      .filter(m => normalizarTipo(m.tipo) === "ingreso")
      .reduce((s, m) => s + montoAbsoluto(m.monto), 0)
      - todos
        .filter(m => normalizarTipo(m.tipo) === "gasto")
        .reduce((s, m) => s + montoAbsoluto(m.monto), 0);

    setTotalIngresos(ing);
    setTotalGastos(gas);
    setAhorroTotal(ahorro);

    const catIds = [...new Set(todos.slice(0, 5).map(m => m.categoria_id).filter(Boolean))];
    let catMap: Record<string, any> = {};
    if (catIds.length > 0) {
      const { data: cats } = await supabase.from("categoria").select("id, nombre, icono").in("id", catIds);
      catMap = Object.fromEntries((cats || []).map(c => [c.id, c]));
    }
    setMovimientos(todos.slice(0, 5).map(m => ({ ...m, categoria: catMap[m.categoria_id] || null })));
  }, []);

  useFocusEffect(useCallback(() => { cargarDatos(); }, [cargarDatos]));

  const saldo = totalIngresos - totalGastos;
  const mesNombre = new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const inicial = nombre ? nombre[0].toUpperCase() : "U";

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* Cabecera Ultra-Limpia */}
        <View style={s.headerBg}>
          <SafeAreaView>
            <View style={s.headerTop}>
              <View style={s.userInfo}>
                <Text style={s.saludoLabel}>Hola de nuevo,</Text>
                <Text style={s.saludoName} numberOfLines={1}>{nombre || "Usuario"}</Text>
              </View>
              <TouchableOpacity style={s.avatar} onPress={() => router.push("/(tabs)/perfil")}>
                <Text style={s.avatarTxt}>{inicial}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Balance Principal */}
        <View style={s.balanceCard}>
          <View style={s.rowBet}>
            <Text style={s.balanceLabel}>RESUMEN DE {mesNombre.toUpperCase()}</Text>
            <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
          </View>
          <Text style={[s.balanceAmount, { color: saldo >= 0 ? "#1e293b" : "#ef4444" }]}>
            {saldo < 0 ? "-" : ""}{money(Math.abs(saldo))}
          </Text>
          
          <View style={s.rowStats}>
            <View style={s.statBox}>
              <View style={[s.statIcon, { backgroundColor: "#f0fdf4" }]}><Ionicons name="arrow-up" size={12} color="#22c55e" /></View>
              <View>
                <Text style={s.statLab}>Ingresos</Text>
                <Text style={[s.statVal, { color: "#22c55e" }]}>{money(totalIngresos)}</Text>
              </View>
            </View>
            <View style={s.statBox}>
              <View style={[s.statIcon, { backgroundColor: "#fef2f2" }]}><Ionicons name="arrow-down" size={12} color="#ef4444" /></View>
              <View>
                <Text style={s.statLab}>Gastos</Text>
                <Text style={[s.statVal, { color: "#ef4444" }]}>{money(totalGastos)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tarjeta de Ahorro con Estilo */}
        <View style={s.section}>
          <TouchableOpacity 
            activeOpacity={0.9}
            style={[s.ahorroCard, { backgroundColor: ahorroTotal >= 0 ? "#1e293b" : "#f59e0b" }]}
            onPress={() => router.push("/(tabs)/reportes")}
          >
            <View style={s.ahorroIcon}>
              <Ionicons name="wallet" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ahorroLab}>Ahorro histórico total</Text>
              <Text style={s.ahorroVal}>{money(Math.max(0, ahorroTotal))}</Text>
            </View>
            <View style={s.ahorroBadge}><Ionicons name="chevron-forward" size={18} color="#fff" /></View>
          </TouchableOpacity>
        </View>

        {/* Actividad Reciente */}
        <View style={s.section}>
          <View style={s.secHeader}>
            <Text style={s.secTitle}>Actividad Reciente</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/movimientos")}>
              <Text style={s.secAction}>Ver historial</Text>
            </TouchableOpacity>
          </View>

          {movimientos.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={32} color="#cbd5e1" />
              <Text style={s.emptyTxt}>Sin movimientos recientes</Text>
            </View>
          ) : movimientos.map((mov) => (
            <View key={mov.id} style={s.movItem}>
              <View style={s.movIconWrap}><Text style={{ fontSize: 22 }}>{mov.categoria?.icono || "💰"}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.movDesc} numberOfLines={1}>{mov.descripcion || mov.categoria?.nombre || "Gasto"}</Text>
                <Text style={s.movSub}>{mov.categoria?.nombre} · {new Date(mov.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</Text>
              </View>
              <Text style={[s.movAmt, { color: normalizarTipo(mov.tipo) === "ingreso" ? "#22c55e" : "#1e293b" }]}>
                {normalizarTipo(mov.tipo) === "ingreso" ? "+" : "-"}{money(montoAbsoluto(mov.monto))}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  headerBg: { backgroundColor: "#6366f1", paddingTop: 10, paddingBottom: 110, borderBottomLeftRadius: 44, borderBottomRightRadius: 44 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 28, marginTop: 15 },
  userInfo: { flex: 1 },
  saludoLabel: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "700", letterSpacing: 0.5 },
  saludoName: { fontSize: 28, fontWeight: "900", color: "#fff", marginTop: 4, letterSpacing: -0.5 },
  avatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)" },
  avatarTxt: { fontSize: 22, fontWeight: "900", color: "#fff" },
  balanceCard: { backgroundColor: "#fff", borderRadius: 36, padding: 28, marginHorizontal: 24, marginTop: -80, shadowColor: "#6366f1", shadowOpacity: 0.12, shadowRadius: 25, elevation: 12 },
  rowBet: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  balanceLabel: { fontSize: 10, fontWeight: "800", color: "#94a3b8", letterSpacing: 1.2 },
  balanceAmount: { fontSize: 44, fontWeight: "900", letterSpacing: -1.5 },
  rowStats: { flexDirection: "row", marginTop: 28, gap: 14 },
  statBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f8fafc", padding: 14, borderRadius: 20 },
  statIcon: { width: 26, height: 26, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statLab: { fontSize: 10, color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" },
  statVal: { fontSize: 13, fontWeight: "800", marginTop: 1 },
  section: { marginTop: 32, paddingHorizontal: 24 },
  ahorroCard: { borderRadius: 28, padding: 24, flexDirection: "row", alignItems: "center", gap: 18, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 15, elevation: 4 },
  ahorroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  ahorroLab: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  ahorroVal: { fontSize: 24, fontWeight: "900", color: "#fff", marginTop: 2 },
  ahorroBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  secHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingHorizontal: 4 },
  secTitle: { fontSize: 20, fontWeight: "900", color: "#1e293b" },
  secAction: { fontSize: 14, color: "#6366f1", fontWeight: "800" },
  movItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 24, padding: 16, marginBottom: 12, gap: 14, borderWidth: 1, borderColor: "#f1f5f9" },
  movIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center" },
  movDesc: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  movSub: { fontSize: 12, color: "#94a3b8", marginTop: 3, fontWeight: "600" },
  movAmt: { fontSize: 16, fontWeight: "900" },
  empty: { alignItems: "center", padding: 40, opacity: 0.5 },
  emptyTxt: { fontSize: 14, color: "#94a3b8", fontWeight: "600", marginTop: 12 },
});
