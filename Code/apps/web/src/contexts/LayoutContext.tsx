import { createPortal } from 'react-dom'
import { useState, useEffect, type ReactNode } from 'react'

const LEFT_PANEL_SLOT_ID = 'left-panel-slot'
const RIGHT_PANEL_SLOT_ID = 'right-panel-slot'

/**
 * Render in Layout to create the portal target for left-side push panels.
 * Sits before the main content area in the root flex layout.
 */
export function LeftPanelSlot() {
  return <div id={LEFT_PANEL_SLOT_ID} className="flex" />
}

/**
 * Render in Layout to create the portal target for right-side push panels.
 * Sits after the main content area in the root flex layout.
 */
export function RightPanelSlot() {
  return <div id={RIGHT_PANEL_SLOT_ID} className="flex" />
}

/**
 * Portal component -- renders children into the left-panel slot in the layout.
 * Use inside any page to push nav + main content to the right.
 */
export function LeftPanelPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById(LEFT_PANEL_SLOT_ID))
  }, [])

  if (!target) return null
  return createPortal(children, target)
}

/**
 * Portal component -- renders children into the right-panel slot in the layout.
 * Use inside any page to push nav + main content to the left.
 */
export function RightPanelPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById(RIGHT_PANEL_SLOT_ID))
  }, [])

  if (!target) return null
  return createPortal(children, target)
}
