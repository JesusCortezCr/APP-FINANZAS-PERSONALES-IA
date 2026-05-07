import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { procesarImagen, seleccionarImagen } from "../../lib/claude";
import { supabase } from "../../lib/supabase";

const CATEGORIAS_POR_DEFECTO: Record<
  string,
  { icono: string; tipo: "ingreso" | "gasto" | "ambos" }
> = {
  Alimentación: { icono: "🍽️", tipo: "gasto" },
  Transporte: { icono: "🚌", tipo: "gasto" },
  Salud: { icono: "💊", tipo: "gasto" },
  Educación: { icono: "📚", tipo: "gasto" },
  Entretenimiento: { icono: "🎬", tipo: "gasto" },
  Servicios: { icono: "💡", tipo: "gasto" },
  Compras: { icono: "🛒", tipo: "gasto" },
  Ropa: { icono: "👕", tipo: "gasto" },
  Mascotas: { icono: "🐾", tipo: "gasto" },
  Ahorro: { icono: "💰", tipo: "ambos" },
  Salario: { icono: "💼", tipo: "ingreso" },
  Freelance: { icono: "💻", tipo: "ingreso" },
  Negocio: { icono: "🏪", tipo: "ingreso" },
  Inversiones: { icono: "📈", tipo: "ingreso" },
  Transferencias: { icono: "↔️", tipo: "ambos" },
  Otros: { icono: "📦", tipo: "ambos" },
};

