import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!

Deno.serve(async (req) => {

  // CORS para que la app pueda llamar a esta función
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      }
    })
  }

  try {
    // Recibimos la imagen en base64 desde la app
    const { imagen_base64, mime_type } = await req.json()

    if (!imagen_base64) {
      return Response.json({ error: 'imagen_base64 es requerido' }, { status: 400 })
    }

    // Llamamos a Claude con la imagen
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
                
Extrae la siguiente información y responde ÚNICAMENTE con un JSON válido, sin texto adicional:

{
  "monto": número decimal (ej: 22.50),
  "fecha": "YYYY-MM-DD",
  "descripcion": "descripción breve del pago",
  "categoria_sugerida": "una de estas: Alimentación, Transporte, Salud, Educación, Entretenimiento, Servicios, Compras, Ropa, Mascotas, Ahorro, Salario, Freelance, Negocio, Inversiones, Transferencias, Otros",
  "tipo": "gasto" o "ingreso",
  "medio_pago": "Yape, Plin, Banco, Efectivo u Otro"
}

Si no puedes detectar algún campo con certeza, usa null para ese campo.`
              }
            ]
          }
        ]
      })
    })

    const claudeData = await response.json()
    
    // Extraemos el texto de la respuesta de Claude
    const texto = claudeData.content[0].text
    
    // Parseamos el JSON que devolvió Claude
    const resultado = JSON.parse(texto)

    return Response.json(resultado, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    return Response.json(
      { error: 'Error procesando la imagen', detalle: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})