import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GraficoResumen from "@/components/GraficoResumen";

type Mov = { id: string; categoria_id: string | null; tipo: string | null; monto: number; fecha: string; descripcion: string | null; medio_pago?: string; categoria?: { id: string; nombre: string; icono: string | null } | null; };

const COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#8b5cf6"];

function money(v: number) { return `S/ ${Math.abs(v).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`; }
function mabs(v: number | string) { return Math.abs(Number(v) || 0); }
function mkey(f?: string | null) { return String(f || "").slice(0, 7); }
function mlabel(k: string) {
  if (!k) return "—";
  const [y, m] = k.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
}
function bar(v: number, max: number) {
  return `${Math.max(3, Math.min(100, max > 0 ? (Math.abs(v) / max) * 100 : 0))}%`;
}

// NLP: Normalización avanzada para entender errores ortográficos
function clean(t: string) {
  return t.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita tildes
    .replace(/[^a-z0-9 ]/g, "") // Quita signos
    .replace(/\s+/g, " ") // Quita espacios extra
    .trim();
}

export default function Reportes() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'ia', msg: string}[]>([
    { role: 'ia', msg: 'Hola. Soy tu Asesor Financiero IA. Analicé tus datos. Pregúntame sobre tus ingresos, gastos o pide consejos.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [chatHistory, isTyping, chatOpen]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMovs([]); return; }
      const { data: raw } = await supabase.from("movimiento")
        .select("id, categoria_id, tipo, monto, fecha, descripcion, medio_pago")
        .eq("usuario_id", user.id).order("fecha", { ascending: false });

      const ids = [...new Set((raw || []).map(m => m.categoria_id).filter(Boolean))] as string[];
      let catMap: Record<string, any> = {};
      if (ids.length) {
        const { data: cats } = await supabase.from("categoria").select("id, nombre, icono").in("id", ids);
        catMap = Object.fromEntries((cats || []).map(c => [c.id, c]));
      }

      setMovs(((raw || []) as Mov[]).map(m => ({
        ...m,
        monto: mabs(m.monto),
        categoria: m.categoria_id ? catMap[m.categoria_id] : null
      })));
    } catch (e) { console.log(e); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const df = useMemo(() => {
    const dm = movs.filter(m => mkey(m.fecha) === mes) || [];
    const ks = [...new Set(movs.map(m => mkey(m.fecha)))].filter(Boolean).sort((a,b) => b.localeCompare(a)).slice(0, 12);
    const ingL = dm.filter(m => m.tipo?.toLowerCase() === "ingreso");
    const gasL = dm.filter(m => m.tipo?.toLowerCase() === "gasto");
    
    const tI = ingL.reduce((s, m) => s + m.monto, 0);
    const tG = gasL.reduce((s, m) => s + m.monto, 0);
    const aTotal = movs.filter(m => m.tipo?.toLowerCase() === "ingreso").reduce((s, m) => s + m.monto, 0) - 
                   movs.filter(m => m.tipo?.toLowerCase() === "gasto").reduce((s, m) => s + m.monto, 0);

    const iMayor = ingL.length > 0 ? [...ingL].sort((a,b) => b.monto - a.monto)[0] : null;
    const iMenor = ingL.length > 0 ? [...ingL].sort((a,b) => a.monto - b.monto)[0] : null;
    const gMayor = gasL.length > 0 ? [...gasL].sort((a,b) => b.monto - a.monto)[0] : null;
    const gMenor = gasL.length > 0 ? [...gasL].sort((a,b) => a.monto - b.monto)[0] : null;

    const cats: Record<string, any> = {};
    gasL.forEach(m => {
      const k = m.categoria_id || "sin";
      if (!cats[k]) cats[k] = { nombre: m.categoria?.nombre || "Varios", total: 0 };
      cats[k].total += m.monto;
    });

    const medios: Record<string, number> = {};
    gasL.forEach(m => {
      const med = m.medio_pago || "Efectivo";
      medios[med] = (medios[med] || 0) + m.monto;
    });

    const heat = Array.from({ length: 31 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      const f = `${mes}-${day}`;
      const tot = gasL.filter(m => m.fecha === f).reduce((s, m) => s + m.monto, 0);
      return { day: i + 1, total: tot };
    });

    const gSemana = Array(7).fill(0);
    gasL.forEach(m => {
      const d = new Date(m.fecha + "T12:00:00").getDay();
      gSemana[d] += m.monto;
    });

    const evol = ks.slice(0, 6).reverse().map(k => {
      const ms = movs.filter(m => mkey(m.fecha) === k);
      const i = ms.filter(m => m.tipo?.toLowerCase() === "ingreso").reduce((s, m) => s + m.monto, 0);
      const g = ms.filter(m => m.tipo?.toLowerCase() === "gasto").reduce((s, m) => s + m.monto, 0);
      return { label: mlabel(k), ing: i, gas: g, ahorro: i - g };
    });

    const recs = [];
    if (tG > tI) recs.push({ t: "Déficit Detectado", d: `Gastas ${money(tG-tI)} más de lo que ingresas.`, i: "warning", c: "#ef4444" });
    const topC = Object.values(cats).sort((a:any,b:any) => b.total - a.total)[0] as any;
    if (topC) recs.push({ t: `Foco en ${topC.nombre}`, d: `Concentras el ${((topC.total/tG)*100).toFixed(0)}% de tus gastos aquí.`, i: "pie-chart", c: "#f59e0b" });
    if (tI > 0) recs.push({ t: "Meta de Ahorro", d: `Si separas el 20%, tendrías ${money(tI*0.2)} asegurados.`, i: "leaf", c: "#22c55e" });
    const dP = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][gSemana.indexOf(Math.max(...gSemana))];
    recs.push({ t: "Día Crítico", d: `Ten cuidado los ${dP}, son tus días de mayor consumo.`, i: "calendar", c: "#8b5cf6" });
    const fS = tG * 3;
    recs.push({ t: "Fondo Emergencia", d: aTotal >= fS ? "Tienes un fondo sólido." : `Te faltan ${money(fS-aTotal)} para tu reserva ideal.`, i: "shield", c: "#14b8a6" });

    return {
      totIng: tI, totGas: tG, ahorroTotal: aTotal,
      catGastos: Object.values(cats).sort((a:any,b:any) => b.total - a.total) || [],
      mediosPago: Object.entries(medios).map(([nombre, total]) => ({ nombre, total })),
      top10: [...gasL].sort((a,b) => b.monto - a.monto).slice(0, 10),
      heatMap: heat,
      diaSemana: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((l, i) => ({ label: l, total: gSemana[i] })),
      evolMensual: evol,
      ingMayor: iMayor, ingMenor: iMenor, gasMayor: gMayor, gasMenor: gMenor,
      mesLabel: mlabel(mes), meses: ks, recomendaciones: recs
    };
  }, [movs, mes]);

  const handleChat = () => {
    if (!chatMsg.trim() || isTyping) return;
    const input = clean(chatMsg);
    setChatHistory(p => [...p, { role: 'user', msg: chatMsg }]);
    setChatMsg("");
    setIsTyping(true);

    let res = "No pude encontrar ese dato. Prueba con: 'gasto menor', 'ingreso menor', 'todos los ingresos' o 'ahorro total'.";
    
    // ANALIZADOR DE INTENCIONES CON NLP (RESILIENTE A ERRORES)
    const matches = (keys: string[]) => keys.some(k => input.includes(k));

    if (matches(["gasto menor", "gasto mas bajo", "gasto bajo", "menor gasto", "gasto menr"])) {
      res = df.gasMenor ? `Tu gasto más bajo de este mes fue de ${money(df.gasMenor.monto)} en ${df.gasMenor.categoria?.nombre || 'Varios'}.` : "No hay gastos registrados.";
    } 
    else if (matches(["gasto mayor", "gasto mas alto", "gasto alto", "mayor gasto", "gasto mallor"])) {
      res = df.gasMayor ? `Tu mayor gasto fue de ${money(df.gasMayor.monto)} en la categoría ${df.gasMayor.categoria?.nombre || 'General'}.` : "No hay gastos.";
    }
    else if (matches(["ingreso menor", "menos gane", "ingreso bajo", "menor ingreso"])) {
      res = df.ingMenor ? `Tu ingreso más bajo fue de ${money(df.ingMenor.monto)} el día ${df.ingMenor.fecha}.` : "No hay ingresos.";
    }
    else if (matches(["ingreso mayor", "mas gane", "mayor ingreso", "ingreso mallor"])) {
      res = df.ingMayor ? `Tu mayor ingreso fue de ${money(df.ingMayor.monto)} (${df.ingMayor.descripcion || 'General'}).` : "Sin ingresos.";
    }
    else if (matches(["todos los ingresos", "total ingresos", "cuanto gane", "mis ingresos"])) {
      res = `Este mes tus ingresos totales suman ${money(df.totIng)}.`;
    }
    else if (matches(["todos los gastos", "total gastos", "cuanto gaste", "mis gastos"])) {
      res = `Este mes tus gastos totales suman ${money(df.totGas)}.`;
    }
    else if (matches(["ahorro total", "ahorro acumulado", "patrimonio", "cuanto tengo"])) {
      res = `Tu patrimonio total acumulado (ahorro histórico) es de ${money(df.ahorroTotal)}.`;
    }
    else if (matches(["recomienda", "consejo", "ayuda", "que hago", "tips"])) {
      const r = df.recomendaciones[Math.floor(Math.random() * df.recomendaciones.length)];
      res = `Análisis IA: **${r.t}**. ${r.d}`;
    }

    setTimeout(() => {
      setChatHistory(p => [...p, { role: 'ia', msg: res }]);
      setIsTyping(false);
    }, 600);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#6366f1" size="large" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.wrap} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <Text style={s.title}>Reportes</Text>
          <TouchableOpacity style={s.chatBtn} onPress={() => setChatOpen(true)}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={s.chatBtnTxt}>Asesor IA</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.ahorroCard, { backgroundColor: df.ahorroTotal >= 0 ? "#1e293b" : "#ef4444" }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.ahorroLbl}>AHORRO TOTAL ACUMULADO</Text>
            <Text style={s.ahorroVal}>{money(df.ahorroTotal)}</Text>
            <Text style={s.ahorroSub}>Patrimonio consolidado (Histórico)</Text>
          </View>
          <Ionicons name="stats-chart" size={40} color="rgba(255,255,255,0.2)" />
        </View>

        <GraficoResumen ingresos={df.totIng} gastos={df.totGas} ahorro={df.totIng - df.totGas} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mesScroll}>
          {df.meses.map(k => (
            <TouchableOpacity key={k} style={[s.mesTab, mes === k && s.mesTabAct]} onPress={() => setMes(k)}>
              <Text style={[s.mesTxt, mes === k && s.mesTxtAct]}>{mlabel(k)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.card}>
          <Text style={s.cardTitle}>🤖 Coach Financiero IA</Text>
          {df.recomendaciones.map((r, i) => (
            <View key={i} style={[s.recRow, { borderLeftColor: r.c }]}>
              <Ionicons name={r.i as any} size={22} color={r.c} />
              <View style={{ flex: 1 }}>
                <Text style={[s.recTitle, { color: r.c }]}>{r.t}</Text>
                <Text style={s.recDesc}>{r.d}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Distribución por Categorías</Text>
          <View style={s.donutWrap}>
            {df.catGastos.slice(0, 5).map((c:any, i:number) => {
              const size = 160 - i * 28;
              return <View key={i} style={[s.donutRing, { width: size, height: size, borderColor: COLORS[i % COLORS.length], borderTopWidth: 6, borderRightWidth: 6 }]} />;
            })}
            <View style={s.donutCenter}>
              <Text style={s.donutTotal}>{money(df.totGas)}</Text>
              <Text style={s.donutLbl}>Gasto Mensual</Text>
            </View>
          </View>
          <View style={s.legendWrap}>
            {df.catGastos.slice(0, 4).map((c:any, i:number) => (
              <View key={i} style={s.legItem}>
                <View style={[s.legDot, { backgroundColor: COLORS[i % COLORS.length] }]} />
                <Text style={s.legTxt}>{c.nombre} ({((c.total / df.totGas) * 100).toFixed(0)}%)</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Intensidad de Gasto por Día</Text>
          <View style={s.heatGrid}>
            {df.heatMap.map((d, i) => {
              const maxH = Math.max(...df.heatMap.map(x=>x.total), 1);
              const intensity = d.total / maxH;
              const bg = d.total === 0 ? "#f1f5f9" : intensity < 0.3 ? "#e0e7ff" : intensity < 0.7 ? "#6366f1" : "#1e1b4b";
              return (
                <View key={i} style={[s.heatCell, { backgroundColor: bg }]}>
                  <Text style={[s.heatDay, { color: intensity > 0.5 ? "#fff" : "#94a3b8" }]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Gastos por Medio de Pago</Text>
          {df.mediosPago.map((m, i) => (
            <View key={i} style={s.payItem}>
              <View style={s.payLabelRow}>
                <Text style={s.payName}>{m.nombre}</Text>
                <Text style={s.payVal}>{money(m.total)}</Text>
              </View>
              <View style={s.payTrack}>
                <View style={[s.payFill, { width: bar(m.total, Math.max(...df.mediosPago.map(x=>x.total), 1)), backgroundColor: COLORS[i % COLORS.length] }]} />
              </View>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Tendencia de Ahorro Neto</Text>
          <View style={s.trendChart}>
            {df.evolMensual.map((e, i) => (
              <View key={i} style={s.trendCol}>
                <View style={[s.trendBar, { height: bar(Math.abs(e.ahorro), Math.max(...df.evolMensual.map(x=>Math.abs(x.ahorro)), 1)), backgroundColor: e.ahorro >= 0 ? "#22c55e" : "#ef4444" }]} />
                <Text style={s.labelMini}>{e.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Hábitos de Gasto Semanal</Text>
          <View style={s.weekChart}>
            {df.diaSemana.map((d, i) => (
              <View key={i} style={s.weekCol}>
                <View style={s.weekTrack}>
                  <View style={[s.weekFill, { height: bar(d.total, Math.max(...df.diaSemana.map(x=>x.total), 1)) }]} />
                </View>
                <Text style={s.labelMini}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Evolución Ingresos vs Gastos</Text>
          <View style={s.evolChart}>
            {df.evolMensual.map((e, i) => {
              const maxVal = Math.max(...df.evolMensual.map(x => Math.max(x.ing, x.gas)), 1);
              return (
                <View key={i} style={s.evolCol}>
                  <View style={s.evolPair}>
                    <View style={s.evolTrack}><View style={[s.evolFill, { height: bar(e.ing, maxVal), backgroundColor: "#22c55e" }]} /></View>
                    <View style={s.evolTrack}><View style={[s.evolFill, { height: bar(e.gas, maxVal), backgroundColor: "#ef4444" }]} /></View>
                  </View>
                  <Text style={s.labelMini}>{e.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Top 10 Gastos Mayores</Text>
          {df.top10.length === 0 ? <Text style={s.empty}>Sin gastos este mes</Text> : df.top10.map((m, i) => (
            <View key={m.id} style={s.topItem}>
              <View style={s.topIdx}><Text style={s.topIdxTxt}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.topDesc} numberOfLines={1}>{m.descripcion || m.categoria?.nombre}</Text>
                <Text style={s.topSub}>{m.fecha} · {m.categoria?.nombre}</Text>
              </View>
              <Text style={s.topAmt}>-{money(m.monto)}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={chatOpen} animationType="slide" transparent>
        <View style={s.chatOverlay}>
          <View style={s.chatContainer}>
            <View style={s.chatHeader}>
              <Text style={s.chatTitle}>Asesor Financiero IA</Text>
              <TouchableOpacity onPress={() => setChatOpen(false)}>
                <Ionicons name="close-circle" size={32} color="#6366f1" />
              </TouchableOpacity>
            </View>
            <ScrollView ref={scrollViewRef} style={s.chatHistory} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
              {chatHistory.map((h, i) => (
                <View key={i} style={[s.msgBubble, h.role === 'user' ? s.userMsg : s.iaMsg]}>
                  <Text style={[s.msgText, h.role === 'user' ? s.userTxt : s.iaTxt]}>{h.msg}</Text>
                </View>
              ))}
              {isTyping && <View style={[s.msgBubble, s.iaMsg]}><ActivityIndicator size="small" color="#6366f1" /></View>}
            </ScrollView>
            <View style={s.chatInputWrap}>
              <TextInput style={s.chatInput} value={chatMsg} onChangeText={setChatMsg} placeholder="Pregunta: ¿Cual fue mi ingreso menor?" placeholderTextColor="#94a3b8" onSubmitEditing={handleChat} />
              <TouchableOpacity style={s.sendBtn} onPress={handleChat}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 24, paddingTop: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "900", color: "#1e293b" },
  chatBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1e293b", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  chatBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  ahorroCard: { borderRadius: 32, padding: 24, marginBottom: 20, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  ahorroLbl: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "800", letterSpacing: 1.5 },
  ahorroVal: { fontSize: 34, fontWeight: "900", color: "#fff", marginVertical: 6 },
  ahorroSub: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  card: { backgroundColor: "#fff", borderRadius: 32, padding: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 15, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b", marginBottom: 20 },
  mesScroll: { marginBottom: 24 },
  mesTab: { backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, marginRight: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  mesTabAct: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  mesTxt: { fontSize: 13, color: "#64748b", fontWeight: "700" },
  mesTxtAct: { color: "#fff" },
  recRow: { flexDirection: "row", gap: 16, padding: 16, backgroundColor: "#f8fafc", borderRadius: 20, marginBottom: 12, borderLeftWidth: 4 },
  recTitle: { fontSize: 14, fontWeight: "900" },
  recDesc: { fontSize: 13, color: "#64748b", marginTop: 2, lineHeight: 18 },
  donutWrap: { height: 180, alignItems: "center", justifyContent: "center" },
  donutRing: { position: "absolute", borderRadius: 100, borderLeftWidth: 0, borderBottomWidth: 0, transform: [{ rotate: "45deg" }] },
  donutCenter: { alignItems: "center" },
  donutTotal: { fontSize: 20, fontWeight: "900", color: "#1e293b" },
  donutLbl: { fontSize: 12, color: "#94a3b8" },
  legendWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 20 },
  legItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legTxt: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  heatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  heatCell: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  heatDay: { fontSize: 10, fontWeight: "700" },
  payItem: { marginBottom: 16 },
  payLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  payName: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  payVal: { fontSize: 13, fontWeight: "800", color: "#1e293b" },
  payTrack: { height: 8, backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  payFill: { height: "100%", borderRadius: 4 },
  trendChart: { flexDirection: "row", height: 100, gap: 10, alignItems: "flex-end", justifyContent: "space-between" },
  trendCol: { alignItems: "center", flex: 1 },
  trendBar: { width: "100%", borderRadius: 4 },
  weekChart: { flexDirection: "row", height: 100, gap: 12, alignItems: "flex-end", justifyContent: "space-between" },
  weekCol: { alignItems: "center" },
  weekTrack: { width: 26, height: 80, backgroundColor: "#f1f5f9", borderRadius: 8, justifyContent: "flex-end", overflow: "hidden" },
  weekFill: { backgroundColor: "#6366f1", borderRadius: 6 },
  labelMini: { fontSize: 9, color: "#94a3b8", marginTop: 8, fontWeight: "700" },
  evolChart: { flexDirection: "row", height: 120, gap: 10, alignItems: "flex-end" },
  evolCol: { flex: 1, alignItems: "center" },
  evolPair: { flexDirection: "row", gap: 3, height: 90, alignItems: "flex-end" },
  evolTrack: { width: 10, height: 90, backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  evolFill: { width: "100%", borderRadius: 2 },
  topItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  topIdx: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  topIdxTxt: { fontSize: 12, fontWeight: "800", color: "#64748b" },
  topDesc: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  topSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  topAmt: { fontSize: 14, fontWeight: "900", color: "#ef4444" },
  empty: { color: "#94a3b8", fontSize: 14, textAlign: "center", paddingVertical: 20 },
  chatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  chatContainer: { backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, height: '80%', padding: 24 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  chatTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  chatHistory: { flex: 1, marginBottom: 20 },
  msgBubble: { padding: 16, borderRadius: 24, marginBottom: 12, maxWidth: '85%' },
  userMsg: { alignSelf: 'flex-end', backgroundColor: '#6366f1' },
  iaMsg: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9' },
  msgText: { fontSize: 15, lineHeight: 22 },
  userTxt: { color: '#fff' },
  iaTxt: { color: '#1e293b' },
  chatInputWrap: { flexDirection: 'row', gap: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 15 },
  chatInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 20, padding: 16, fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  sendBtn: { backgroundColor: '#6366f1', width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }
});
