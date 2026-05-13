import type { PrinterError } from '../types'

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

/**
 * Prompt the user to pick a USB device. Must be called from a user gesture.
 * Returns the device IDs on success, or a PrinterError otherwise.
 */
export async function requestUsbDevice(): Promise<
  { ok: true; vendorId: number; productId: number } | { ok: false; error: PrinterError }
> {
  if (!isWebUsbSupported()) {
    return { ok: false, error: { kind: 'unsupported-browser' } }
  }
  try {
    const device = await navigator.usb.requestDevice({ filters: [] })
    return { ok: true, vendorId: device.vendorId, productId: device.productId }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return { ok: false, error: { kind: 'device-not-found' } }
    }
    return {
      ok: false,
      error: { kind: 'permission-denied' },
    }
  }
}

async function findGrantedDevice(
  vendorId: number,
  productId: number,
): Promise<USBDevice | null> {
  const devices = await navigator.usb.getDevices()
  return (
    devices.find(
      (d) => d.vendorId === vendorId && d.productId === productId,
    ) ?? null
  )
}

function findOutEndpoint(device: USBDevice): {
  interfaceNumber: number
  endpointNumber: number
} | null {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out') {
            return {
              interfaceNumber: iface.interfaceNumber,
              endpointNumber: ep.endpointNumber,
            }
          }
        }
      }
    }
  }
  return null
}

export async function printUsb(
  bytes: Uint8Array,
  ids: { vendorId: number; productId: number },
): Promise<{ ok: true } | { ok: false; error: PrinterError }> {
  if (!isWebUsbSupported()) {
    return { ok: false, error: { kind: 'unsupported-browser' } }
  }

  const device = await findGrantedDevice(ids.vendorId, ids.productId)
  if (!device) {
    return { ok: false, error: { kind: 'device-not-found' } }
  }

  try {
    if (!device.opened) await device.open()
    if (device.configuration === null) await device.selectConfiguration(1)

    const endpoint = findOutEndpoint(device)
    if (!endpoint) {
      return {
        ok: false,
        error: { kind: 'transport-error', message: 'No OUT endpoint found' },
      }
    }

    let claimed = false
    try {
      await device.claimInterface(endpoint.interfaceNumber)
      claimed = true
      await device.transferOut(endpoint.endpointNumber, bytes as BufferSource)
    } finally {
      if (claimed) {
        try {
          await device.releaseInterface(endpoint.interfaceNumber)
        } catch {
          // Ignore — release failures shouldn't mask the original error.
        }
      }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'transport-error',
        message: err instanceof Error ? err.message : String(err),
      },
    }
  } finally {
    if (device.opened) {
      try {
        await device.close()
      } catch {
        // Ignore close failures — printer state will normalise on next open.
      }
    }
  }
}
