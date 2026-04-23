'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from './Button'
import type { Photo } from '@/types'

interface PhotoGridProps {
  photos: Photo[]
  allowDelete?: boolean
  onDelete?: (photo: Photo) => void
}

/** Returns the best displayable URL — watermark_url is always JPEG, even for HEIC originals */
function getDisplayUrl(photo: Photo): string {
  // watermark_url is generated as JPEG during /embed, so always displayable
  if (photo.watermark_url) return photo.watermark_url
  return photo.public_url
}

export function PhotoGrid({ photos, allowDelete, onDelete }: PhotoGridProps) {
  const [selected, setSelected] = useState<Photo | null>(null)

  if (photos.length === 0) return null

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-square rounded-lg overflow-hidden bg-neutral-100 cursor-pointer"
            onClick={() => setSelected(photo)}
          >
            <Image
              src={getDisplayUrl(photo)}
              alt="Event photo"
              fill
              className="object-cover transition-transform group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 50vw, 33vw"
              unoptimized
            />

            {/* Processed indicator (admin only) */}
            {allowDelete && (
              <div
                className={`absolute top-2 right-2 w-2 h-2 rounded-full z-10 ${
                  photo.processed ? 'bg-green-400' : 'bg-amber-400'
                }`}
                title={photo.processed ? 'Indexerat' : 'Bearbetar…'}
              />
            )}

            {/* Delete overlay (admin only) */}
            {allowDelete && onDelete && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-end justify-center pb-3 transition-all">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(photo) }}
                  className="opacity-0 group-hover:opacity-100 text-white text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md transition-all"
                >
                  Radera
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm transition-colors"
            >
              Stäng ✕
            </button>
            <Image
              src={getDisplayUrl(selected)}
              alt="Fullstorlek foto"
              width={900}
              height={900}
              className="w-full rounded-xl object-contain max-h-[80vh]"
              unoptimized
            />
            <div className="flex gap-3 justify-center mt-4">
              <a
                href={selected.public_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Ladda ner original
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
