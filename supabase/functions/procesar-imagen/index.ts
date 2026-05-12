import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

const CATEGORIAS = [
  // Gastos - Alimentación
  'Restaurantes', 'Supermercado', 'Comida rápida', 'Cafetería', 'Delivery',
  // Gastos - Transporte
  'Transporte público', 'Taxi / Uber', 'Combustible', 'Estacionamiento', 'Mantenimiento auto',
  // Gastos - Salud
  'Farmacia', 'Médico / Clínica', 'Seguro médico', 'Gimnasio', 'Salud mental',
  // Gastos - Educación
  'Matrícula / Pensión', 'Libros y útiles', 'Cursos online', 'Idiomas',
  // Gastos - Hogar
  'Alquiler', 'Electricidad', 'Agua', 'Internet / Cable', 'Celular', 'Limpieza', 'Reparaciones',
  // Gastos - Entretenimiento
  'Streaming', 'Videojuegos', 'Salidas / Ocio', 'Viajes', 'Deportes',
  // Gastos - Personal
  'Ropa y calzado', 'Peluquería / Belleza', 'Accesorios',
  // Gastos - Finanzas
  'Cuotas / Deudas', 'Impuestos', 'Seguros',
  // Gastos - Otros
  'Mascotas', 'Regalos', 'Donaciones', 'Otros gastos',
  // Ingresos
  'Salario', 'Freelance', 'Negocio propio', 'Inversiones', 'Alquiler cobrado', 'Bonos / Comisiones', 'Otros ingresos',
  // Ambos
  'Transferencias', 'Ahorro',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      }
    })
  }

  try {
    console.log('1. Función iniciada (Groq + Llama 4 Vision)')

    const body = await req.json()
    const { imagen_base64, mime_type, descripcion_usuario } = body

    if (!imagen_base64) {
      return Response.json({ error: 'imagen_base64 es requerido' }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      return Response.json({ error: 'GROQ_API_KEY no configurada en Supabase' }, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }

    const contextoUsuario = descripcion_usuario
      ? `CONTEXTO DEL USUARIO: "${descripcion_usuario}". Usa esto para mejorar la clasificación.`
      : ''

    const promptTexto = `Eres un experto en finanzas personales analizando un comprobante de pago peruano.

${contextoUsuario}

Analiza la imagen y extrae TODOS los datos posibles. Esta puede ser una captura de:
- Yape (app de pagos móvil peruana)
- Plin (app de pagos móvil peruana)  
- Voucher bancario (BCP, Interbank, BBVA, Scotiabank, etc.)
- Boleta o factura
- Recibo de servicio

INSTRUCCIONES DE CLASIFICACIÓN DE CATEGORÍAS:
- Si ves "Yape", "Plin", "transferencia" entre personas → "Transferencias"
- Si ves restaurante, menú, almuerzo, cena, café → "Restaurantes" o "Cafetería"
- Si ves mercado, supermercado, bodega, Metro, Wong, Plaza Vea → "Supermercado"  
- Si ves taxi, Uber, InDrive, bus, combi, metro → "Taxi / Uber" o "Transporte público"
- Si ves farmacia, InkaFarma, Mifarma, medicamento → "Farmacia"
- Si ves clínica, hospital, doctor, médico → "Médico / Clínica"
- Si ves Movistar, Claro, Entel, Bitel → "Celular"
- Si ves Netflix, Spotify, Disney, HBO, YouTube → "Streaming"
- Si ves universidad, colegio, pensión, matrícula → "Matrícula / Pensión"
- Si ves luz, recibo Enel, Luz del Sur → "Electricidad"
- Si ves agua, Sedapal → "Agua"
- Si ves sueldo, salario, planilla, haberes → "Salario"
- Si ves freelance, honorarios, servicio profesional → "Freelance"
- Si no puedes determinar con certeza → "Otros gastos" para gastos, "Otros ingresos" para ingresos

CATEGORÍAS DISPONIBLES:
${CATEGORIAS.join(', ')}

TIPOS DE MEDIO DE PAGO:
- "Yape": si ves el logo verde de Yape o dice "Yape"
- "Plin": si ves el logo de Plin o dice "Plin"  
- "Banco": si es un voucher bancario o transferencia bancaria directa
- "Efectivo": si menciona efectivo o no hay evidencia de pago digital
- "Tarjeta": si ves cargo a tarjeta de crédito o débito
- "Otro": si no puedes determinar

REGLAS IMPORTANTES:
- El monto SIEMPRE debe ser positivo (número absoluto)
- La fecha usa formato YYYY-MM-DD (si no hay año, usa ${new Date().getFullYear()})
- Si ves "S/" o "PEN" es moneda peruana (soles)
- La descripción debe ser breve (máx 60 caracteres) y descriptiva

Responde ÚNICAMENTE con JSON válido, sin explicaciones, sin markdown:
{"monto":0.00,"fecha":"YYYY-MM-DD","descripcion":"texto descriptivo breve","categoria_sugerida":"nombre exacto de la categoría","tipo":"gasto","medio_pago":"Yape","receptor":"nombre del receptor si aparece o null","emisor":"nombre del emisor si aparece o null"}`

    // Limpiamos el prefijo data:image/... si viene incluido
    const base64Data = imagen_base64.includes(',')
      ? imagen_base64.split(',')[1]
      : imagen_base64

    const imageUrl = `data:${mime_type || 'image/jpeg'};base64,${base64Data}`

    console.log('2. Enviando imagen a Groq (Llama 4 Scout Vision)...')
    console.log('Tamaño base64:', base64Data.length, 'chars')

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en OCR y análisis de comprobantes de pago peruanos. Siempre respondes con JSON válido y sin texto adicional.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              },
              {
                type: 'text',
                text: promptTexto
              }
            ]
          }
        ],
        max_tokens: 600,
        temperature: 0.05,
        response_format: { type: 'json_object' }
      })
    })

    console.log('3. Respuesta de Groq status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error de Groq:', errorText)
      let detalle = errorText
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) detalle = errorJson.error.message
      } catch (e) { /* no es json */ }
      return Response.json({ error: 'Error en Groq API', detalle }, {
        status: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }

    const groqData = await response.json()
    const texto = groqData?.choices?.[0]?.message?.content

    if (!texto) {
      console.error('Groq no devolvió contenido:', JSON.stringify(groqData))
      return Response.json({ error: 'Groq no devolvió contenido', detalle: groqData }, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }

    console.log('4. Respuesta de Groq:', texto)

    let resultado
    try {
      resultado = JSON.parse(texto)
    } catch (e) {
      // Intentamos extraer JSON con regex como fallback
      const jsonMatch = texto.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return Response.json({ error: 'No se encontró JSON en la respuesta', texto }, {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        })
      }
      try {
        resultado = JSON.parse(jsonMatch[0])
      } catch (e2) {
        return Response.json({ error: 'JSON inválido en respuesta del modelo', texto }, {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        })
      }
    }

    // Validamos y normalizamos la categoría
    if (resultado.categoria_sugerida && !CATEGORIAS.includes(resultado.categoria_sugerida)) {
      // Buscamos la más similar (básico)
      const encontrada = CATEGORIAS.find(cat => 
        cat.toLowerCase().includes(resultado.categoria_sugerida.toLowerCase()) ||
        resultado.categoria_sugerida.toLowerCase().includes(cat.toLowerCase().split(' ')[0])
      )
      resultado.categoria_sugerida = encontrada || (resultado.tipo === 'ingreso' ? 'Otros ingresos' : 'Otros gastos')
    }

    // Generamos recomendaciones NLP básicas
    const recomendaciones = generarRecomendaciones(resultado)
    resultado.recomendaciones = recomendaciones

    console.log('5. Resultado OK:', JSON.stringify(resultado))
    return Response.json(resultado, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    console.error('ERROR CRÍTICO:', error.message)
    return Response.json(
      { error: 'Error interno en la Edge Function', detalle: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})

function generarRecomendaciones(datos: any): string[] {
  const tips: string[] = []
  const monto = Number(datos.monto) || 0
  const cat = (datos.categoria_sugerida || '').toLowerCase()
  const tipo = (datos.tipo || '').toLowerCase()

  if (tipo === 'gasto') {
    if (cat.includes('restaurante') || cat.includes('delivery') || cat.includes('comida')) {
      if (monto > 50) tips.push('💡 Cocinar en casa puede ahorrarte hasta 60% en alimentación.')
    }
    if (cat.includes('taxi') || cat.includes('uber')) {
      if (monto > 20) tips.push('🚌 Considera el transporte público para rutas frecuentes y ahorra más.')
    }
    if (cat.includes('streaming')) {
      tips.push('📱 ¿Usas todos tus servicios de streaming? Revisa cuáles realmente aprovechas.')
    }
    if (cat.includes('cuota') || cat.includes('deuda')) {
      tips.push('💳 Prioriza pagar deudas de mayor interés primero (método avalancha).')
    }
    if (monto > 200) {
      tips.push('📊 Este es un gasto significativo. ¿Estaba planificado en tu presupuesto?')
    }
  }

  if (tipo === 'ingreso') {
    tips.push('🏦 Recuerda destinar al menos 20% de tus ingresos al ahorro.')
    if (cat.includes('salario')) {
      tips.push('📈 Considera invertir parte de tu salario en fondos o acciones.')
    }
  }

  if (datos.medio_pago === 'Yape' || datos.medio_pago === 'Plin') {
    tips.push('✅ Pagos digitales: más seguro y con registro automático.')
  }

  return tips.slice(0, 2) // máximo 2 recomendaciones
}