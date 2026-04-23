'use client'
import { useEffect, useRef } from 'react'

interface Props { trigger: boolean }

export function Confetti({ trigger }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!trigger) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#FF2D55', '#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF6B6B']
    const particles: { x:number;y:number;vx:number;vy:number;color:string;size:number;rotation:number;rv:number }[] = []

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rv: (Math.random() - 0.5) * 0.2,
      })
    }

    let frame = 0
    const max = 120
    const w = canvas.width
    const h = canvas.height

    function draw() {
      ctx.clearRect(0, 0, w, h)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.rotation += p.rv
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, 1 - frame / max)
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      })
      frame++
      if (frame < max) requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, w, h)
    }

    draw()
  }, [trigger])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9998]"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}