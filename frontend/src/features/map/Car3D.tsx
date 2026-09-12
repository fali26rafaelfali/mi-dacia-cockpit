export function Car3D({ speed }: { speed: number }) {
  return (
    <div className="cockpit-car-3d" aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}dacia-sandero-stepway-render.webp`} alt="" />
      {speed > 1 && <span className="cockpit-car-3d__motion" />}
    </div>
  )
}