function normalizarTexto(texto?: string | null) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default function Agregar() {
  const router = useRouter();
  const [tipo, setTipo] = useState<"ingreso" | "gasto">("gasto");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
    useState<string>("");
  const [categoriaSugeridaId, setCategoriaSugeridaId] = useState<string | null>(
    null,
  );
  const categoriaRef = useRef<string>("");
  const resultadoRef = useRef<any>(null);
  const catsRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [tipoRegistro, setTipoRegistro] = useState<"manual" | "ia">("manual");

  // Modal de descripción
  const [modalVisible, setModalVisible] = useState(false);
  const [descripcionModal, setDescripcionModal] = useState("");

  useEffect(() => {
    cargarCategoriasIniciales();
  }, []);

  async function cargarCategoriasIniciales() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("categoria")
      .select("*")
      .or(`usuario_id.is.null,usuario_id.eq.${user.id}`)
      .order("nombre");

    if (error) {
      console.log("Error cargando categorias iniciales:", error.message);
      return;
    }

    const lista = data || [];
    setCategorias(lista);
    catsRef.current = lista;
  }

  async function cargarCategorias(_tipoParam?: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("categoria")
      .select("*")
      .or(`usuario_id.is.null,usuario_id.eq.${user.id}`)
      .order("nombre");

    if (error) {
      console.log("Error cargando categorias:", error.message);
      return [];
    }

    const lista = data || [];
    setCategorias(lista);
    catsRef.current = lista;
    return lista;
  }

  async function crearCategoriaSiNoExiste(nombre: string, tipoCategoria: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const nombreNormalizado = normalizarTexto(nombre);
    const nombreCanonico =
      Object.keys(CATEGORIAS_POR_DEFECTO).find(
        (cat) => normalizarTexto(cat) === nombreNormalizado,
      ) || nombre.trim();
    const config = CATEGORIAS_POR_DEFECTO[nombreCanonico] || {
      icono: "📦",
      tipo: tipoCategoria === "ingreso" ? "ingreso" : "gasto",
    };

    const { data, error } = await supabase
      .from("categoria")
      .insert({
        nombre: nombreCanonico,
        icono: config.icono,
        tipo: config.tipo,
        usuario_id: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.log("No se pudo crear categoria:", error.message);
      return null;
    }

    return data;
  }

  async function obtenerCategoriaParaIA(resultado: any, cats: any[]) {
    const sugerida = resultado.categoria_sugerida;
    if (!sugerida) return null;

    const sugeridaNormalizada = normalizarTexto(sugerida);
    const catEncontrada = cats.find(
      (c) => normalizarTexto(c.nombre) === sugeridaNormalizada,
    );
    if (catEncontrada) return catEncontrada;

    const fallbackOtros = cats.find((c) => normalizarTexto(c.nombre) === "otros");
    const catCreada = await crearCategoriaSiNoExiste(
      sugerida,
      resultado.tipo || tipo,
    );

    return catCreada || fallbackOtros || null;
  }

  function ordenarCategoriasConSugerida(cats: any[], sugeridaId?: string | null) {
    if (!sugeridaId) return cats;

    return [...cats].sort((a, b) => {
      if (a.id === sugeridaId) return -1;
      if (b.id === sugeridaId) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }

  function limpiarFormulario() {
    setTipo("gasto");
    setMonto("");
    setDescripcion("");
    setCategoriaSeleccionada("");
    setCategoriaSugeridaId(null);
    setImagenUri(null);
    setImagenBase64(null);
    setTipoRegistro("manual");
    setFecha(new Date().toISOString().split("T")[0]);
    setModalVisible(false);
    setDescripcionModal("");
    categoriaRef.current = "";
    resultadoRef.current = null;
  }

  async function aplicarResultadoIA(resultado: any, cats: any[]) {
    console.log("cats recibidos:", cats.length);
    console.log("categoria sugerida:", resultado.categoria_sugerida);

    if (resultado.monto) setMonto(resultado.monto.toString());
    if (resultado.fecha) setFecha(resultado.fecha);
    if (resultado.descripcion) setDescripcion(resultado.descripcion);
    if (resultado.tipo) setTipo(resultado.tipo);
    setTipoRegistro("ia");

    const catsActuales =
      cats.length > 0 ? cats : await cargarCategorias(resultado.tipo || tipo);

    if (resultado.categoria_sugerida) {
      const catEncontrada = await obtenerCategoriaParaIA(resultado, catsActuales);
      console.log("cat encontrada:", catEncontrada);

      if (!catEncontrada) {
        console.log("No se encontro ni se pudo crear categoria sugerida");
        return;
      }

      const listaActualizada = ordenarCategoriasConSugerida(
        catsActuales.some((c) => c.id === catEncontrada.id)
          ? catsActuales
          : [...catsActuales, catEncontrada],
        catEncontrada.id,
      );

      setCategorias(listaActualizada);
      catsRef.current = listaActualizada;
      setCategoriaSeleccionada(catEncontrada.id);
      setCategoriaSugeridaId(catEncontrada.id);
      categoriaRef.current = catEncontrada.id;
    } else {
      console.log("No hay sugerencia de categoria");
    }
  }
  async function handleProcesarImagen() {
    try {
      setLoadingIA(true);
      const imagen = await seleccionarImagen();
      if (!imagen || !imagen.base64) return;

      setImagenUri(imagen.uri);
      setImagenBase64(imagen.base64);

      const resultado = await procesarImagen(imagen.base64);

      const listaCats = await cargarCategorias(resultado.tipo || "gasto");

      const tieneDescripcion =
        resultado.descripcion &&
        resultado.descripcion !== null &&
        resultado.descripcion.length > 3;

      if (tieneDescripcion) {
        resultadoRef.current = resultado;
        mostrarConfirmacion(resultado, listaCats);
      } else {
        // Guardamos resultado para usarlo después del modal
        setImagenBase64(imagen.base64);
        setModalVisible(true);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoadingIA(false);
    }
  }

  async function handleConfirmarDescripcion() {
    if (!descripcionModal.trim()) {
      Alert.alert(
        "Escribe una descripción",
        "Ayuda a la IA a clasificar mejor tu gasto",
      );
      return;
    }
    setModalVisible(false);
    setLoadingIA(true);

    try {
      const resultado = await procesarImagen(
        imagenBase64!,
        descripcionModal.trim(),
      );

      const listaCats = await cargarCategorias(resultado.tipo || "gasto");
      resultadoRef.current = resultado;
      mostrarConfirmacion(resultado, listaCats);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoadingIA(false);
      setDescripcionModal("");
    }
  }
  function mostrarConfirmacion(resultado: any, cats: any[]) {
    Alert.alert(
      "✨ IA detectó estos datos",
      `Monto: S/ ${resultado.monto}
Fecha: ${resultado.fecha}
Descripción: ${resultado.descripcion || "No detectada"}
Categoría: ${resultado.categoria_sugerida}
Tipo: ${resultado.tipo}
Medio de pago: ${resultado.medio_pago || "No detectado"}

¿Confirmas estos datos?`,
      [
        {
          text: "Editar manualmente",
          style: "cancel",
          onPress: () =>
            void aplicarResultadoIA(resultadoRef.current, catsRef.current),
        },
        {
          text: "Confirmar ✅",
          onPress: () =>
            void aplicarResultadoIA(resultadoRef.current, catsRef.current),
        },
      ],
    );
  }

  async function handleGuardar() {
    console.log("monto:", monto);
    console.log("categoriaSeleccionada:", categoriaSeleccionada);
    console.log("categoriaRef:", categoriaRef.current);
    const categoriaFinal = categoriaSeleccionada || categoriaRef.current;

    if (!monto || !categoriaFinal) {
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
      categoria_id: categoriaFinal, // ← usamos categoriaFinal
      categoria_sugerida_id: categoriaSugeridaId,
      tipo,
      tipo_registro: tipoRegistro,
      monto: Math.abs(parseFloat(monto)),
      fecha,
      descripcion: descripcion || null,
      descripcion_ia: tipoRegistro === "ia" ? descripcion : null,
      imagen_url: imagenUri || null,
    });

    if (error) Alert.alert("Error", error.message);
    else {
      limpiarFormulario();
      void cargarCategoriasIniciales();
      router.replace("/(tabs)/movimientos");
      Alert.alert("¡Listo!", "Movimiento registrado correctamente");
    }
    setLoading(false);
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.titulo}>Nuevo movimiento</Text>

      {/* Modal descripción */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>¿De qué fue este pago? 🤔</Text>
            <Text style={styles.modalSub}>
              No detecté una descripción clara en la imagen. Cuéntame qué
              compraste o pagaste para clasificarlo mejor.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Perfume, Pasaje, Almuerzo..."
              value={descripcionModal}
              onChangeText={setDescripcionModal}
              autoFocus
            />
            <TouchableOpacity
              style={styles.modalBoton}
              onPress={handleConfirmarDescripcion}
            >
              <Text style={styles.modalBotonTexto}>✨ Clasificar con IA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelar}
              onPress={() => {
                setModalVisible(false);
                setDescripcionModal("");
              }}
            >
              <Text style={styles.modalCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Botón IA */}
      <TouchableOpacity
        style={styles.botonIA}
        onPress={handleProcesarImagen}
        disabled={loadingIA}
      >
        {loadingIA ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.botonIATexto}>Analizando imagen...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.botonIAIcono}>📸</Text>
            <View>
              <Text style={styles.botonIATexto}>Escanear voucher con IA</Text>
              <Text style={styles.botonIASub}>
                Yape, Plin, recibos, vouchers
              </Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Preview imagen */}
      {imagenUri && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imagenUri }} style={styles.preview} />
          <Text style={styles.previewBadge}>✨ Procesado con IA</Text>
        </View>
      )}

      {/* Separador */}
      <View style={styles.separador}>
        <View style={styles.separadorLinea} />
        <Text style={styles.separadorTexto}>o ingresa manualmente</Text>
        <View style={styles.separadorLinea} />
      </View>

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
      {categoriaSugeridaId && (
        <Text style={styles.sugerenciaTexto}>
          Sugerencia de IA al inicio. Puedes elegir otra categoría si no encaja.
        </Text>
      )}
      <View style={styles.categoriasGrid}>
        {ordenarCategoriasConSugerida(categorias, categoriaSugeridaId).map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoriaChip,
              categoriaSeleccionada === cat.id && styles.categoriaChipSelected,
              categoriaSugeridaId === cat.id && styles.categoriaChipSugerida,
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
            {categoriaSugeridaId === cat.id && (
              <Text style={styles.sugeridaBadge}>IA</Text>
            )}
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
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  modalSub: { fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 20 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  modalBoton: {
    backgroundColor: "#6C63FF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  modalBotonTexto: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  modalCancelar: { alignItems: "center", padding: 10 },
  modalCancelarTexto: { color: "#999", fontSize: 14 },
  botonIA: {
    backgroundColor: "#6C63FF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  botonIAIcono: { fontSize: 28 },
  botonIATexto: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  botonIASub: { color: "#ffffff99", fontSize: 12, marginTop: 2 },
  previewContainer: { borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  preview: { width: "100%", height: 180, borderRadius: 14 },
  previewBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#6C63FF",
    color: "#fff",
    fontSize: 11,
    padding: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  separador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  separadorLinea: { flex: 1, height: 1, backgroundColor: "#ddd" },
  separadorTexto: { fontSize: 12, color: "#999" },
  tipoRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
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
  sugerenciaTexto: {
    fontSize: 12,
    color: "#f59e0b",
    marginBottom: 8,
    fontWeight: "600",
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
  categoriaChipSugerida: { borderColor: "#f59e0b", borderWidth: 2 },
  sugeridaBadge: {
    fontSize: 9,
    backgroundColor: "#f59e0b",
    color: "#fff",
    paddingHorizontal: 4,
    borderRadius: 4,
    fontWeight: "bold",
  },
  boton: {
    backgroundColor: "#6C63FF",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginBottom: 40,
  },
  botonTexto: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
