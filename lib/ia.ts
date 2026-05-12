import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

export async function seleccionarImagen() {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permiso.granted) {
    throw new Error('Se necesita permiso para acceder a las fotos')
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    quality: 0.7,
  })

  if (resultado.canceled) return null
  return resultado.assets[0]
}

export async function procesarImagenConIA(imagen_base64: string, descripcion_usuario?: string) {
  const { data, error } = await supabase.functions.invoke('procesar-imagen', {
    body: {
      imagen_base64,
      mime_type: 'image/jpeg',
      descripcion_usuario: descripcion_usuario || null
    }
  })

  if (error) {
    console.error('--- ERROR EN EDGE FUNCTION ---');
    console.error('Mensaje:', error.message);
    console.error('Status:', (error as any).status);
    
    let mensajeDetallado = error.message;

    // Intentamos extraer el cuerpo de la respuesta del error
    if (error instanceof Error && 'context' in error) {
      try {
        const response = (error as any).context;
        if (response && typeof response.text === 'function') {
          const bodyText = await response.text();
          console.error('Cuerpo de la respuesta:', bodyText);
          try {
            const bodyJson = JSON.parse(bodyText);
            if (bodyJson.error) mensajeDetallado = bodyJson.error;
            if (bodyJson.detalle) mensajeDetallado += `: ${bodyJson.detalle}`;
          } catch (e) {
            mensajeDetallado = bodyText;
          }
        }
      } catch (e) {
        console.error('No se pudo leer el cuerpo del error:', e);
      }
    }
    
    throw new Error(mensajeDetallado);
  }
  
  return data
}
