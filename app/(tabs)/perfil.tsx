import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function Perfil() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setEmail(user.email || "");

    const { data } = await supabase
      .from("perfil")
      .select("nombre")
      .eq("id", user.id)
      .single();

    if (data?.nombre) setNombre(data.nombre);
    setLoading(false);
  }

  async function cerrarSesion() {
    setCerrandoSesion(true);
    const { error } = await supabase.auth.signOut();
    setCerrandoSesion(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    router.replace("/(auth)/login");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Perfil</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={34} color="#6C63FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre}>{nombre || "Usuario"}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, cerrandoSesion && styles.buttonDisabled]}
        onPress={cerrarSesion}
        disabled={cerrandoSesion}
      >
        <Ionicons name="log-out-outline" size={22} color="#fff" />
        <Text style={styles.logoutText}>
          {cerrandoSesion ? "Cerrando sesion..." : "Cerrar sesion"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  titulo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#eeeeee",
    marginBottom: 18,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#f0effe",
    alignItems: "center",
    justifyContent: "center",
  },
  nombre: { fontSize: 18, fontWeight: "800", color: "#111827" },
  email: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  logoutButton: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.75 },
  logoutText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
