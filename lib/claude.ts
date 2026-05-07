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

export async function procesarImagen(imagen_base64: string, descripcion_usuario?: string) {
  const { data, error } = await supabase.functions.invoke('procesar-imagen', {
    body: {
      imagen_base64,
      mime_type: 'image/jpeg',
      descripcion_usuario: descripcion_usuario || null
    }
  })

  if (error) throw new Error(error.message)
  return data
}
