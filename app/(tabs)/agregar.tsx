import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function Agregar() {
  const [tipo, setTipo] = useState<"ingreso" | "gasto">("gasto");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
    useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarCategorias();
  }, [tipo]);

  async function cargarCategorias() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("categoria")
      .select("*")
      .or(`usuario_id.is.null,usuario_id.eq.${user.id}`)
      .in("tipo", [tipo, "ambos"])
      .order("nombre");

    if (data) {
      setCategorias(data);
      setCategoriaSeleccionada("");
    }
  }

  async function handleGuardar() {
    if (!monto || !categoriaSeleccionada) {
      Alert.alert("Error", "Completa el monto y selecciona una categoría");
      return;
    }
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("movimiento").insert({
      usuario_id: user.id,
      categoria_id: categoriaSeleccionada,
      tipo,
      tipo_registro: "manual",
      monto: parseFloat(monto),
      fecha,
      descripcion: descripcion || null,
    });

    if (error) Alert.alert("Error", error.message);
    else {
      Alert.alert("¡Listo!", "Movimiento registrado correctamente");
      setMonto("");
      setDescripcion("");
      setCategoriaSeleccionada("");
    }
    setLoading(false);
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.titulo}>Nuevo movimiento</Text>

      {/* Selector tipo */}
      <View style={styles.tipoRow}>
        <TouchableOpacity
          style={[styles.tipoBtn, tipo === "gasto" && styles.tipoBtnGasto]}
          onPress={() => setTipo("gasto")}
        >
          <Text
            style={[styles.tipoBtnTexto, tipo === "gasto" && { color: "#fff" }]}
          >
            ↓ Gasto
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tipoBtn, tipo === "ingreso" && styles.tipoBtnIngreso]}
          onPress={() => setTipo("ingreso")}
        >
          <Text
            style={[
              styles.tipoBtnTexto,
              tipo === "ingreso" && { color: "#fff" },
            ]}
          >
            ↑ Ingreso
          </Text>
        </TouchableOpacity>
      </View>

      {/* Monto */}
      <Text style={styles.label}>Monto (S/)</Text>
      <TextInput
        style={styles.inputMonto}
        placeholder="0.00"
        value={monto}
        onChangeText={setMonto}
        keyboardType="decimal-pad"
      />

      {/* Fecha */}
      <Text style={styles.label}>Fecha</Text>
      <TextInput
        style={styles.input}
        value={fecha}
        onChangeText={setFecha}
        placeholder="YYYY-MM-DD"
      />

      {/* Descripcion */}
      <Text style={styles.label}>Descripción (opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Almuerzo en restaurante"
        value={descripcion}
        onChangeText={setDescripcion}
      />

      {/* Categorias */}
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.categoriasGrid}>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoriaChip,
              categoriaSeleccionada === cat.id && styles.categoriaChipSelected,
            ]}
            onPress={() => setCategoriaSeleccionada(cat.id)}
          >
            <Text style={styles.categoriaIcono}>{cat.icono}</Text>
            <Text
              style={[
                styles.categoriaTexto,
                categoriaSeleccionada === cat.id && {
                  color: "#6C63FF",
                  fontWeight: "600",
                },
              ]}
            >
              {cat.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Boton guardar */}
      <TouchableOpacity
        style={styles.boton}
        onPress={handleGuardar}
        disabled={loading}
      >
        <Text style={styles.botonTexto}>
          {loading ? "Guardando..." : "Guardar movimiento"}
        </Text>
      </TouchableOpacity>
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
    marginBottom: 24,
  },
  tipoRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  tipoBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tipoBtnGasto: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  tipoBtnIngreso: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  tipoBtnTexto: { fontWeight: "600", fontSize: 15, color: "#666" },
  label: { fontSize: 13, fontWeight: "500", color: "#666", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  inputMonto: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee",
    textAlign: "center",
    color: "#1a1a1a",
  },
  categoriasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  categoriaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  categoriaIcono: { fontSize: 16 },
  categoriaTexto: { fontSize: 13, color: "#444" },
  categoriaChipSelected: { borderColor: "#6C63FF", backgroundColor: "#f0effe" },
  boton: {
    backgroundColor: "#6C63FF",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginBottom: 40,
  },
  botonTexto: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
