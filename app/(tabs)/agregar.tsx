import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { procesarImagenConIA, seleccionarImagen } from "../../lib/ia";
import { supabase } from "../../lib/supabase";

const CATEGORIAS_POR_DEFECTO: Record<string, { icono: string; tipo: "ingreso" | "gasto" | "ambos" }> = {
  Alimentación: { icono: "🍽️", tipo: "gasto" },
  Transporte: { icono: "🚌", tipo: "gasto" },
  Salud: { icono: "💊", tipo: "gasto" },
  Salario: { icono: "💼", tipo: "ingreso" },
  Ahorro: { icono: "💰", tipo: "ambos" },
  Otros: { icono: "📦", tipo: "ambos" },
};

function norm(t?: string | null) {
  return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export default function Agregar() {
  const router = useRouter();
  const [tipo, setTipo] = useState<"ingreso" | "gasto">("gasto");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [catSel, setCatSel] = useState<string>("");
  const [catIAId, setCatIAId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [tipoReg, setTipoReg] = useState<"manual" | "ia">("manual");

  const [modalVisible, setModalVisible] = useState(false);
  const [descModal, setDescModal] = useState("");

  const scrollRef = useRef<ScrollView>(null);
  
  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    cargarCategorias();
  }, []));

  async function cargarCategorias() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("categoria").select("*").or(`usuario_id.is.null,usuario_id.eq.${user.id}`).order("nombre");
    setCategorias(data || []);
  }

  async function handleProcesarIA() {
    try {
      setLoadingIA(true);
      const img = await seleccionarImagen();
      if (!img || !img.base64) return;
      setImagenUri(img.uri);
      setImagenBase64(img.base64);
      const res = await procesarImagenConIA(img.base64);
      if (!res.descripcion) {
        setModalVisible(true);
      } else {
        aplicarIA(res);
      }
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoadingIA(false); }
  }

  async function aplicarIA(res: any) {
    if (res.monto) setMonto(res.monto.toString());
    if (res.fecha) setFecha(res.fecha);
    if (res.descripcion) setDescripcion(res.descripcion);
    if (res.tipo) setTipo(res.tipo);
    setTipoReg("ia");

    const sugerida = res.categoria_sugerida;
    const cat = categorias.find(c => norm(c.nombre) === norm(sugerida));
    if (cat) {
      setCatSel(cat.id);
      setCatIAId(cat.id);
    }

    Alert.alert(
      "✨ IA: Análisis Completado",
      `Hemos detectado los siguientes detalles:
      
💰 Monto: S/ ${res.monto}
📝 Motivo: ${res.descripcion || "No especificado"}
📂 Categoría: ${sugerida}
🗓️ Fecha: ${res.fecha}
💳 Pago: ${res.medio_pago || "No detectado"}
👤 Receptor: ${res.receptor || "No detectado"}

¿Deseas usar estos datos?`,
      [
        { text: "Editar", style: "cancel" },
        { text: "Confirmar ✅", onPress: () => {} }
      ]
    );
  }

  // FUNCIÓN DE LIMPIEZA AL ELIMINAR CAPTURA
  const handleRemoveImagen = () => {
    setImagenUri(null);
    setImagenBase64(null);
    setMonto("");
    setDescripcion("");
    setFecha(new Date().toISOString().split("T")[0]);
    setCatSel("");
    setCatIAId(null);
    setTipoReg("manual");
  };

  async function handleGuardar() {
    if (!monto || !catSel) {
      Alert.alert("Faltan datos", "Por favor ingresa un monto y elige una categoría.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("movimiento").insert({
      usuario_id: user.id,
      categoria_id: catSel,
      tipo,
      tipo_registro: tipoReg,
      monto: Math.abs(parseFloat(monto)),
      fecha,
      descripcion,
      imagen_url: imagenUri
    });

    if (error) Alert.alert("Error", error.message);
    else {
      setMonto("");
      setDescripcion("");
      setImagenUri(null);
      setImagenBase64(null);
      setCatSel("");
      setCatIAId(null);
      setTipoReg("manual");
      setFecha(new Date().toISOString().split("T")[0]);
      
      Alert.alert("¡Éxito!", "Movimiento guardado correctamente.");
      router.replace("/(tabs)/movimientos");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
      <ScrollView 
        ref={scrollRef}
        style={s.container} 
        contentContainerStyle={s.content} 
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Registrar Pago</Text>

        <TouchableOpacity style={s.iaBtn} onPress={handleProcesarIA} disabled={loadingIA}>
          {loadingIA ? <ActivityIndicator color="#fff" /> : <Ionicons name="scan-circle" size={32} color="#fff" />}
          <View>
            <Text style={s.iaBtnTitle}>{loadingIA ? "Analizando voucher..." : "Escanear con IA"}</Text>
            <Text style={s.iaBtnSub}>Detecta monto, fecha y categoría</Text>
          </View>
        </TouchableOpacity>

        {imagenUri && (
          <View style={s.previewWrap}>
            <Image source={{ uri: imagenUri }} style={s.preview} />
            <TouchableOpacity style={s.closeImg} onPress={handleRemoveImagen}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={s.card}>
          <View style={s.tipoRow}>
            <TouchableOpacity style={[s.tipoBtn, tipo === "gasto" && s.tipoBtnG]} onPress={() => setTipo("gasto")}>
              <Text style={[s.tipoTxt, tipo === "gasto" && s.tipoTxtActive]}>Gasto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tipoBtn, tipo === "ingreso" && s.tipoBtnI]} onPress={() => setTipo("ingreso")}>
              <Text style={[s.tipoTxt, tipo === "ingreso" && s.tipoTxtActive]}>Ingreso</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>MONTO</Text>
          <View style={s.montoWrap}>
            <Text style={s.montoSimbolo}>S/</Text>
            <TextInput style={s.montoInput} value={monto} onChangeText={setMonto} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#cbd5e1" />
          </View>

          <Text style={s.label}>DESCRIPCIÓN</Text>
          <TextInput style={s.input} value={descripcion} onChangeText={setDescripcion} placeholder="Ej: Pago de luz, Cena..." placeholderTextColor="#94a3b8" />

          <Text style={s.label}>FECHA</Text>
          <TextInput style={s.input} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
        </View>

        <Text style={s.label}>CATEGORÍA</Text>
        <View style={s.catGrid}>
          {categorias.map(c => (
            <TouchableOpacity 
              key={c.id} 
              style={[s.catChip, catSel === c.id && s.catChipSel, catIAId === c.id && s.catChipIA]} 
              onPress={() => setCatSel(c.id)}
            >
              <Text style={{fontSize:18}}>{c.icono}</Text>
              <Text style={[s.catTxt, catSel === c.id && s.catTxtSel]}>{c.nombre}</Text>
              {catIAId === c.id && <View style={s.iaTag}><Text style={s.iaTagTxt}>IA</Text></View>}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={handleGuardar} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Guardar Movimiento</Text>}
        </TouchableOpacity>
        
        <View style={{height:60}} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>¿Qué compraste? 🛍️</Text>
            <Text style={s.modalSub}>Dime qué fue para que la IA lo clasifique mejor.</Text>
            <TextInput style={s.modalInput} value={descModal} onChangeText={setDescModal} placeholder="Ej: Pollo a la brasa, Gasofa..." autoFocus />
            <TouchableOpacity style={s.modalBtn} onPress={() => { setModalVisible(false); setLoadingIA(true); procesarImagenConIA(imagenBase64!, descModal).then(aplicarIA).finally(() => setLoadingIA(false)); }}>
              <Text style={s.modalBtnTxt}>Procesar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "900", color: "#1e293b", marginBottom: 20 },
  iaBtn: { backgroundColor: "#6366f1", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20, shadowColor: "#6366f1", shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  iaBtnTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  iaBtnSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  previewWrap: { position: "relative", marginBottom: 20 },
  preview: { width: "100%", height: 200, borderRadius: 20 },
  closeImg: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 15, padding: 5 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  tipoRow: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 12, padding: 4, marginBottom: 20 },
  tipoBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tipoBtnG: { backgroundColor: "#ef4444" },
  tipoBtnI: { backgroundColor: "#22c55e" },
  tipoTxt: { fontWeight: "700", color: "#64748b" },
  tipoTxtActive: { color: "#fff" },
  label: { fontSize: 11, fontWeight: "800", color: "#94a3b8", letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  montoWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  montoSimbolo: { fontSize: 32, fontWeight: "900", color: "#1e293b", marginRight: 8 },
  montoInput: { fontSize: 48, fontWeight: "900", color: "#1e293b", minWidth: 150, textAlign: "center" },
  input: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 14, fontSize: 16, color: "#1e293b", marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 30 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  catChipSel: { borderColor: "#6366f1", backgroundColor: "#eef2ff", borderWidth: 2 },
  catChipIA: { borderColor: "#f59e0b", borderWidth: 2 },
  catTxt: { fontSize: 14, fontWeight: "600", color: "#475569" },
  catTxtSel: { color: "#6366f1" },
  iaTag: { backgroundColor: "#f59e0b", borderRadius: 4, paddingHorizontal: 4 },
  iaTagTxt: { color: "#fff", fontSize: 9, fontWeight: "900" },
  saveBtn: { backgroundColor: "#1e293b", borderRadius: 20, padding: 20, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  saveBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 30, padding: 30 },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#1e293b", marginBottom: 10 },
  modalSub: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  modalInput: { backgroundColor: "#f1f5f9", borderRadius: 15, padding: 16, fontSize: 18, marginBottom: 20 },
  modalBtn: { backgroundColor: "#6366f1", borderRadius: 15, padding: 16, alignItems: "center" },
  modalBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 }
});
