import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const VisibilityContext = createContext()

export function VisibilityProvider({ children }) {
  const [visibility, setVisibility] = useState(null)

  useEffect(() => {
    const loadVisibility = async () => {
      const { data } = await supabase
        .from('config')
        .select('key, value')
        .in('key', ['tool_exam_visible', 'tool_transcript_visible', 'tool_ai_visible', 'tool_audio_visible'])

      const visibilityMap = {
        exam: true,
        transcript: true,
        ai: true,
        audio: true,
      }
      if (data) {
        data.forEach(row => {
          const toolId = row.key.replace('tool_', '').replace('_visible', '')
          visibilityMap[toolId] = row.value === 'true'
        })
      }
      setVisibility(visibilityMap)
    }

    loadVisibility()

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('config-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'config', filter: 'key=like.tool_%_visible' }, payload => {
        setVisibility(prev => {
          const toolId = payload.new.key.replace('tool_', '').replace('_visible', '')
          return { ...prev, [toolId]: payload.new.value === 'true' }
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  return (
    <VisibilityContext.Provider value={visibility}>
      {children}
    </VisibilityContext.Provider>
  )
}

export function useVisibility() {
  const context = useContext(VisibilityContext)
  if (context === undefined) {
    throw new Error('useVisibility must be used within VisibilityProvider')
  }
  return context
}
