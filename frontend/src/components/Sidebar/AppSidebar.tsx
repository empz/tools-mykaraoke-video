import { Gauge, Home, Music, Music2 } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { type Item, Main } from "./Main"

const items: Item[] = [
  { icon: Home, title: "Home", path: "/" },
  { icon: Music, title: "Key & BPM", path: "/key-bpm-analyzer" },
  { icon: Gauge, title: "BPM Changer", path: "/bpm-changer" },
  { icon: Music2, title: "Pitch Shifter", path: "/pitch-shifter" },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
