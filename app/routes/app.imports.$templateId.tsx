// Parent layout route for /app/imports/:templateId that renders child routes (index: settings, /schedule, etc.)
import { Outlet } from '@remix-run/react'

export default function ImportTemplateLayout() {
  return <Outlet />
}
