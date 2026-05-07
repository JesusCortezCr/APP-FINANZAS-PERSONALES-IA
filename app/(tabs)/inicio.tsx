import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

function normalizarTipo(tipo?: string | null) {
  return String(tipo || "").trim().toLowerCase();
}

function montoAbsoluto(monto: number | string) {
  return Math.abs(Number(monto) || 0);
}

export default function Inicio() {
  const [nombre, setNombre] = useState("");
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [totalGastos, setTotalGastos] = useState(0);
  const [movimientos, setMovimientos] = useState<any[]>([]);

  const cargarDatos = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Cargar perfil
    const { data: perfil } = await supabase
      .from("perfil")
      .select("nombre")
      .eq("id", user.id)
      .single();
    if (perfil) setNombre(perfil.nombre);

    const { data: movs, error: errorMovs } = await supabase
      .from("movimiento")
      .select("id, categoria_id, tipo, monto, fecha, descripcion, created_at")
      .eq("usuario_id", user.id)
      .order("fecha", { ascending: false });

    if (errorMovs) {
      console.log("Error cargando movimientos de inicio:", errorMovs.message);
      setTotalIngresos(0);
      setTotalGastos(0);
      setMovimientos([]);
    } else {
      const movimientosUsuario = (movs || []).sort((a, b) => {
          const fechaA = `${a.fecha || ""} ${a.created_at || ""}`;
          const fechaB = `${b.fecha || ""} ${b.created_at || ""}`;
          return fechaB.localeCompare(fechaA);
        });
      const ingresos = movimientosUsuario
        .filter((m) => normalizarTipo(m.tipo) === "ingreso")
        .reduce((sum, m) => sum + montoAbsoluto(m.monto), 0);
      const gastos = movimientosUsuario
        .filter((m) => normalizarTipo(m.tipo) === "gasto")
        .reduce((sum, m) => sum + montoAbsoluto(m.monto), 0);
      setTotalIngresos(ingresos);
      setTotalGastos(gastos);
      console.log("inicio movimientos usuario:", movimientosUsuario.length);
      console.log("inicio ingresos:", ingresos);
      console.log("inicio gastos:", gastos);

      const categoriaIds = [
        ...new Set(
          movimientosUsuario
            .map((mov) => mov.categoria_id)
            .filter((id) => Boolean(id)),
        ),
      ];

      let categoriasPorId: Record<string, any> = {};
      if (categoriaIds.length > 0) {
        const { data: cats, error: errorCats } = await supabase
          .from("categoria")
          .select("id, nombre, icono")
          .in("id", categoriaIds);

        if (errorCats) {
          console.log("Error cargando categorias del inicio:", errorCats.message);
        } else {
          categoriasPorId = Object.fromEntries(
            (cats || []).map((cat) => [cat.id, cat]),
          );
        }
      }

      const ultimos = movimientosUsuario
        .slice(0, 5)
        .map((mov) => ({
          ...mov,
          categoria: categoriasPorId[mov.categoria_id] || null,
        }));

      setMovimientos(ultimos);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos]),
  );

  const saldo = totalIngresos - totalGastos;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.saludo}>Hola, {nombre} 👋</Text>
        <Text style={styles.fecha}>
          {new Date().toLocaleDateString("es-PE", {
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>

      {/* Tarjeta saldo */}
      <View style={styles.cardSaldo}>
        <Text style={styles.saldoLabel}>Saldo del mes</Text>
        <Text
          style={[
            styles.saldoMonto,
            { color: saldo >= 0 ? "#22c55e" : "#ef4444" },
          ]}
        >
          S/ {saldo.toFixed(2)}
        </Text>
        <View style={styles.saldoRow}>
          <View>
            <Text style={styles.saldoSub}>↑ Ingresos</Text>
            <Text style={styles.ingresoMonto}>
              S/ {totalIngresos.toFixed(2)}
            </Text>
          </View>
          <View>
            <Text style={styles.saldoSub}>↓ Gastos</Text>
            <Text style={styles.gastoMonto}>S/ {totalGastos.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Últimos movimientos */}
      <Text style={styles.seccionTitulo}>Últimos movimientos</Text>
      {movimientos.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioTexto}>No hay movimientos este mes</Text>
          <Text style={styles.vacioSub}>Agrega tu primer gasto o ingreso</Text>
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
                {mov.descripcion || mov.categoria?.nombre || "Movimiento"}
              </Text>
              <Text style={styles.movFecha}>{mov.fecha}</Text>
            </View>
            <Text
              style={[
                styles.movMonto,
                {
                  color:
                    normalizarTipo(mov.tipo) === "ingreso"
                      ? "#22c55e"
                      : "#ef4444",
                },
              ]}
            >
              {normalizarTipo(mov.tipo) === "ingreso" ? "+" : "-"}S/{" "}
              {montoAbsoluto(mov.monto).toFixed(2)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { padding: 24, paddingTop: 60, backgroundColor: "#6C63FF" },
  saludo: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  fecha: {
    fontSize: 13,
    color: "#ffffff99",
    marginTop: 4,
    textTransform: "capitalize",
  },
  cardSaldo: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 3,
  },
  saldoLabel: { fontSize: 13, color: "#666", marginBottom: 4 },
  saldoMonto: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  saldoRow: { flexDirection: "row", justifyContent: "space-between" },
  saldoSub: { fontSize: 12, color: "#666" },
  ingresoMonto: { fontSize: 16, fontWeight: "600", color: "#22c55e" },
  gastoMonto: { fontSize: 16, fontWeight: "600", color: "#ef4444" },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 16,
    marginBottom: 8,
    color: "#1a1a1a",
  },
  vacio: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
  },
  vacioTexto: { fontSize: 15, fontWeight: "500", color: "#666" },
  vacioSub: { fontSize: 13, color: "#999", marginTop: 4 },
  movCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
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
  movFecha: { fontSize: 12, color: "#999", marginTop: 2 },
  movMonto: { fontSize: 15, fontWeight: "600" },
});
