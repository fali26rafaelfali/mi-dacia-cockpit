import type { CockpitTab } from './cockpit.types'

const icons = {
  menu: '☰',
  route: '↗',
  settings: '⚙',
  fuel: '◒',
  parking: 'P',
  radar: '⌖',
  emergency: 'SOS',
  history: '↶',
  backup: '⇧',
}

export interface HeaderProps {
  time?: Date
  title?: string
  connected?: boolean
  temperatureC?: number
  profileName?: string
  onMenuClick?: () => void
}

export function Header({
  time = new Date(),
  title = 'Mi Dacia',
  connected = true,
  temperatureC = 21,
  profileName = 'Conductor',
  onMenuClick,
}: HeaderProps) {
  const formattedTime = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(time)

  return (
    <header className="cockpit-header">
      <button className="cockpit-icon-button" type="button" onClick={onMenuClick} aria-label="Abrir menú">
        <span aria-hidden="true">{icons.menu}</span>
      </button>
      <div className="cockpit-header__brand">
        <span className="cockpit-header__mark" aria-hidden="true">D</span>
        <div>
          <h1>{title}</h1>
          <span>{profileName}</span>
        </div>
      </div>
      <div className="cockpit-header__status" aria-label="Estado del vehículo">
        <span className={connected ? 'cockpit-dot cockpit-dot--ok' : 'cockpit-dot'} />
        <span>{connected ? 'Vehículo conectado' : 'Sin conexión'}</span>
        <span aria-hidden="true">•</span>
        <span>{temperatureC} °C</span>
      </div>
      <time className="cockpit-header__time" dateTime={time.toISOString()}>{formattedTime}</time>
    </header>
  )
}

export interface TabsProps {
  activeTab: CockpitTab
  onChange: (tab: CockpitTab) => void
}

const tabItems: Array<{ id: CockpitTab; label: string }> = [
  { id: 'drive', label: 'Conducción' },
  { id: 'trip', label: 'Viaje' },
  { id: 'engine', label: 'Motor' },
]

export function Tabs({ activeTab, onChange }: TabsProps) {
  return (
    <div className="cockpit-tabs" role="tablist" aria-label="Información del vehículo">
      {tabItems.map((tab) => (
        <button
          type="button"
          role="tab"
          id={`cockpit-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`cockpit-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={activeTab === tab.id ? 'cockpit-tabs__tab cockpit-tabs__tab--active' : 'cockpit-tabs__tab'}
          key={tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export interface QuickAction {
  id: string
  label: string
  icon?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

export interface QuickActionsProps {
  actions?: QuickAction[]
}

export function QuickActions({ actions }: QuickActionsProps) {
  const fallback: QuickAction[] = [
    { id: 'route', label: 'Ruta', icon: icons.route, onClick: () => undefined },
    { id: 'fuel', label: 'Combustible', icon: icons.fuel, onClick: () => undefined },
    { id: 'parking', label: 'Aparcar', icon: icons.parking, onClick: () => undefined },
    { id: 'radar', label: 'Radar', icon: icons.radar, onClick: () => undefined },
  ]
  const items = actions ?? fallback

  return (
    <nav className="cockpit-quick-actions" aria-label="Acciones rápidas">
      {items.map((action) => (
        <button
          type="button"
          className={action.active ? 'cockpit-quick-action cockpit-quick-action--active' : 'cockpit-quick-action'}
          disabled={action.disabled}
          aria-pressed={action.active}
          onClick={action.onClick}
          key={action.id}
        >
          <span className="cockpit-quick-action__icon" aria-hidden="true">{action.icon ?? '•'}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </nav>
  )
}

export interface SideMenuItem {
  id: string
  label: string
  subtitle?: string
  icon?: string
  danger?: boolean
  state?: string
  onSelect: () => void
}

export interface SideMenuSection {
  id: string
  label: string
  items: SideMenuItem[]
}

export interface SideMenuProps {
  open: boolean
  onClose: () => void
  items?: SideMenuItem[]
  sections?: SideMenuSection[]
  vehicleName?: string
}

export function SideMenu({ open, onClose, items, sections, vehicleName = 'Duster Journey' }: SideMenuProps) {
  const defaults: SideMenuItem[] = [
    { id: 'settings', label: 'Ajustes', icon: icons.settings, onSelect: () => undefined },
    { id: 'history', label: 'Historial', icon: icons.history, onSelect: () => undefined },
    { id: 'backup', label: 'Copia de seguridad', icon: icons.backup, onSelect: () => undefined },
    { id: 'emergency', label: 'Emergencia', icon: icons.emergency, onSelect: () => undefined },
  ]

  if (!open) return null
  return (
    <div className="cockpit-drawer-layer">
      <button type="button" className="cockpit-scrim" onClick={onClose} aria-label="Cerrar menú" />
      <aside className="cockpit-side-menu" aria-label="Menú principal">
        <div className="cockpit-side-menu__head">
          <span className="cockpit-header__mark" aria-hidden="true">D</span>
          <div><small>Vehículo actual</small><strong>{vehicleName}</strong></div>
          <button type="button" className="cockpit-icon-button" onClick={onClose} aria-label="Cerrar menú">×</button>
        </div>
        <p className="cockpit-side-menu__intro">Elige una herramienta. Las funciones de averías necesitan conectar el adaptador OBD.</p>
        <nav>
          {(sections ?? [{ id: 'main', label: '', items: items ?? defaults }]).map((section) => (
            <section className="cockpit-side-menu__section" key={section.id}>
              {section.label && <h2>{section.label}</h2>}
              {section.items.map((item) => (
                <button className={item.danger ? 'cockpit-side-menu__item cockpit-side-menu__item--danger' : 'cockpit-side-menu__item'} type="button" key={item.id} onClick={() => { item.onSelect(); onClose() }}>
                  <span className="cockpit-side-menu__item-icon" aria-hidden="true">{item.icon ?? '•'}</span>
                  <span className="cockpit-side-menu__item-copy"><strong>{item.label}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span>
                  {item.state && <span className="cockpit-side-menu__item-state">{item.state}</span>}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <p className="cockpit-side-menu__version">Cockpit React · Menú migrado</p>
      </aside>
    </div>
  )
}

export function ToolDialog({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div className="cockpit-dialog-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="cockpit-dialog" role="dialog" aria-modal="true" aria-labelledby="cockpit-dialog-title">
        <h2 id="cockpit-dialog-title">{title}</h2>
        <p>{text}</p>
        <button type="button" className="cockpit-button" onClick={onClose}>Cerrar</button>
      </section>
    </div>
  )
}
