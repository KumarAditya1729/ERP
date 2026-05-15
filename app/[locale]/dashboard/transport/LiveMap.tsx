'use client'
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface VehiclePosition {
  id: string
  vehicle_model?: string
  registration_number: string
  last_latitude: number
  last_longitude: number
  last_speed: number
  last_heading: number
  last_battery?: number
  last_ping_at: string
}

export function LiveTransportMap({ tenantId }: { tenantId: string }) {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadVehicles = useCallback(async () => {
    const res = await fetch('/api/gps/vehicles')
    const data = await res.json()
    setVehicles(data.vehicles ?? [])
  }, [])

  useEffect(() => {
    loadVehicles()

    const channel = supabase
      .channel('gps_live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transport_vehicles',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          const updated = payload.new as VehiclePosition
          setVehicles(prev =>
            prev.map(v => v.id === updated.id ? { ...v, ...updated } : v)
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadVehicles, supabase, tenantId])

  useEffect(() => {
    if ((window as any).google) { setMapLoaded(true); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!mapLoaded || vehicles.length === 0) return

    const mapEl = document.getElementById('transport-map')
    if (!mapEl) return

    const center = { lat: vehicles[0].last_latitude, lng: vehicles[0].last_longitude }
    const map = new (window as any).google.maps.Map(mapEl, {
      zoom: 13,
      center,
      mapTypeId: 'roadmap',
    })

    vehicles.forEach(v => {
      if (!v.last_latitude) return
      const marker = new (window as any).google.maps.Marker({
        position: { lat: v.last_latitude, lng: v.last_longitude },
        map,
        title: v.registration_number,
        icon: { url: v.last_speed > 0 ? '/bus-active.svg' : '/bus-parked.svg', scaledSize: new (window as any).google.maps.Size(40, 40) }
      })

      const infoWindow = new (window as any).google.maps.InfoWindow({
        content: `
          <div style="padding:8px;color:black">
            <strong>${v.registration_number}</strong><br/>
            Speed: ${Math.round(v.last_speed ?? 0)} km/h<br/>
            ${v.last_speed > 0 ? '🟢 Moving' : '🔴 Stopped'}<br/>
            Updated: ${new Date(v.last_ping_at).toLocaleTimeString()}
          </div>
        `
      })

      marker.addListener('click', () => infoWindow.open(map, marker))
    })
  }, [mapLoaded, vehicles])

  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {vehicles.map(v => (
          <div key={v.id} className="flex-shrink-0 bg-white border rounded-lg p-3 min-w-[180px]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${v.last_speed > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="font-semibold text-sm text-black">{v.registration_number}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{v.vehicle_model || 'Bus'}</p>
            <p className="text-xs text-gray-500">{Math.round(v.last_speed ?? 0)} km/h</p>
            <p className="text-xs text-gray-400">{new Date(v.last_ping_at).toLocaleTimeString()}</p>
          </div>
        ))}
      </div>

      <div
        id="transport-map"
        className="w-full h-[500px] rounded-xl border bg-gray-100"
      >
        {!mapLoaded && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading map...
          </div>
        )}
      </div>
    </div>
  )
}
