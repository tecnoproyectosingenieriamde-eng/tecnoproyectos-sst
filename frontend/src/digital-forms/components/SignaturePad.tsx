import { useEffect, useRef } from 'react'

type SignaturePadProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function SignaturePad({ label, value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!value) return
    const image = new Image()
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.src = value
    hasDrawn.current = true
  }, [value])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const bounds = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    }
  }

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    const point = getPoint(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.strokeStyle = '#183d31'
    context.lineWidth = 3
    context.lineCap = 'round'
    context.lineJoin = 'round'
    drawing.current = true
    hasDrawn.current = true
  }

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    event.preventDefault()
    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const finishDrawing = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && hasDrawn.current) onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height)
    drawing.current = false
    hasDrawn.current = false
    onChange('')
  }

  return <div className="signature-field">
    <div className="signature-label-row">
      <span>{label}</span>
      <button type="button" className="remove-row" onClick={clear}>Borrar firma</button>
    </div>
    <canvas
      ref={canvasRef}
      className="signature-canvas"
      width={600}
      height={140}
      aria-label={label}
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={finishDrawing}
      onPointerCancel={finishDrawing}
    />
    <small>Firma de prueba: dibuja con el ratón, dedo o lápiz.</small>
  </div>
}
