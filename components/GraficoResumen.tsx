import { StyleSheet, Text, View } from "react-native";

interface Props {
  ingresos: number;
  gastos: number;
  ahorro: number;
}

export default function GraficoResumen({ ingresos, gastos, ahorro }: Props) {
  const total = ingresos + gastos + Math.abs(ahorro);
  const getWidth = (val: number) => {
    if (total === 0) return "0%";
    return `${Math.max(10, (val / total) * 100)}%`;
  };

  const money = (v: number) =>
    `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  return (
    <View style={s.card}>
      <Text style={s.title}>Comparativa Global</Text>

      <View style={s.chartContainer}>
        {/* Barra de Ingresos */}
        <View style={s.barWrapper}>
          <View style={s.labelRow}>
            <Text style={s.barLabel}>Ingresos</Text>
            <Text style={[s.barValue, { color: "#22c55e" }]}>
              {money(ingresos)}
            </Text>
          </View>
          <View style={s.track}>
            <View
              style={[
                s.fill,
                { width: getWidth(ingresos), backgroundColor: "#22c55e" },
              ]}
            />
          </View>
        </View>

        {/* Barra de Gastos */}
        <View style={s.barWrapper}>
          <View style={s.labelRow}>
            <Text style={s.barLabel}>Gastos</Text>
            <Text style={[s.barValue, { color: "#ef4444" }]}>
              {money(gastos)}
            </Text>
          </View>
          <View style={s.track}>
            <View
              style={[
                s.fill,
                { width: getWidth(gastos), backgroundColor: "#ef4444" },
              ]}
            />
          </View>
        </View>

        {/* Barra de Ahorro */}
        <View style={s.barWrapper}>
          <View style={s.labelRow}>
            <Text style={s.barLabel}>Ahorro Neto</Text>
            <Text style={[s.barValue, { color: "#6366f1" }]}>
              {money(ahorro)}
            </Text>
          </View>
          <View style={s.track}>
            <View
              style={[
                s.fill,
                {
                  width: getWidth(Math.max(0, ahorro)),
                  backgroundColor: "#6366f1",
                },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.footerTxt}>
          {ahorro >= 0
            ? `Eficiencia de ahorro: ${((ahorro / ingresos) * 100 || 0).toFixed(1)}%`
            : "Estás en déficit financiero este mes."}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1e293b",
    marginBottom: 20,
    textAlign: "center",
  },
  chartContainer: {
    gap: 20,
  },
  barWrapper: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  barValue: {
    fontSize: 14,
    fontWeight: "900",
  },
  track: {
    height: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 6,
  },
  footer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    alignItems: "center",
  },
  footerTxt: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "600",
    fontStyle: "italic",
  },
});
