import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createId } from './id'
import type { MediaKind } from './types'

type CloudUploadResult = {
  name: string
  kind: MediaKind
  url: string
  mimeType: string
  size: number
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const bucket = (import.meta.env.VITE_SUPABASE_BUCKET as string | undefined) || 'media'
const cloudUploadEnabled = import.meta.env.VITE_ENABLE_CLOUD_UPLOAD === 'true'

let supabaseClient: SupabaseClient | undefined

export const isCloudStorageConfigured = () => Boolean(cloudUploadEnabled && supabaseUrl && supabaseAnonKey)

const getSupabase = () => {
  if (!isCloudStorageConfigured()) {
    throw new Error('La subida cloud no esta configurada o no esta habilitada.')
  }

  const url = supabaseUrl as string
  const anonKey = supabaseAnonKey as string

  supabaseClient ??= createClient(url, anonKey)
  return supabaseClient
}

export const getCloudUser = async () => {
  if (!isCloudStorageConfigured()) {
    return null
  }

  const { data } = await getSupabase().auth.getUser()
  return data.user
}

export const signInCloudUser = async (email: string, password: string) => {
  const { error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const signOutCloudUser = async () => {
  const { error } = await getSupabase().auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

const requireCloudUser = async () => {
  const user = await getCloudUser()

  if (!user) {
    throw new Error('Inicia sesion para publicar contenido.')
  }

  return user
}

const sanitizeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

const buildStoragePath = (file: File) => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const safeName = sanitizeFileName(file.name) || 'media'

  return `${year}/${month}/${createId()}-${safeName}`
}

const buildJsonPath = (name: string) => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const safeName = sanitizeFileName(name) || 'playlist'

  return `playlists/${year}/${month}/${createId()}-${safeName}.json`
}

export const uploadFilesToCloud = async (files: File[]): Promise<CloudUploadResult[]> => {
  const supabase = getSupabase()
  const user = await requireCloudUser()
  const uploaded: CloudUploadResult[] = []

  for (const file of files) {
    const kind: MediaKind = file.type.startsWith('video/') ? 'video' : 'image'
    const storagePath = `${user.id}/${buildStoragePath(file)}`
    const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
      cacheControl: '31536000',
      contentType: file.type || undefined,
      upsert: false,
    })

    if (error) {
      throw new Error(`No se pudo subir ${file.name}: ${error.message}`)
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)

    uploaded.push({
      name: file.name,
      kind,
      url: data.publicUrl,
      mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/*'),
      size: file.size,
    })
  }

  return uploaded
}

export const publishJsonToCloud = async (name: string, content: unknown) => {
  const supabase = getSupabase()
  const user = await requireCloudUser()
  const storagePath = `${user.id}/${buildJsonPath(name)}`
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: 'application/json',
  })
  const { error } = await supabase.storage.from(bucket).upload(storagePath, blob, {
    cacheControl: '60',
    contentType: 'application/json',
    upsert: false,
  })

  if (error) {
    throw new Error(`No se pudo publicar la playlist: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  return data.publicUrl
}
