import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Movimiento = {
  id: string;
  categoria_id: string | null;
  tipo: string | null;
  monto: number;
  fecha: string;
  descripcion: string | null;
  created_at?: string | null;
  categoria?: Categoria | null;
};

type Categoria = {
  id: string;
  nombre: string;
  icono: string | null;
};

type MonthData = {
  key: string;
  label: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
};

function normalizarTipo(tipo?: string | null) {
  return String(tipo || "").trim().toLowerCase();
}

function normalizarTexto(texto?: string | null) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function money(value: number) {
  return `S/ ${value.toFixed(2)}`;
}

function montoAbsoluto(monto: number | string) {
  return Math.abs(Number(monto) || 0);
}

function monthKey(fecha?: string | null) {
  return String(fecha || "").slice(0, 7);
}

function monthLabel(key: string) {
  if (!key) return "Sin fecha";
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
}

function daysInMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function barWidth(value: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.max(5, Math.min(100, (value / max) * 100))}%`;
}

export default function Reportes() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedHeatDay, setSelectedHeatDay] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMovimientos([]);
      setLoading(false);
      return;
    }

    const { data: movs, error } = await supabase
      .from("movimiento")
      .select("id, categoria_id, tipo, monto, fecha, descripcion, created_at")
      .eq("usuario_id", user.id)
      .order("fecha", { ascending: false });

    if (error) {
      console.log("Error cargando reportes:", error.message);
      setMovimientos([]);
      setLoading(false);
      return;
    }

    const lista = (movs || []) as Movimiento[];
    const categoriaIds = [
      ...new Set(lista.map((mov) => mov.categoria_id).filter(Boolean)),
    ] as string[];

    let categoriasPorId: Record<string, Categoria> = {};
    if (categoriaIds.length > 0) {
      const { data: cats, error: errorCats } = await supabase
        .from("categoria")
        .select("id, nombre, icono")
        .in("id", categoriaIds);

      if (errorCats) {
        console.log("Error cargando categorias de reportes:", errorCats.message);
      } else {
        categoriasPorId = Object.fromEntries(
          ((cats || []) as Categoria[]).map((cat) => [cat.id, cat]),
        );
      }
    }

    setMovimientos(
      lista.map((mov) => ({
        ...mov,
        monto: montoAbsoluto(mov.monto),
        categoria: mov.categoria_id ? categoriasPorId[mov.categoria_id] : null,
      })),
    );
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos]),
  );

  const months = useMemo(() => {
    const keys = [...new Set(movimientos.map((mov) => monthKey(mov.fecha)))].filter(
      Boolean,
    );
    if (!keys.includes(selectedMonth)) keys.unshift(selectedMonth);
    return keys.sort((a, b) => b.localeCompare(a));
  }, [movimientos, selectedMonth]);

  const monthMovs = useMemo(
    () => movimientos.filter((mov) => monthKey(mov.fecha) === selectedMonth),
    [movimientos, selectedMonth],
  );

  const gastos = monthMovs.filter((mov) => normalizarTipo(mov.tipo) === "gasto");
  const ingresos = monthMovs.filter(
    (mov) => normalizarTipo(mov.tipo) === "ingreso",
  );
  const totalIngresos = ingresos.reduce((sum, mov) => sum + mov.monto, 0);
  const totalGastos = gastos.reduce((sum, mov) => sum + mov.monto, 0);
  const ahorro = totalIngresos - totalGastos;
  const maxResumen = Math.max(totalIngresos, totalGastos, Math.max(ahorro, 0));
  const totalAhorradoHistorico = movimientos
    .filter((mov) => normalizarTexto(mov.categoria?.nombre) === "ahorro")
    .reduce((sum, mov) => sum + mov.monto, 0);

  const monthlyData = useMemo<MonthData[]>(() => {
    const grouped: Record<string, MonthData> = {};

    movimientos.forEach((mov) => {
      const key = monthKey(mov.fecha);
      if (!key) return;

      if (!grouped[key]) {
        grouped[key] = {
          key,
          label: monthLabel(key),
          ingresos: 0,
          gastos: 0,
          ahorro: 0,
        };
      }

      if (normalizarTipo(mov.tipo) === "ingreso") grouped[key].ingresos += mov.monto;
      if (normalizarTipo(mov.tipo) === "gasto") grouped[key].gastos += mov.monto;
      grouped[key].ahorro = grouped[key].ingresos - grouped[key].gastos;
    });

    return Object.values(grouped)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);
  }, [movimientos]);

  const gastosPorCategoria = useMemo(() => {
    const grouped: Record<string, { nombre: string; icono: string; total: number }> =
      {};

    gastos.forEach((mov) => {
      const key = mov.categoria_id || "sin-categoria";
      if (!grouped[key]) {
        grouped[key] = {
          nombre: mov.categoria?.nombre || "Sin categoria",
          icono: mov.categoria?.icono || "□",
          total: 0,
        };
      }
      grouped[key].total += mov.monto;
    });

    return Object.entries(grouped)
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.total - a.total);
  }, [gastos]);

  const maxCategoria = Math.max(...gastosPorCategoria.map((cat) => cat.total), 0);
  const selectedCategoryData =
    gastosPorCategoria.find((cat) => cat.id === selectedCategory) ||
    gastosPorCategoria[0];

  const maxGastoMensual = Math.max(...monthlyData.map((item) => item.gastos), 0);
  const ahorroObjetivo = totalIngresos > 0 ? totalIngresos * 0.2 : Math.max(totalGastos * 0.2, 1);
  const ahorroPositivo = Math.max(ahorro, 0);
  const ahorroPorcentaje = Math.min(100, (ahorroPositivo / ahorroObjetivo) * 100);

  const heatDays = useMemo(() => {
    const count = daysInMonth(selectedMonth);
    return Array.from({ length: count }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const fecha = `${selectedMonth}-${day}`;
      const total = gastos
        .filter((mov) => mov.fecha === fecha)
        .reduce((sum, mov) => sum + mov.monto, 0);
      return { day: index + 1, fecha, total };
    });
  }, [gastos, selectedMonth]);

  const maxHeat = Math.max(...heatDays.map((day) => day.total), 0);
  const selectedHeatData = heatDays.find((day) => day.fecha === selectedHeatDay);
  const topGastos = [...gastos].sort((a, b) => b.monto - a.monto).slice(0, 5);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6C63FF" />
        <Text style={styles.loadingText}>Preparando reportes...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Reportes</Text>
        <Text style={styles.subtitle}>Lectura rapida de tu dinero</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total ahorrado</Text>
        <Text
          style={[
            styles.totalValue,
            { color: totalAhorradoHistorico >= 0 ? "#22c55e" : "#ef4444" },
          ]}
        >
          {totalAhorradoHistorico < 0 ? "-" : ""}
          {money(Math.abs(totalAhorradoHistorico))}
        </Text>
        <Text style={styles.totalHint}>
          Acumulado historico de movimientos en categoria Ahorro.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthTabs}
      >
        {months.map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.monthTab, selectedMonth === key && styles.monthTabActive]}
            onPress={() => {
              setSelectedMonth(key);
              setSelectedCategory(null);
              setSelectedHeatDay(null);
            }}
          >
            <Text
              style={[
                styles.monthTabText,
                selectedMonth === key && styles.monthTabTextActive,
              ]}
            >
              {monthLabel(key)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ingresos vs gastos vs ahorro</Text>
        <MetricBar label="Ingresos" value={totalIngresos} max={maxResumen} color="#22c55e" />
        <MetricBar label="Gastos" value={totalGastos} max={maxResumen} color="#ef4444" />
        <MetricBar
          label="Ahorro"
          value={ahorro}
          max={maxResumen}
          color={ahorro >= 0 ? "#0ea5e9" : "#f59e0b"}
        />
        <Text style={styles.insight}>
          {ahorro >= 0
            ? `Te quedan ${money(ahorro)} este periodo.`
            : `Tus gastos superan tus ingresos por ${money(Math.abs(ahorro))}.`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gastos por categoria</Text>
        {gastosPorCategoria.length === 0 ? (
          <Empty text="Aun no hay gastos para comparar." />
        ) : (
          gastosPorCategoria.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryRow,
                selectedCategoryData?.id === cat.id && styles.categoryRowActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={styles.categoryIcon}>{cat.icono}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.categoryName}>{cat.nombre}</Text>
                  <Text style={styles.categoryValue}>{money(cat.total)}</Text>
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.trackFill,
                      {
                        width: barWidth(cat.total, maxCategoria),
                        backgroundColor: "#6C63FF",
                      },
                    ]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        {selectedCategoryData && (
          <Text style={styles.insight}>
            Tu categoria mas fuerte es {selectedCategoryData.nombre}:{" "}
            {money(selectedCategoryData.total)}.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Evolucion mensual de gastos</Text>
        <View style={styles.monthChart}>
          {monthlyData.length === 0 ? (
            <Empty text="Registra mas movimientos para ver tendencia." />
          ) : (
            monthlyData.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.monthBarItem}
                onPress={() => setSelectedMonth(item.key)}
              >
                <View style={styles.verticalTrack}>
                  <View
                    style={[
                      styles.verticalFill,
                      {
                        height: barWidth(item.gastos, maxGastoMensual),
                        backgroundColor:
                          selectedMonth === item.key ? "#ef4444" : "#fca5a5",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.monthLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mapa de calor de gastos</Text>
        <View style={styles.heatGrid}>
          {heatDays.map((day) => {
            const intensity = maxHeat > 0 ? day.total / maxHeat : 0;
            const bg =
              intensity === 0
                ? "#f3f4f6"
                : intensity < 0.35
                  ? "#fed7aa"
                  : intensity < 0.7
                    ? "#fb923c"
                    : "#ef4444";
            return (
              <TouchableOpacity
                key={day.fecha}
                style={[
                  styles.heatCell,
                  { backgroundColor: bg },
                  selectedHeatDay === day.fecha && styles.heatCellActive,
                ]}
                onPress={() => setSelectedHeatDay(day.fecha)}
              >
                <Text
                  style={[
                    styles.heatText,
                    intensity >= 0.7 && { color: "#fff" },
                  ]}
                >
                  {day.day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.insight}>
          {selectedHeatData
            ? `${selectedHeatData.fecha}: ${money(selectedHeatData.total)} en gastos.`
            : "Toca un dia para ver cuanto gastaste."}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top 5 gastos mas altos</Text>
        {topGastos.length === 0 ? (
          <Empty text="Aun no hay gastos registrados." />
        ) : (
          topGastos.map((mov, index) => (
            <View key={mov.id} style={styles.topRow}>
              <Text style={styles.topIndex}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.topTitle}>
                  {mov.descripcion || mov.categoria?.nombre || "Gasto"}
                </Text>
                <Text style={styles.muted}>{mov.fecha}</Text>
              </View>
              <Text style={styles.expenseText}>-{money(mov.monto)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progreso de metas de ahorro</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>Meta sugerida: 20% de ingresos</Text>
          <Text style={styles.strong}>{money(ahorroObjetivo)}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${ahorroPorcentaje}%`, backgroundColor: "#0ea5e9" },
            ]}
          />
        </View>
        <Text style={styles.insight}>
          Vas en {money(ahorroPositivo)} de ahorro positivo.
        </Text>
      </View>

    </ScrollView>
  );
}

function MetricBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <View style={styles.metricBlock}>
      <View style={styles.rowBetween}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{money(value)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.trackFill,
            { width: barWidth(Math.abs(value), max), backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16, paddingTop: 58, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: { marginTop: 10, color: "#666", fontSize: 13 },
  header: { marginBottom: 14 },
  title: { fontSize: 28, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  totalCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eeeeee",
  },
  totalLabel: { fontSize: 13, color: "#6b7280", fontWeight: "700" },
  totalValue: {
    fontSize: 38,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 4,
  },
  totalHint: { fontSize: 12, color: "#9ca3af" },
  monthTabs: { gap: 8, paddingBottom: 14 },
  monthTab: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthTabActive: { backgroundColor: "#6C63FF", borderColor: "#6C63FF" },
  monthTabText: { color: "#4b5563", fontSize: 13, fontWeight: "600" },
  monthTabTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eeeeee",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metricBlock: { marginBottom: 12 },
  metricLabel: { fontSize: 13, color: "#4b5563", fontWeight: "600" },
  metricValue: { fontSize: 14, fontWeight: "800" },
  track: {
    height: 9,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 8,
  },
  trackFill: { height: "100%", borderRadius: 6 },
  insight: { fontSize: 13, color: "#6b7280", lineHeight: 18, marginTop: 10 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  categoryRowActive: { backgroundColor: "#f0effe" },
  categoryIcon: { fontSize: 20, width: 28, textAlign: "center" },
  categoryName: { fontSize: 13, color: "#1f2937", fontWeight: "700" },
  categoryValue: { fontSize: 13, color: "#ef4444", fontWeight: "800" },
  monthChart: {
    height: 150,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  monthBarItem: { flex: 1, alignItems: "center", gap: 8 },
  verticalTrack: {
    height: 112,
    width: "100%",
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  verticalFill: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  monthLabel: { fontSize: 10, color: "#6b7280", fontWeight: "700" },
  muted: { color: "#6b7280", fontSize: 12 },
  strong: { color: "#111827", fontSize: 13, fontWeight: "800" },
  progressTrack: {
    height: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 12,
  },
  progressFill: { height: "100%", borderRadius: 8 },
  heatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  heatCell: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  heatCellActive: { borderColor: "#111827", borderWidth: 2 },
  heatText: { fontSize: 11, color: "#374151", fontWeight: "800" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  topIndex: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#f3f4f6",
    color: "#374151",
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "800",
  },
  topTitle: { fontSize: 13, color: "#111827", fontWeight: "700" },
  expenseText: { color: "#ef4444", fontSize: 13, fontWeight: "800" },
  empty: { color: "#9ca3af", fontSize: 13, paddingVertical: 12 },
});
