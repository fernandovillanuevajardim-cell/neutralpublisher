// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ScreenManager } from '../src/ScreenManager'
import { listDisplayDevices, updateDisplayDevice } from '../src/displayControl'

vi.mock('../src/displayControl', () => ({
  HEARTBEAT_MS: 300_000, RECENT_MS: 660_000,
  listDisplayDevices: vi.fn(), updateDisplayDevice: vi.fn(),
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.mocked(listDisplayDevices).mockResolvedValue([
    { id: 'screen-a', organization_id: 'org-a', name: 'Sucursal Centro', enabled: true, last_seen_at: new Date().toISOString() },
    { id: 'screen-b', organization_id: 'org-a', name: 'Sucursal Norte', enabled: null, last_seen_at: new Date().toISOString() },
  ])
  vi.mocked(updateDisplayDevice).mockResolvedValue(undefined)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
async function render(authenticated = true, org = 'org-a') {
  await act(async () => root.render(<ScreenManager organizationId={org} authenticated={authenticated} />))
}
function button(text: string) {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!
}
it('counts recent authorized devices, not pending approvals', async () => {
  await render()
  expect(listDisplayDevices).toHaveBeenCalledWith('org-a')
  expect(container.textContent).toContain('1 autorizadas con conexion reciente')
  expect(container.textContent).toContain('2 registradas')
})
it('allows cancellation before disabling and scopes the confirmed command to the organization', async () => {
  await render()
  vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  await act(() => button('Desactivar').click())
  expect(updateDisplayDevice).not.toHaveBeenCalled()
  await act(() => button('Desactivar').click())
  expect(updateDisplayDevice).toHaveBeenCalledWith('screen-a', 'org-a', { enabled: false })
  expect(container.textContent).toContain('Reactivar')
})
it('does not claim success or change status when saving fails', async () => {
  await render()
  vi.mocked(updateDisplayDevice).mockRejectedValue(new Error('Permiso denegado'))
  await act(() => button('Autorizar').click())
  expect(container.textContent).toContain('Permiso denegado')
  expect(container.textContent).toContain('Pendiente')
  expect(container.textContent).not.toContain('Orden guardada')
})
it('does not query device lists without authentication', async () => {
  await render(false)
  expect(listDisplayDevices).not.toHaveBeenCalled()
})
it('does not query the unscoped legacy channel', async () => {
  await render(true, '')
  expect(listDisplayDevices).not.toHaveBeenCalled()
  expect(container.textContent).toContain('sin empresa no tienen control remoto')
})
it('skips background admin polling', async () => {
  await render()
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  await act(() => vi.advanceTimersByTimeAsync(300_000))
  expect(listDisplayDevices).toHaveBeenCalledTimes(1)
})
