export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload'

export async function POST(request: Request) {
  try {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY
    if (!privateKey || !publicKey) {
      return NextResponse.json({ success: false, error: 'ImageKit not configured' }, { status: 500 })
    }

    const incoming = await request.formData()
    const file = incoming.get('file') as File | null
    const folder = (incoming.get('folder') as string) || '/uploads'
    const fileName = (incoming.get('fileName') as string) || `upload_${Date.now()}`

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const authHeader = 'Basic ' + Buffer.from(`${privateKey}:`).toString('base64')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('fileName', fileName)
    fd.append('folder', folder)
    fd.append('publicKey', publicKey)

    const res = await fetch(IMAGEKIT_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: fd,
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[ImageKit Upload] Error:', data)
      return NextResponse.json({ success: false, error: data.message || 'Upload failed' }, { status: res.status })
    }

    return NextResponse.json({ success: true, url: data.url, fileId: data.fileId })
  } catch (error: any) {
    console.error('[ImageKit Upload] Exception:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
