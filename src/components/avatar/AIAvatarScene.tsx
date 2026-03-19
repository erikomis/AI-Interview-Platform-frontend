'use client'

import type { AIStatus } from '@/types/interview'

interface AIAvatarSceneProps {
  aiStatus: AIStatus
}

export function AIAvatarScene({ aiStatus }: AIAvatarSceneProps) {
  const isThinking = aiStatus === 'thinking'
  const isSpeaking = aiStatus === 'speaking'

  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
      style={{
        aspectRatio: '4/3',
        background: 'linear-gradient(160deg, #08080f 0%, #0c0c20 60%, #101028 100%)',
      }}
    >
      <div className="flex flex-col items-center justify-center w-full h-full gap-2">
        <svg
          viewBox="0 0 200 240"
          style={{ width: '54%' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ambient glow behind head */}
          <ellipse cx="100" cy="108" rx="80" ry="85" fill="#2244aa" opacity="0.08" />

          {/* Shoulders / jacket */}
          <path
            d="M0 240 Q5 192 32 182 L58 172 Q80 186 100 186 Q120 186 142 172 L168 182 Q195 192 200 240 Z"
            fill="#1a2545"
          />
          {/* Jacket lapels */}
          <path d="M80 186 L66 215 L100 228 Z" fill="#f2f2f8" />
          <path d="M120 186 L134 215 L100 228 Z" fill="#f2f2f8" />
          {/* Inner shirt */}
          <path d="M80 186 L100 228 L120 186 Q110 194 100 194 Q90 194 80 186 Z" fill="#e8e8f0" />
          {/* Tie */}
          <path d="M97 198 L100 228 L103 198 Q100 202 97 198 Z" fill="#1e3a7a" />

          {/* Neck */}
          <path
            d="M85 168 Q84 188 100 188 Q116 188 115 168 L111 158 Q100 165 89 158 Z"
            fill="#c8864e"
          />

          {/* Head */}
          <ellipse cx="100" cy="105" rx="67" ry="82" fill="#d4935e" />

          {/* Jaw/chin darker */}
          <ellipse cx="100" cy="178" rx="42" ry="10" fill="#be7d48" opacity="0.45" />

          {/* Hair */}
          <path
            d="M33 92 Q30 22 100 18 Q170 22 167 92 L162 74 Q154 34 100 32 Q46 34 38 74 Z"
            fill="#181006"
          />
          <ellipse cx="35" cy="96" rx="11" ry="32" fill="#18100a" />
          <ellipse cx="165" cy="96" rx="11" ry="32" fill="#18100a" />

          {/* Ears */}
          <ellipse cx="33" cy="110" rx="9" ry="15" fill="#c07848" />
          <ellipse cx="167" cy="110" rx="9" ry="15" fill="#c07848" />
          <ellipse cx="33" cy="110" rx="5" ry="9" fill="#b06838" />
          <ellipse cx="167" cy="110" rx="5" ry="9" fill="#b06838" />

          {/* ── LEFT EYE ── */}
          <ellipse cx="71" cy="101" rx="17" ry="12" fill="#b87040" opacity="0.35" />
          {/* Sclera */}
          <ellipse cx="71" cy="101" rx="14" ry="10" fill="#f5f0ec" />
          {/* Iris */}
          <ellipse cx="71" cy="101" rx="8" ry="8" fill="#3a1e08" />
          {/* Pupil */}
          <ellipse cx="71" cy="101" rx="4.5" ry="4.5" fill="#090404" />
          {/* Highlight */}
          <ellipse cx="67.5" cy="98" rx="2.5" ry="2" fill="white" opacity="0.9" />
          {/* Upper eyelid — covers eye on blink (scaleY 0→1, origin = top of sclera) */}
          <ellipse
            cx="71"
            cy="101"
            rx="14"
            ry="10"
            fill="#d4935e"
            style={{
              transformOrigin: '71px 91px',
              animation: isThinking
                ? 'blink-fast 0.75s ease-in-out infinite'
                : 'blink 4.2s ease-in-out infinite',
            }}
          />
          {/* Eyelashes */}
          <path d="M57 94 Q71 87 85 94" stroke="#18100a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Lower lash line */}
          <path d="M57 107 Q71 113 85 107" stroke="#c07848" strokeWidth="1.2" fill="none" />

          {/* ── RIGHT EYE ── */}
          <ellipse cx="129" cy="101" rx="17" ry="12" fill="#b87040" opacity="0.35" />
          <ellipse cx="129" cy="101" rx="14" ry="10" fill="#f5f0ec" />
          <ellipse cx="129" cy="101" rx="8" ry="8" fill="#3a1e08" />
          <ellipse cx="129" cy="101" rx="4.5" ry="4.5" fill="#090404" />
          <ellipse cx="125.5" cy="98" rx="2.5" ry="2" fill="white" opacity="0.9" />
          <ellipse
            cx="129"
            cy="101"
            rx="14"
            ry="10"
            fill="#d4935e"
            style={{
              transformOrigin: '129px 91px',
              animation: isThinking
                ? 'blink-fast 0.75s ease-in-out infinite 0.07s'
                : 'blink 4.2s ease-in-out infinite 0.07s',
            }}
          />
          <path d="M115 94 Q129 87 143 94" stroke="#18100a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M115 107 Q129 113 143 107" stroke="#c07848" strokeWidth="1.2" fill="none" />

          {/* ── EYEBROWS ── */}
          <path
            d="M54 83 Q71 74 88 80"
            stroke="#18100a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            style={{
              transform: isThinking ? 'translateY(-3px)' : 'translateY(0)',
              transformOrigin: '71px 77px',
              transition: 'transform 0.4s ease',
            }}
          />
          <path
            d="M112 80 Q129 74 146 83"
            stroke="#18100a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            style={{
              transform: isThinking ? 'translateY(-3px)' : 'translateY(0)',
              transformOrigin: '129px 77px',
              transition: 'transform 0.4s ease',
            }}
          />

          {/* ── NOSE ── */}
          <path
            d="M100 116 L95 136 Q100 141 105 136"
            stroke="#b07040"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="100" cy="138" rx="7" ry="4.5" fill="#be7848" opacity="0.4" />

          {/* ── MOUTH ── */}
          {/* Dark cavity between lips */}
          <ellipse
            cx="100"
            cy="161"
            rx="18"
            ry="7"
            fill="#1a0808"
            style={{
              transformOrigin: '100px 156px',
              transform: isSpeaking ? undefined : 'scaleY(0.15)',
              animation: isSpeaking ? 'mouth-speak 0.32s ease-in-out infinite alternate' : undefined,
            }}
          />
          {/* Upper lip */}
          <path
            d="M80 156 Q88 149 100 152 Q112 149 120 156 Q110 161 100 160 Q90 161 80 156 Z"
            fill="#bf5040"
          />
          {/* Lower lip */}
          <path
            d="M80 156 Q100 170 120 156 Q112 168 100 169 Q88 168 80 156 Z"
            fill="#cf6050"
            style={{
              transformOrigin: '100px 156px',
              animation: isSpeaking ? 'lower-lip 0.32s ease-in-out infinite alternate' : undefined,
            }}
          />

          {/* Cheek blush */}
          <ellipse cx="52" cy="126" rx="18" ry="10" fill="#e08060" opacity="0.12" />
          <ellipse cx="148" cy="126" rx="18" ry="10" fill="#e08060" opacity="0.12" />
        </svg>

        {/* Status label */}
        <div className="text-xs font-mono tracking-widest" style={{ color: '#00d4ff88' }}>
          {aiStatus === 'idle'      && 'STANDBY'}
          {aiStatus === 'thinking'  && 'PROCESSANDO...'}
          {aiStatus === 'speaking'  && 'FALANDO'}
          {aiStatus === 'listening' && 'OUVINDO'}
        </div>
      </div>

      <style jsx>{`
        /* Eyelid closes from the top of the sclera downward */
        @keyframes blink {
          0%, 88%, 100% { transform: scaleY(0); }
          93%            { transform: scaleY(1); }
        }
        @keyframes blink-fast {
          0%, 55%, 100% { transform: scaleY(0); }
          65%            { transform: scaleY(1); }
        }
        /* Mouth cavity grows when speaking */
        @keyframes mouth-speak {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1);   }
        }
        /* Lower lip drops slightly */
        @keyframes lower-lip {
          from { transform: translateY(0px); }
          to   { transform: translateY(5px); }
        }
      `}</style>
    </div>
  )
}
