import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Perfil() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [stats, setStats] = useState({ movimientos: 0, ingresos: 0, gastos: 0 });
  
  const [editModal, setEditModal] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setEmail(user.email || "");

    const { data } = await supabase.from("perfil").select("nombre").eq("id", user.id).single();
    if (data?.nombre) {
      setNombre(data.nombre);
      setNuevoNombre(data.nombre);
    }

    const { data: movs } = await supabase.from("movimiento").select("tipo, monto").eq("usuario_id", user.id);
    if (movs) {
      const ing = movs.filter(m => String(m.tipo).toLowerCase() === "ingreso").reduce((s, m) => s + Math.abs(Number(m.monto)), 0);
      const gas = movs.filter(m => String(m.tipo).toLowerCase() === "gasto").reduce((s, m) => s + Math.abs(Number(m.monto)), 0);
      setStats({ movimientos: movs.length, ingresos: ing, gastos: gas });
    }
    setLoading(false);
  }

  async function guardarNombre() {
    if (!nuevoNombre.trim()) return;
    setGuardando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("perfil").update({ nombre: nuevoNombre.trim() }).eq("id", user.id);
    if (error) Alert.alert("Error", error.message);
    else {
      setNombre(nuevoNombre.trim());
      setEditModal(false);
      Alert.alert("¡Éxito!", "Nombre actualizado correctamente");
    }
    setGuardando(false);
  }

  async function cerrarSesion() {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: async () => {
        setCerrando(true);
        await supabase.auth.signOut();
        router.replace("/(auth)/login");
      }}
    ]);
  }

  const iniciales = nombre ? nombre[0].toUpperCase() : "U";

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" size="large" /></View>;

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View style={s.avatar}><Text style={s.avatarTxt}>{iniciales}</Text></View>
        <Text style={s.nombre}>{nombre || "Usuario"}</Text>
        <Text style={s.email}>{email}</Text>
        <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)}>
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={s.editBtnTxt}>Editar perfil</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Detalladas */}
      <View style={s.statsContainer}>
        <View style={s.statBox}>
          <Text style={s.statVal}>{stats.movimientos}</Text>
          <Text style={s.statLab}>REGISTROS</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statVal, { color: "#22c55e" }]}>S/ {stats.ingresos.toFixed(0)}</Text>
          <Text style={s.statLab}>INGRESOS</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statVal, { color: "#ef4444" }]}>S/ {stats.gastos.toFixed(0)}</Text>
          <Text style={s.statLab}>GASTOS</Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>CONFIGURACIÓN</Text>
        <View style={s.card}>
          <View style={s.menuItem}>
            <View style={[s.menuIcon, { backgroundColor: "#f0effe" }]}><Ionicons name="person-outline" size={20} color="#6366f1" /></View>
            <View style={{ flex: 1 }}><Text style={s.menuLabel}>Nombre Público</Text><Text style={s.menuSub}>{nombre || "Sin nombre"}</Text></View>
          </View>
          <View style={s.divider} />
          <View style={s.menuItem}>
            <View style={[s.menuIcon, { backgroundColor: "#fef9c3" }]}><Ionicons name="mail-outline" size={20} color="#ca8a04" /></View>
            <View style={{ flex: 1 }}><Text style={s.menuLabel}>Email de Registro</Text><Text style={s.menuSub}>{email}</Text></View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={cerrarSesion} disabled={cerrando}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={s.logoutTxt}>Cerrar Sesión</Text>
      </TouchableOpacity>

      {/* Modal Editar */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Editar Nombre</Text>
            <TextInput style={s.input} value={nuevoNombre} onChangeText={setNuevoNombre} placeholder="Tu nombre real" autoFocus />
            <View style={{flexDirection:'row', gap:10}}>
              <TouchableOpacity style={[s.modalBtn, {backgroundColor:'#f1f5f9'}]} onPress={() => setEditModal(false)}><Text style={{color:'#64748b', fontWeight:'700'}}>Cerrar</Text></TouchableOpacity>
              <TouchableOpacity style={s.modalBtn} onPress={guardarNombre} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnTxt}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { alignItems: "center", paddingTop: 80, paddingBottom: 50, backgroundColor: "#6366f1", borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  avatar: { width: 90, height: 90, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  avatarTxt: { fontSize: 32, fontWeight: "900", color: "#fff" },
  nombre: { fontSize: 24, fontWeight: "900", color: "#fff" },
  email: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 20 },
  editBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statsContainer: { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 24, marginTop: -35, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 5, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: "900", color: "#1e293b" },
  statLab: { fontSize: 9, color: "#94a3b8", fontWeight: "800", marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: "#f1f5f9" },
  section: { paddingHorizontal: 24, marginTop: 32 },
  sectionTitle: { fontSize: 12, fontWeight: "900", color: "#94a3b8", marginBottom: 16, letterSpacing: 1 },
  card: { backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 18, gap: 14 },
  menuIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  menuSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 24, marginTop: 40, backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: "#fee2e2" },
  logoutTxt: { fontSize: 16, fontWeight: "800", color: "#ef4444" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, paddingBottom: 50 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b', marginBottom: 24 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 18, fontSize: 16, marginBottom: 24, color: '#1e293b' },
  modalBtn: { flex: 1, backgroundColor: '#6366f1', borderRadius: 18, padding: 18, alignItems: 'center' },
  modalBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 }
});
