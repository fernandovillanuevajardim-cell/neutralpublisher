// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { getDeviceIdentity } from '../src/displayControl'

beforeEach(() => localStorage.clear())

it('uses the same device code after a simulated TV browser restart', () => {
  const first = getDeviceIdentity('company-a')
  const stored = localStorage.getItem('neutralpublisher-device-v1:company-a')
  expect(stored).toBeTruthy()
  expect(getDeviceIdentity('company-a')).toEqual(first)
  expect(first.id.slice(0, 8)).toBe(getDeviceIdentity('company-a').id.slice(0, 8))
})

it('keeps companies on separate device identities', () => {
  expect(getDeviceIdentity('company-a').id).not.toBe(getDeviceIdentity('company-b').id)
})
