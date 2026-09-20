#!/usr/bin/env python3
"""Servidor local del cockpit React y puente seguro para servicios externos."""

from pathlib import Path
from urllib.parse import urlencode

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
LEGACY_FILE = BASE_DIR / "cockpit-dacia.html"
DGT_XML = "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml"
NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"
OVERPASS_ENDPOINTS = (
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
HOST, PORT = "127.0.0.1", 8000
HEADERS = {"User-Agent": "CockpitDacia/2.0 (tablet; OSM 3D)"}
ADSB_POINT = "https://api.adsb.lol/v2/point"

app = FastAPI(title="Mi Dacia Cockpit", docs_url="/api/docs")


async def remote_response(
    url: str,
    *,
    method: str = "GET",
    content: bytes | None = None,
    content_type: str | None = None,
    timeout: float = 28,
) -> httpx.Response:
    headers = dict(HEADERS)
    if content_type:
        headers["Content-Type"] = content_type
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            response = await client.request(method, url, content=content, headers=headers)
            response.raise_for_status()
            return response
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Servicio externo no disponible: {exc}") from exc


@app.api_route("/osm-overpass", methods=["GET", "POST"])
async def osm_overpass(request: Request) -> Response:
    if request.method == "POST":
        body = await request.body()
        content_type = request.headers.get("content-type", "application/x-www-form-urlencoded")
    else:
        body = request.url.query.encode("utf-8")
        content_type = "application/x-www-form-urlencoded"
    errors: list[str] = []
    headers = {**HEADERS, "Content-Type": content_type}
    async with httpx.AsyncClient(follow_redirects=True, timeout=26) as client:
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                remote = await client.post(endpoint, content=body, headers=headers)
                remote.raise_for_status()
                return Response(
                    remote.content,
                    media_type="application/json",
                    headers={"Cache-Control": "public, max-age=120"},
                )
            except httpx.HTTPError as exc:
                errors.append(f"{endpoint}: {exc}")
    raise HTTPException(status_code=502, detail="Servidores OSM no disponibles: " + " | ".join(errors))


@app.get("/dgt-incidencias")
@app.get("/dgt-incidencias.xml")
async def dgt_incidencias() -> Response:
    remote = await remote_response(DGT_XML)
    return Response(
        remote.content,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=90"},
    )


@app.get("/geocode")
async def geocode(q: str) -> Response:
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Escribe al menos dos caracteres")
    url = f"{NOMINATIM_SEARCH}?{urlencode({'q': query, 'format': 'jsonv2', 'limit': 7, 'countrycodes': 'es', 'addressdetails': 1, 'namedetails': 1, 'dedupe': 1, 'accept-language': 'es'})}"
    remote = await remote_response(url, timeout=15)
    return Response(
        remote.content,
        media_type="application/json",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/reverse-geocode")
async def reverse_geocode(lat: float, lon: float) -> Response:
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise HTTPException(status_code=400, detail="Coordenadas no válidas")
    url = f"{NOMINATIM_REVERSE}?{urlencode({'lat': lat, 'lon': lon, 'format': 'jsonv2', 'zoom': 10, 'addressdetails': 1, 'accept-language': 'es'})}"
    remote = await remote_response(url, timeout=15)
    return Response(
        remote.content,
        media_type="application/json",
        headers={"Cache-Control": "public, max-age=1800"},
    )


@app.get("/live-aircraft")
async def live_aircraft(lat: float, lon: float, radius_km: float = 180) -> Response:
    """Aviones ADS-B cercanos normalizados para la vista global del cockpit."""
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise HTTPException(status_code=400, detail="Coordenadas no válidas")
    radius_nm = min(250, max(10, radius_km / 1.852))
    remote = await remote_response(f"{ADSB_POINT}/{lat:.5f}/{lon:.5f}/{radius_nm:.1f}", timeout=12)
    payload = remote.json()
    aircraft = []
    for item in payload.get("ac", []):
        plane_lat, plane_lon = item.get("lat"), item.get("lon")
        if plane_lat is None or plane_lon is None or float(item.get("seen_pos", 999)) > 60:
            continue
        altitude_ft = item.get("alt_geom") or item.get("alt_baro")
        altitude_m = round(float(altitude_ft) * 0.3048) if isinstance(altitude_ft, (int, float)) else None
        speed_knots = item.get("gs")
        aircraft.append({
            "id": str(item.get("hex", "unknown")),
            "callsign": str(item.get("flight") or "").strip(),
            "registration": item.get("r"),
            "coordinate": [float(plane_lon), float(plane_lat)],
            "altitudeM": altitude_m,
            "speedKph": round(float(speed_knots) * 1.852) if isinstance(speed_knots, (int, float)) else None,
            "bearingDeg": float(item.get("track") or item.get("true_heading") or 0),
        })
    import datetime
    body = {"aircraft": aircraft[:120], "updatedAt": datetime.datetime.now(datetime.UTC).isoformat()}
    import json
    return Response(json.dumps(body), media_type="application/json", headers={"Cache-Control": "public, max-age=10"})


@app.get("/legacy")
async def legacy() -> FileResponse:
    return FileResponse(LEGACY_FILE)


@app.get("/{requested_path:path}")
async def frontend(requested_path: str) -> FileResponse:
    if requested_path == "cockpit-dacia.html":
        return FileResponse(LEGACY_FILE)

    if DIST_DIR.is_dir():
        candidate = (DIST_DIR / requested_path).resolve()
        try:
            candidate.relative_to(DIST_DIR.resolve())
        except ValueError as exc:
            raise HTTPException(status_code=404) from exc
        if candidate.is_file():
            return FileResponse(candidate)
        index = DIST_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)

    return FileResponse(LEGACY_FILE)


if __name__ == "__main__":
    print(f"Cockpit React en http://{HOST}:{PORT}/")
    print(f"Versión anterior en http://{HOST}:{PORT}/legacy")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
