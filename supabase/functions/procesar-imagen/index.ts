import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!

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
    console.log('1. Función iniciada')
    
    const body = await req.json()
    console.log('2. Body recibido, tiene imagen:', !!body.imagen_base64)

    const { imagen_base64, mime_type, descripcion_usuario } = body

    if (!imagen_base64) {
      return Response.json({ error: 'imagen_base64 es requerido' }, { status: 400 })
    }

    console.log('3. Llamando a Claude...')
    console.log('4. API Key existe:', !!CLAUDE_API_KEY)

    const promptDescripcion = descripcion_usuario
      ? `El usuario indicó que este pago es por: "${descripcion_usuario}". Usa esa info como contexto.`
      : `No hay descripción del usuario, infiere la descripción desde la imagen.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mime_type || 'image/jpeg',
                  data: imagen_base64
                }
              },
              {
                type: 'text',
                text: `Analiza este comprobante de pago (puede ser Yape, Plin, voucher bancario o recibo).
${promptDescripcion}

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown:

{
  "monto": número decimal,
  "fecha": "YYYY-MM-DD",
  "descripcion": "descripción breve del pago",
  "categoria_sugerida": "una de estas exactamente: Alimentación, Transporte, Salud, Educación, Entretenimiento, Servicios, Compras, Ropa, Mascotas, Ahorro, Salario, Freelance, Negocio, Inversiones, Transferencias, Otros",
  "tipo": "gasto o ingreso",
  "medio_pago": "Yape, Plin, Banco, Efectivo u Otro"
}

Si no puedes detectar algún campo usa null.`
              }
            ]
          }
        ]
      })
    })

    console.log('5. Respuesta de Claude status:', response.status)

    const claudeData = await response.json()
    console.log('6. Claude respondió:', JSON.stringify(claudeData).substring(0, 200))

    if (!claudeData.content || !claudeData.content[0]) {
      return Response.json({ error: 'Claude no devolvió contenido', detalle: claudeData }, { status: 500 })
    }

    const texto = claudeData.content[0].text
    console.log('7. Texto de Claude:', texto)

    // Limpiamos por si Claude agrega markdown
    const textoLimpio = texto.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(textoLimpio)

    console.log('8. Resultado parseado OK')

    return Response.json(resultado, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    console.error('ERROR:', error.message)
    return Response.json(
      { error: 'Error procesando la imagen', detalle: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})