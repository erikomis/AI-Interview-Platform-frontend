/**
 * Turns LLM output into text that sounds natural when read by the browser's
 * speechSynthesis: strips markdown syntax, list markers, labels and emoji that
 * would otherwise be spoken literally. Mirrors the backend's toSpeechText.
 */
const EMOJI_RE = new RegExp('\\p{Extended_Pictographic}', 'gu')

// Speaker/section labels the model sometimes prefixes lines with
const LABEL_RE = /^[ \t]*(?:pergunta|question|resposta|answer|feedback|entrevistador|interviewer)(?:[ \t]+\d+)?[ \t]*[:：][ \t]*/gim

export function toSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')                  // code blocks are unreadable aloud
    .replace(/`([^`]*)`/g, '$1')                      // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')             // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')          // links → label
    .replace(/(\*\*|__)(.*?)\1/g, '$2')               // bold
    .replace(/(\*|_)(\S.*?\S|\S)\1/g, '$2')           // italic
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')         // headings
    .replace(/^[ \t]*>[ \t]?/gm, '')                  // blockquotes
    .replace(/^[ \t]*(?:[-*+•]|\d+[.)])[ \t]+/gm, '') // list markers
    .replace(LABEL_RE, '')                            // "Question 2:", "Feedback:" …
    .replace(/[*#_~|`]/g, ' ')                        // leftover markdown symbols
    .replace(EMOJI_RE, '')                            // emoji
    // Each line becomes its own sentence so the voice pauses between them
    .replace(/([^\s.!?:;,])[ \t]*\n\s*/g, '$1. ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
