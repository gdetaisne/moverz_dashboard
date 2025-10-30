import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'dashboard', 'data')
const mdPath = path.join(dataDir, 'strategy.md')
const jsonPath = path.join(dataDir, 'strategy.json')

export async function GET() {
  try {
    const [md, js] = await Promise.all([
      fs.readFile(mdPath, 'utf-8').catch(() => ''),
      fs.readFile(jsonPath, 'utf-8').catch(() => ''),
    ])
    return NextResponse.json({ success: true, data: { markdown: md, json: js } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { markdown = '', jsonText = '' } = await request.json()

    // Validate JSON if provided
    if (jsonText) {
      try { JSON.parse(jsonText) } catch (e: any) {
        return NextResponse.json({ success: false, error: 'JSON invalide' }, { status: 400 })
      }
    }

    await fs.mkdir(dataDir, { recursive: true })
    await Promise.all([
      fs.writeFile(mdPath, markdown ?? '', 'utf-8'),
      fs.writeFile(jsonPath, jsonText ?? '', 'utf-8'),
    ])

    return NextResponse.json({ success: true, savedAt: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}


