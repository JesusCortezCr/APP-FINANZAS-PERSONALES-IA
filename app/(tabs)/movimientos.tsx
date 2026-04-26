import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "ingreso" | "gasto">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarMovimientos();
  }, [filtro]);

  async function cargarMovimientos() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("movimiento")
      .select("*, categoria(nombre, icono)")
      .eq("usuario_id", user.id)
      .order("fecha", { ascending: false });

    if (filtro !== "todos") query = query.eq("tipo", filtro);

    const { data } = await query;
    if (data) setMovimientos(data);
    setLoading(false);
  }

  async function handleEliminar(id: string) {
    const { error } = await supabase.from("movimiento").delete().eq("id", id);
    if (!error) cargarMovimientos();
  }

  const totalMostrado = movimientos.reduce(
    (sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto),
    0,
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.titulo}>Mis movimientos</Text>

      {/* Filtros */}
      <View style={styles.filtros}>
        {(["todos", "ingreso", "gasto"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]}
            onPress={() => setFiltro(f)}
          >
            <Text
              style={[
                styles.filtroTexto,
                filtro === f && styles.filtroTextoActive,
              ]}
            >
              {f === "todos"
                ? "Todos"
                : f === "ingreso"
                  ? "↑ Ingresos"
                  : "↓ Gastos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Resumen filtrado */}
      <View style={styles.resumen}>
        <Text style={styles.resumenLabel}>
          {filtro === "todos"
            ? "Balance"
            : filtro === "ingreso"
              ? "Total ingresos"
              : "Total gastos"}
        </Text>
        <Text
          style={[
            styles.resumenMonto,
            { color: totalMostrado >= 0 ? "#22c55e" : "#ef4444" },
          ]}
        >
          S/ {Math.abs(totalMostrado).toFixed(2)}
        </Text>
      </View>

      {/* Lista */}
      {loading ? (
        <Text style={styles.loading}>Cargando...</Text>
      ) : movimientos.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioTexto}>No hay movimientos</Text>
        </View>
      ) : (
        movimientos.map((mov) => (
          <View key={mov.id} style={styles.movCard}>
            <View style={styles.movIcono}>
              <Text style={{ fontSize: 22 }}>
                {mov.categoria?.icono || "📦"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.movDesc}>
                {mov.descripcion || mov.categoria?.nombre}
              </Text>
              <Text style={styles.movMeta}>
                {mov.categoria?.nombre} · {mov.fecha}
              </Text>
              {mov.tipo_registro === "ia" && (
                <Text style={styles.iaBadge}>✨ Registrado con IA</Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[
                  styles.movMonto,
                  { color: mov.tipo === "ingreso" ? "#22c55e" : "#ef4444" },
                ]}
              >
                {mov.tipo === "ingreso" ? "+" : "-"} S/ {mov.monto.toFixed(2)}
              </Text>
              <TouchableOpacity onPress={() => handleEliminar(mov.id)}>
                <Text style={styles.eliminar}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    paddingTop: 60,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 20,
  },
  filtros: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filtroBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  filtroBtnActive: { backgroundColor: "#6C63FF", borderColor: "#6C63FF" },
  filtroTexto: { fontSize: 13, fontWeight: "500", color: "#666" },
  filtroTextoActive: { color: "#fff" },
  resumen: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  resumenLabel: { fontSize: 13, color: "#666", marginBottom: 4 },
  resumenMonto: { fontSize: 28, fontWeight: "bold" },
  loading: { textAlign: "center", color: "#999", marginTop: 40 },
  vacio: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 40,
    alignItems: "center",
  },
  vacioTexto: { fontSize: 15, color: "#666" },
  movCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  movIcono: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  movDesc: { fontSize: 14, fontWeight: "500", color: "#1a1a1a" },
  movMeta: { fontSize: 12, color: "#999", marginTop: 2 },
  iaBadge: { fontSize: 11, color: "#6C63FF", marginTop: 3 },
  movMonto: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  eliminar: { fontSize: 11, color: "#ef4444" },
});
