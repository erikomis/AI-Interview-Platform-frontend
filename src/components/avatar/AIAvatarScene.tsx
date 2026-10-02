'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getAnalyser, getSpeech } from '@/utils/audio'
import type { AIStatus, InterviewerPersona as Interviewer } from '@/types/interview'
import type { Avatar3D, AvatarModel } from './avatar-3d'

interface AIAvatarSceneProps {
  aiStatus: AIStatus
  interviewer: Interviewer
}

/**
 * 3D interviewers.
 *  - Alex: Microsoft Rocketbox "Business_Male_01" (MIT licence), FBX + textures
 *  - Sofia: Avaturn avatar from the TalkingHead project (free for non-commercial use)
 * Both expose ARKit + Oculus viseme blend shapes used for lip-sync.
 */
const MODELS: Record<Interviewer, AvatarModel> = {
  male: {
    url: '/avatar/3d/alex/alex.fbx',
    scale: 0.01,
    bones: { head: 'Bip01_Head', neck: 'Bip01_Neck', spine: 'Bip01_Spine2' },
    pose: { Bip01_L_UpperArm: [0, 0, -1.2], Bip01_R_UpperArm: [0, 0, 1.2] },
    // Relaxed upper lids and a hint of a smile — the neutral pose stares
    baseline: { eyeBlinkLeft: 0.3, eyeBlinkRight: 0.3, mouthSmileLeft: 0.15, mouthSmileRight: 0.15 },
    distance: 1.35,
  },
  female: {
    url: '/avatar/3d/sofia.glb',
    bones: { head: 'Head', neck: 'Neck', spine: 'Spine2' },
    pose: { LeftArm: [0, 0, -1.25], RightArm: [0, 0, 1.25] },
    baseline: { mouthSmile: 0.12 },
    distance: 1.35,
  },
}

/** Video-call tile with a live 3D interviewer in a (blurred) office. */
export function AIAvatarScene({ aiStatus, interviewer }: AIAvatarSceneProps) {
  const t = useTranslations('interview')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avatarRef = useRef<Avatar3D | null>(null)
  const statusRef = useRef(aiStatus)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  statusRef.current = aiStatus

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let observer: ResizeObserver | undefined
    setState('loading')

    // three.js is large — load it only on the interview page, on the client
    import('./avatar-3d')
      .then(async ({ Avatar3D }) => {
        if (cancelled) return
        const avatar = new Avatar3D(canvas)
        avatarRef.current = avatar
        avatar.setAnalyserSource(getAnalyser)
        avatar.setSpeechSource(getSpeech)
        const resize = () => avatar.resize(canvas.clientWidth, canvas.clientHeight)
        resize()
        observer = new ResizeObserver(resize)
        observer.observe(canvas)
        await avatar.load(MODELS[interviewer])
        if (cancelled) return
        avatar.setMode(statusRef.current)
        avatar.start()
        setState('ready')
      })
      .catch((err) => {
        console.error('[avatar] failed to load', err)
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
      observer?.disconnect()
      avatarRef.current?.dispose()
      avatarRef.current = null
    }
  }, [interviewer])

  useEffect(() => {
    avatarRef.current?.setMode(aiStatus)
  }, [aiStatus])

  const speaking = aiStatus === 'speaking'

  return (
    <div className="relative w-full overflow-hidden bg-neutral-900" style={{ aspectRatio: '4 / 3' }}>
      {/* Blurred office behind the interviewer, like a real camera's depth of field */}
      <div
        aria-hidden
        className="absolute -inset-4 bg-cover bg-center"
        style={{ backgroundImage: 'url(/avatar/office.jpg)', filter: 'blur(6px) brightness(0.85) saturate(0.9)' }}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full transition-opacity duration-500"
        style={{ opacity: state === 'ready' ? 1 : 0 }}
        role="img"
        aria-label={t(interviewer === 'female' ? 'interviewerFemale' : 'interviewer')}
      />

      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-3xl font-semibold text-white backdrop-blur">
            {interviewer === 'female' ? 'S' : 'A'}
          </div>
        </div>
      )}

      {/* Active-speaker ring, as in video-call apps */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[box-shadow,opacity] duration-300"
        style={{
          boxShadow: 'inset 0 0 0 3px rgba(52, 211, 153, 0.9)',
          opacity: speaking ? 1 : 0,
        }}
      />

      {aiStatus === 'thinking' && (
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1.5 backdrop-blur-sm" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      )}
    </div>
  )
}
