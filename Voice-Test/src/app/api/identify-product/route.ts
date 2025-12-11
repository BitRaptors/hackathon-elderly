import { NextRequest, NextResponse } from 'next/server'

const EXTERNAL_API_URL = 'https://matyasfodor.app.n8n.cloud/webhook/e3b1c34c-ca50-46b2-b10b-ac4ee30105bc/chat'

export async function POST(request: NextRequest) {
  try {
    // Extract the image from the FormData request
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    
    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'
    const base64DataUrl = `data:${mimeType};base64,${base64Image}`

    // Generate a session ID for this request (or use a fixed one for now)
    const sessionId = `session-${Date.now()}`

    // Call the external API with the image
    // Send the base64 image in the chatInput field along with a prompt
    const requestBody = {
      action: 'sendMessage',
      sessionId: sessionId,
      chatInput: `Please identify this product from the following image. Image data (base64): ${base64DataUrl}`,
    }

    const response = await fetch(EXTERNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('External API error:', errorText)
      throw new Error(`External API returned ${response.status}: ${errorText}`)
    }

    // Handle both JSON and text responses
    const contentType = response.headers.get('content-type')
    let data: any
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }
    
    // Parse the response - handle various response formats
    let responseText = ''
    if (typeof data === 'string') {
      responseText = data
    } else if (data.message) {
      responseText = data.message
    } else if (data.response) {
      responseText = data.response
    } else if (data.text) {
      responseText = data.text
    } else if (data.content) {
      responseText = data.content
    } else {
      responseText = JSON.stringify(data)
    }
    
    // Try to extract product name from the response
    // This is a simple extraction - adjust based on actual API response format
    const productMatch = responseText.match(/(?:product|identified|this is|it's|it is)[:\s]+([^.,\n]+)/i)
    const product = productMatch ? productMatch[1].trim() : responseText.substring(0, 100).trim()

    return NextResponse.json({
      product: product || 'Unknown Product',
      confidence: data.confidence || 0.9,
      description: responseText,
      rawResponse: data, // Include raw response for debugging
    })
  } catch (error) {
    console.error('Error identifying product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to identify product' },
      { status: 500 }
    )
  }
}

