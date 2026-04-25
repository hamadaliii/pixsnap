'use client'
import { useState } from 'react'
import type { Photo } from '@/types'

interface PhotoGridProps {
  photos: Photo[]
  allowDelete?: boolean
  onDelete?: (photo: Photo) => void
}

/** Returns best displayable URL — watermark_url is always JPEG (never HEIC) */
function displayUrl(photo: Photo): string {
  return photo.watermark_url || photo.public_url
}

function StatusDot({ processed }: { processed: boolean }) {
  return (
    <div
      className="absolute top-1.5 right-1.5 z-10"
      title={processed ? 'Indexerad — klar' : 'Bearbetar — väntar på AI-indexering'}
      style={{
        width: 8, height: 8, borderRadius: '50%',
        background: processed ? 'var(--success)' : 'var(--warning)',
        border: '1.5px solid rgba(255,255,255,0.9)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
    />
  )
}

export function PhotoGrid({ photos, allowDelete, onDelete }: PhotoGridProps) {
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())

  if (photos.length === 0) return null

  function openLightbox(photo: Photo, idx: number) {
    setLightbox(photo)
    setLightboxIdx(idx)
  }
  function prev() {
    const i = Math.max(0, lightboxIdx - 1)
    setLightbox(photos[i]); setLightboxIdx(i)
  }
  function next() {
    const i = Math.min(photos.length - 1, lightboxIdx + 1)
    setLightbox(photos[i]); setLightboxIdx(i)
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
        {photos.map((photo, idx) => {
          const url = displayUrl(photo)
          const errored = imgErrors.has(photo.id)

          return (
            <div
              key={photo.id}
              style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#F2F4FA', cursor: 'pointer' }}
              onClick={() => !allowDelete && openLightbox(photo, idx)}
            >
              {!errored ? (
                <img
                  src={url}
                  alt="Event photo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .25s', display: 'block' }}
                  onError={() => setImgErrors(prev => new Set([...prev, photo.id]))}
                  onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="3" stroke="#9598B0" strokeWidth="1.3"/><path d="M2 8l4 4 3-3 5 5" stroke="#9598B0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="7" r="1.5" fill="#9598B0"/></svg>
                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>HEIC</span>
                </div>
              )}

              {allowDelete && <StatusDot processed={photo.processed} />}

              {/* Admin overlay: view + delete */}
              {allowDelete && (
                <div
                  className="absolute inset-0 flex items-end justify-between p-1.5"
                  style={{ background: 'rgba(0,0,0,0)', transition: 'background .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.45)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)' }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); openLightbox(photo, idx) }}
                    style={{ opacity: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: 'white', fontSize: 10, padding: '4px 7px', cursor: 'pointer', transition: 'opacity .2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                    className="admin-photo-btn"
                    title="Visa"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5C1 5.5 2.5 2 5.5 2S10 5.5 10 5.5 8.5 9 5.5 9 1 5.5 1 5.5z" stroke="white" strokeWidth="1.2"/><circle cx="5.5" cy="5.5" r="1.5" fill="white"/></svg>
                  </button>
                  {onDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(photo) }}
                      style={{ opacity: 0, background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: 6, color: 'white', fontSize: 10, padding: '4px 7px', cursor: 'pointer', transition: 'opacity .2s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                      className="admin-photo-btn"
                      title="Radera"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 3h7M4 3V2h3v1M4.5 5v3M6.5 5v3M2.5 3l.5 6h5l.5-6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setLightbox(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}
            >
              Stäng ✕
            </button>

            <img
              src={displayUrl(lightbox)}
              alt="Foto"
              style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 14, objectFit: 'contain', display: 'block' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <button onClick={prev} disabled={lightboxIdx === 0} className="ps-btn ps-btn-ghost" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: '6px 12px' }}>
                ← Föregående
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{lightboxIdx + 1} / {photos.length}</span>
              <button onClick={next} disabled={lightboxIdx >= photos.length - 1} className="ps-btn ps-btn-ghost" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: '6px 12px' }}>
                Nästa →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.admin-photo-btn{opacity:0!important}.admin-photo-btn:hover{opacity:1!important}`}</style>
    </>
  )
}
